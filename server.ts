import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { AppState, Match, Participant, AlphaInterest } from './src/types';
import {
  generateBracket,
  recordMatchResult,
  autoAssignTables,
  hasPlayedDependencies,
  invalidateDependencies,
  updateMatchStatuses,
} from './src/lib/tournament';
import { INITIAL_STATE, INITIAL_ACTIVITIES, INITIAL_POPCORN, SIMULATION_NAMES_16, SIMULATION_NAMES_31 } from './src/lib/initial-data';

const app = express();
const PORT = 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || 'united2026';

app.use(express.json());

// Admin authentication middleware
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const pin = req.headers['x-admin-pin'] || req.query.adminPin || (req.body && req.body.adminPin);
  if (pin === ADMIN_PIN || pin === 'united2026' || pin === 'admin') {
    return next();
  }
  return res.status(401).json({ error: 'Uautorisert: Krever gyldig admin-PIN' });
}

// File persistence setup
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function loadState(): AppState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const popcorn = parsed.popcorn && Array.isArray(parsed.popcorn.bongs)
        ? parsed.popcorn
        : JSON.parse(JSON.stringify(INITIAL_POPCORN));

      const activeCount = popcorn.bongs.filter(
        (b: any) => b.status === 'activated' || b.status === 'used'
      ).length;

      return {
        ...parsed,
        event: {
          ...INITIAL_STATE.event,
          freePopcornLimit: popcorn.totalCapacity ?? INITIAL_STATE.event.freePopcornLimit,
          popcornClaimedCount: activeCount,
        },
        popcorn,
        activities: INITIAL_ACTIVITIES,
      };
    }
  } catch (err) {
    console.error('Error loading db.json, using initial state:', err);
  }
  return JSON.parse(JSON.stringify(INITIAL_STATE));
}

let state: AppState = loadState();

function saveState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save state to db.json:', err);
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/state', (req, res) => {
  res.json(state);
});

// Register participant for Table tennis
app.post('/api/register', (req, res) => {
  const { firstName, userId } = req.body;
  if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
    return res.status(400).json({ error: 'Fornavn er påkrevd.' });
  }

  const cleanName = firstName.trim();
  const cleanUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : undefined;

  // Check if already registered by userId or firstName
  const existing = state.tournament.participants.find(
    (p) => (cleanUserId && p.userId === cleanUserId) || p.firstName.toLowerCase() === cleanName.toLowerCase()
  );
  if (existing) {
    if (cleanUserId && !existing.userId) {
      existing.userId = cleanUserId;
      saveState();
    }
    return res.json({ success: true, participant: existing, state, alreadyRegistered: true });
  }

  const participant: Participant = {
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    firstName: cleanName,
    registeredAt: new Date().toISOString(),
    userId: cleanUserId,
  };

  state.tournament.participants.push(participant);
  saveState();

  res.json({ success: true, participant, state });
});

// Remove participant (Admin)
app.delete('/api/participants/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  state.tournament.participants = state.tournament.participants.filter((p) => p.id !== id);
  saveState();
  res.json({ success: true, state });
});

// Start / Generate tournament bracket (Admin)
app.post('/api/tournament/start', requireAdmin, (req, res) => {
  try {
    if (state.tournament.participants.length < 2) {
      return res.status(400).json({ error: 'Minst 2 deltakere kreves for å starte turneringen.' });
    }

    const matches = generateBracket(state.tournament.participants);
    state.tournament.matches = matches;
    state.tournament.status = 'active';
    state.tournament.startedAt = new Date().toISOString();
    state.tournament.completedAt = null;
    state.tournament.winner = null;

    saveState();
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Kunne ikke starte turneringen' });
  }
});

// Generate new bracket draw with existing participants (Admin)
app.post('/api/tournament/re-draw', requireAdmin, (req, res) => {
  try {
    if (state.tournament.participants.length < 2) {
      return res.status(400).json({ error: 'Minst 2 deltakere kreves for å generere ny trekning.' });
    }

    const matches = generateBracket(state.tournament.participants);
    state.tournament.matches = matches;
    state.tournament.startedAt = null;
    state.tournament.completedAt = null;
    state.tournament.winner = null;

    saveState();
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Kunne ikke generere ny trekning' });
  }
});

// Record match score (Admin)
app.post('/api/tournament/match/score', requireAdmin, (req, res) => {
  try {
    const { matchId, scoreA, scoreB, isWalkover, walkoverWinnerSlot } = req.body;
    if (!matchId) {
      return res.status(400).json({ error: 'Match ID mangler.' });
    }

    const { updatedMatches, tournamentWinner } = recordMatchResult(
      state.tournament.matches,
      matchId,
      Number(scoreA),
      Number(scoreB),
      Boolean(isWalkover),
      walkoverWinnerSlot
    );

    state.tournament.matches = updatedMatches;

    if (tournamentWinner) {
      state.tournament.winner = tournamentWinner;
      state.tournament.status = 'completed';
      state.tournament.completedAt = new Date().toISOString();
    }

    saveState();
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Feil ved lagring av resultat' });
  }
});

// Correct match score (with dependency invalidation) (Admin)
app.post('/api/tournament/match/correct', requireAdmin, (req, res) => {
  try {
    const { matchId, newScoreA, newScoreB, confirmCorrection } = req.body;
    const match = state.tournament.matches.find((m) => m.id === matchId);
    if (!match) return res.status(404).json({ error: 'Kamp ikke funnet.' });

    const hasDeps = hasPlayedDependencies(matchId, state.tournament.matches);
    if (hasDeps && !confirmCorrection) {
      return res.status(409).json({
        requiresConfirmation: true,
        warning:
          'Dette resultatet påvirker senere kamper i turneringen som allerede er spilt eller pågår. Dersom du fortsetter, vil avhengige kamper bli tilbakestilt.',
      });
    }

    // Invalidate downstream matches
    invalidateDependencies(matchId, state.tournament.matches);

    // Record the new score
    const { updatedMatches, tournamentWinner } = recordMatchResult(
      state.tournament.matches,
      matchId,
      Number(newScoreA),
      Number(newScoreB)
    );

    state.tournament.matches = updatedMatches;
    state.tournament.winner = tournamentWinner;
    if (!tournamentWinner && state.tournament.status === 'completed') {
      state.tournament.status = 'active';
      state.tournament.completedAt = null;
    }

    saveState();
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Feil ved korrigering av resultat' });
  }
});

// Assign table to match (Admin)
app.post('/api/tournament/match/assign-table', requireAdmin, (req, res) => {
  const { matchId, tableNumber, status } = req.body;
  const match = state.tournament.matches.find((m) => m.id === matchId);
  if (!match) return res.status(404).json({ error: 'Kamp ikke funnet.' });

  // Clear previous match occupying this table if starting
  if (tableNumber && status === 'in_progress') {
    state.tournament.matches.forEach((m) => {
      if (m.id !== matchId && m.tableNumber === tableNumber && m.status === 'in_progress') {
        m.tableNumber = null;
        m.status = 'ready';
      }
    });
  }

  match.tableNumber = tableNumber;
  if (status) {
    match.status = status;
    if (status === 'in_progress' && !match.startedAt) {
      match.startedAt = new Date().toISOString();
    }
  }

  saveState();
  res.json({ success: true, state });
});

// Reset tournament (Admin)
app.post('/api/tournament/reset', requireAdmin, (req, res) => {
  const { keepParticipants } = req.body;
  state.tournament.status = 'registration';
  state.tournament.startedAt = null;
  state.tournament.completedAt = null;
  state.tournament.matches = [];
  state.tournament.winner = null;

  if (!keepParticipants) {
    state.tournament.participants = [];
  }

  saveState();
  res.json({ success: true, state });
});

// Simulation generator (Admin)
app.post('/api/tournament/simulate', requireAdmin, (req, res) => {
  const { count = 16 } = req.body;
  const names = count === 31 ? SIMULATION_NAMES_31 : SIMULATION_NAMES_16.slice(0, count);

  const participants: Participant[] = names.map((name, i) => ({
    id: `sim_${i + 1}_${Math.random().toString(36).substring(2, 6)}`,
    firstName: name,
    registeredAt: new Date(Date.now() - (names.length - i) * 60000).toISOString(),
  }));

  state.tournament.participants = participants;
  const matches = generateBracket(participants);
  state.tournament.matches = matches;
  state.tournament.status = 'active';
  state.tournament.startedAt = new Date().toISOString();
  state.tournament.completedAt = null;
  state.tournament.winner = null;

  saveState();
  res.json({ success: true, count: participants.length, state });
});

// Register interest for Alpha (Public)
app.post('/api/alpha/interest', (req, res) => {
  const { firstName, phone, notes, userId } = req.body;
  if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
    return res.status(400).json({ error: 'Fornavn er påkrevd.' });
  }

  const cleanName = firstName.trim();
  const cleanUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : undefined;

  // Check if already registered by userId or name
  const existing = state.alphaInterests.find(
    (a) => (cleanUserId && a.userId === cleanUserId) || a.firstName.toLowerCase() === cleanName.toLowerCase()
  );
  if (existing) {
    if (cleanUserId && !existing.userId) {
      existing.userId = cleanUserId;
    }
    if (phone && !existing.phone) {
      existing.phone = phone.trim();
    }
    saveState();
    return res.json({ success: true, interest: existing, state, alreadyRegistered: true });
  }

  const interest: AlphaInterest = {
    id: 'alpha_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    firstName: cleanName,
    phone: phone ? phone.trim() : undefined,
    registeredAt: new Date().toISOString(),
    notes: notes ? notes.trim() : undefined,
    userId: cleanUserId,
  };

  state.alphaInterests.push(interest);
  saveState();
  res.json({ success: true, interest, state });
});

// Rename user across profile & activities while keeping same userId (Public)
app.post('/api/user/rename', (req, res) => {
  const { userId, oldName, newName } = req.body;
  if (!newName || typeof newName !== 'string' || !newName.trim()) {
    return res.status(400).json({ error: 'Nytt fornavn er påkrevd.' });
  }

  const cleanNewName = newName.trim();
  const cleanOldName = typeof oldName === 'string' && oldName.trim() ? oldName.trim() : null;
  const cleanUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : null;

  let changesMade = false;

  // 1. Update Table Tennis participant
  state.tournament.participants.forEach((p) => {
    if ((cleanUserId && p.userId === cleanUserId) || (cleanOldName && p.firstName.toLowerCase() === cleanOldName.toLowerCase())) {
      p.firstName = cleanNewName;
      if (cleanUserId && !p.userId) p.userId = cleanUserId;
      changesMade = true;
    }
  });

  // Also update participant names in matches
  state.tournament.matches.forEach((m) => {
    if (m.playerA && ((cleanUserId && m.playerA.userId === cleanUserId) || (cleanOldName && m.playerA.firstName.toLowerCase() === cleanOldName.toLowerCase()))) {
      m.playerA.firstName = cleanNewName;
      if (cleanUserId && !m.playerA.userId) m.playerA.userId = cleanUserId;
    }
    if (m.playerB && ((cleanUserId && m.playerB.userId === cleanUserId) || (cleanOldName && m.playerB.firstName.toLowerCase() === cleanOldName.toLowerCase()))) {
      m.playerB.firstName = cleanNewName;
      if (cleanUserId && !m.playerB.userId) m.playerB.userId = cleanUserId;
    }
  });
  if (state.tournament.winner) {
    if ((cleanUserId && state.tournament.winner.userId === cleanUserId) || (cleanOldName && state.tournament.winner.firstName.toLowerCase() === cleanOldName.toLowerCase())) {
      state.tournament.winner.firstName = cleanNewName;
      if (cleanUserId && !state.tournament.winner.userId) state.tournament.winner.userId = cleanUserId;
    }
  }

  // 2. Update Popcorn bongs
  state.popcorn.bongs.forEach((b) => {
    if ((cleanUserId && b.clientToken === cleanUserId) || (cleanOldName && b.userName && b.userName.toLowerCase() === cleanOldName.toLowerCase())) {
      b.userName = cleanNewName;
      if (cleanUserId && !b.clientToken) b.clientToken = cleanUserId;
      changesMade = true;
    }
  });

  // 3. Update Alpha interests
  state.alphaInterests.forEach((a) => {
    if ((cleanUserId && a.userId === cleanUserId) || (cleanOldName && a.firstName.toLowerCase() === cleanOldName.toLowerCase())) {
      a.firstName = cleanNewName;
      if (cleanUserId && !a.userId) a.userId = cleanUserId;
      changesMade = true;
    }
  });

  saveState();
  res.json({ success: true, newName: cleanNewName, changesMade, state });
});

// Get user combined activity status (Public)
app.get('/api/user/status', (req, res) => {
  const userId = req.query.userId as string;
  const userName = req.query.userName as string;
  const cleanUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : null;
  const cleanUserName = typeof userName === 'string' && userName.trim() ? userName.trim() : null;

  const participant = state.tournament.participants.find(
    (p) => (cleanUserId && p.userId === cleanUserId) || (cleanUserName && p.firstName.toLowerCase() === cleanUserName.toLowerCase())
  ) || null;

  const popcornBong = state.popcorn.bongs.find(
    (b) => (cleanUserId && b.clientToken === cleanUserId) || (cleanUserName && b.userName && b.userName.toLowerCase() === cleanUserName.toLowerCase())
  ) || null;

  const alphaInterest = state.alphaInterests.find(
    (a) => (cleanUserId && a.userId === cleanUserId) || (cleanUserName && a.firstName.toLowerCase() === cleanUserName.toLowerCase())
  ) || null;

  res.json({
    success: true,
    status: {
      userId: cleanUserId,
      firstName: cleanUserName || participant?.firstName || popcornBong?.userName || alphaInterest?.firstName || null,
      tableTennis: {
        isRegistered: Boolean(participant),
        participant,
      },
      popcorn: {
        bong: popcornBong,
      },
      alpha: {
        isInterested: Boolean(alphaInterest),
        interest: alphaInterest,
      },
    },
  });
});

// Reset Alpha interests (Admin)
app.post('/api/alpha/reset', requireAdmin, (req, res) => {
  state.alphaInterests = [];
  saveState();
  res.json({ success: true, state });
});

// ----------------------------------------------------
// DIGITAL POPCORN BONG ROUTES
// ----------------------------------------------------

// User activates popcorn bong (Public)
app.post('/api/popcorn/activate', (req, res) => {
  const { clientToken, userName } = req.body;
  const trimmedName = typeof userName === 'string' && userName.trim() ? userName.trim() : null;

  // 1. If user already has an active or used bong with this userName (unless anonymous/guest), return it
  if (trimmedName && trimmedName.toLowerCase() !== 'gjest' && !trimmedName.toLowerCase().startsWith('gjest_')) {
    const existingByName = state.popcorn.bongs.find(
      (b) => b.userName && b.userName.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existingByName) {
      return res.json({ success: true, bong: existingByName, state, alreadyActivated: true });
    }
  }

  // 2. If client token already has a bong
  if (clientToken) {
    const existingByToken = state.popcorn.bongs.find((b) => b.clientToken === clientToken);
    if (existingByToken) {
      return res.json({ success: true, bong: existingByToken, state, alreadyActivated: true });
    }
  }

  // 3. Find lowest available blank bong (strictly chronological #1, #2, #3...)
  const availableBong = state.popcorn.bongs
    .filter((b) => b.status === 'blank' && b.number <= state.popcorn.totalCapacity)
    .sort((a, b) => a.number - b.number)[0];

  if (!availableBong) {
    return res.status(400).json({
      error: `Alle de ${state.popcorn.totalCapacity} popcornbongene er delt ut.`,
      code: 'ALL_CLAIMED',
      totalCapacity: state.popcorn.totalCapacity,
    });
  }

  // 4. Atomically assign next chronological number
  availableBong.status = 'activated';
  availableBong.activatedAt = new Date().toISOString();
  availableBong.clientToken = clientToken || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  availableBong.userName = trimmedName || null;

  state.event.popcornClaimedCount = state.popcorn.bongs.filter(
    (b) => b.status === 'activated' || b.status === 'used'
  ).length;

  saveState();
  res.json({ success: true, bong: availableBong, state });
});

// Get user's active bong (Public)
app.get('/api/popcorn/my-bong', (req, res) => {
  const clientToken = req.query.clientToken as string;
  const userName = req.query.userName as string;
  const trimmedName = typeof userName === 'string' && userName.trim() ? userName.trim() : null;

  let bong = null;
  if (trimmedName && trimmedName.toLowerCase() !== 'gjest' && !trimmedName.toLowerCase().startsWith('gjest_')) {
    bong = state.popcorn.bongs.find(
      (b) => b.userName && b.userName.toLowerCase() === trimmedName.toLowerCase()
    ) || null;
  }
  if (!bong && clientToken) {
    bong = state.popcorn.bongs.find((b) => b.clientToken === clientToken) || null;
  }

  res.json({ success: true, bong });
});

// Staff redeems/delivers popcorn (Admin)
app.post('/api/popcorn/redeem', requireAdmin, (req, res) => {
  const { bongNumber } = req.body;
  const num = Number(bongNumber);
  const bong = state.popcorn.bongs.find((b) => b.number === num);

  if (!bong) {
    return res.status(404).json({ error: `Bong #${num} finnes ikke.` });
  }

  if (bong.status === 'blank') {
    return res.status(400).json({
      error: `Bong #${num} er ikke aktivert enda. Ungdommen må først trykke "TA MOT POPCORN".`,
    });
  }

  if (bong.status === 'used') {
    return res.status(400).json({
      error: '⚠️ DENNE BONGEN ER ALLEREDE BRUKT',
      alreadyUsed: true,
      usedAt: bong.usedAt,
    });
  }

  // Atomically mark as used
  bong.status = 'used';
  bong.usedAt = new Date().toISOString();
  saveState();

  res.json({ success: true, bong, state });
});

// Admin adds +10 (or custom count) bongs (Admin)
app.post('/api/popcorn/add-capacity', requireAdmin, (req, res) => {
  const addCount = Number(req.body?.count) || 10;
  const startNum = state.popcorn.totalCapacity + 1;
  const endNum = state.popcorn.totalCapacity + addCount;

  for (let i = startNum; i <= endNum; i++) {
    state.popcorn.bongs.push({
      number: i,
      status: 'blank',
    });
  }

  state.popcorn.totalCapacity = endNum;
  state.event.freePopcornLimit = endNum;
  saveState();

  res.json({
    success: true,
    added: addCount,
    newRange: `#${startNum}–#${endNum}`,
    totalCapacity: endNum,
    state,
  });
});

// Reset Popcorn (Admin)
app.post('/api/popcorn/reset', requireAdmin, (req, res) => {
  state.popcorn = {
    totalCapacity: 100,
    bongs: Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      status: 'blank',
    })),
  };
  state.event.freePopcornLimit = 100;
  state.event.popcornClaimedCount = 0;
  saveState();

  res.json({ success: true, state });
});

// Toggle activity status (Admin)
app.post('/api/activity/toggle', requireAdmin, (req, res) => {
  const { id, enabled } = req.body;
  const act = state.activities.find((a) => a.id === id);
  if (!act) return res.status(404).json({ error: 'Aktivitet ikke funnet.' });

  act.enabled = Boolean(enabled);
  saveState();
  res.json({ success: true, activity: act, state });
});

// Reset test data (Popcorn, Tournament, Alpha) while preserving event info (Admin)
app.post('/api/admin/reset-testdata', requireAdmin, (req, res) => {
  // 1. Reset popcorn
  state.popcorn = {
    totalCapacity: 100,
    bongs: Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      status: 'blank',
    })),
  };
  state.event.freePopcornLimit = 100;
  state.event.popcornClaimedCount = 0;

  // 2. Reset tournament
  state.tournament = {
    id: 'tour-lillesand-2026',
    status: 'registration',
    startedAt: null,
    completedAt: null,
    participants: [],
    matches: [],
    winner: null,
    estimatedMinutesPerMatch: 10,
  };

  // 3. Reset Alpha interests
  state.alphaInterests = [];

  saveState();
  res.json({ success: true, state });
});

// Reset entire database to initial state (Admin)
app.post('/api/admin/reset-all', requireAdmin, (req, res) => {
  state = JSON.parse(JSON.stringify(INITIAL_STATE));
  saveState();
  res.json({ success: true, state });
});

// ----------------------------------------------------
// VITE OR STATIC SERVING
// ----------------------------------------------------

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lillesand United server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
