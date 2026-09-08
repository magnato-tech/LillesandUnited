import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { AppState, Activity, Match, Participant, AlphaInterest, Person } from './src/types';
import {
  generateBracket,
  recordMatchResult,
  autoAssignTables,
  hasPlayedDependencies,
  invalidateDependencies,
  updateMatchStatuses,
  resetMatchResult,
  getNextCapacityTier,
  getCapacityInfo,
  resolveBracketCapacity,
} from './src/lib/tournament';
import { INITIAL_STATE, INITIAL_ACTIVITIES, INITIAL_POPCORN, SIMULATION_NAMES_16, SIMULATION_NAMES_31, generateSimulationNames, TOURNAMENT_MAX_PARTICIPANTS, TOURNAMENT_DEFAULT_CAPACITY } from './src/lib/initial-data';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const app = express();
const PORT = 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || 'United2026';
const RESET_PIN = process.env.RESET_PIN || 'ResetUnited2026';

app.use(express.json());

// Firebase Firestore setup
let firestoreDb: any = null;
let firebaseConfig: any = null;
let lastFirestoreSyncTime: string | null = null;
let firestoreSyncError: string | null = null;

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const fbApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    firestoreDb = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
    console.log('[Firestore] Initialized Firestore client for DB:', firebaseConfig.firestoreDatabaseId);
  }
} catch (err) {
  console.error('[Firestore] Initialization error:', err);
}

function isValidAdminPin(pin: unknown): boolean {
  return typeof pin === 'string' && pin.length > 0 && pin === ADMIN_PIN;
}

function isValidResetPin(pin: unknown): boolean {
  return typeof pin === 'string' && pin.length > 0 && pin === RESET_PIN;
}

function getResetPinFromRequest(req: express.Request): unknown {
  return req.body?.resetPin ?? req.headers['x-reset-pin'];
}

// Admin authentication middleware
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const pin = req.headers['x-admin-pin'] || req.query.adminPin || (req.body && req.body.adminPin);
  if (isValidAdminPin(pin)) {
    return next();
  }
  return res.status(401).json({ error: 'Uautorisert: Krever gyldig admin-PIN' });
}

// File persistence setup
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function mergeActivitiesFromDisk(stored: Activity[] | undefined, defaults: Activity[]): Activity[] {
  const storedById = new Map(
    (stored || []).filter((a) => a && a.id).map((a) => [a.id, a])
  );
  const merged = defaults.map((def) => {
    const saved = storedById.get(def.id);
    return saved ? { ...def, ...saved, id: def.id } : { ...def };
  });
  for (const saved of stored || []) {
    if (saved?.id && !defaults.some((d) => d.id === saved.id)) {
      merged.push(saved);
    }
  }
  return merged;
}

function mergeEventFromDisk(
  stored: AppState['event'] | undefined,
  defaults: AppState['event'],
  popcorn: { totalCapacity: number },
  activeCount: number
): AppState['event'] {
  return {
    ...defaults,
    ...(stored && typeof stored === 'object' ? stored : {}),
    freePopcornLimit: popcorn.totalCapacity ?? stored?.freePopcornLimit ?? defaults.freePopcornLimit,
    popcornClaimedCount: activeCount,
  };
}

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

      const rawPersons = Array.isArray(parsed.persons) ? parsed.persons : [];
      let personsMigrated = false;
      const nameMaxNumber: Record<string, number> = {};

      for (const p of rawPersons) {
        const key = (p.firstName || '').toLowerCase();
        if (typeof p.nameNumber === 'number' && p.displayId) {
          nameMaxNumber[key] = Math.max(nameMaxNumber[key] || 0, p.nameNumber);
        }
      }

      const persons: Person[] = rawPersons.map((p: any) => {
        const key = (p.firstName || '').toLowerCase();
        let nameNumber = p.nameNumber;
        let displayId = p.displayId;

        if (typeof nameNumber !== 'number' || !displayId) {
          const next = (nameMaxNumber[key] || 0) + 1;
          nameMaxNumber[key] = next;
          nameNumber = next;
          displayId = `${p.firstName}_${next}`;
          personsMigrated = true;
        }

        return {
          id: p.id,
          firstName: p.firstName,
          nameNumber,
          displayId,
          anonymousToken: p.anonymousToken,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          isSimulated: Boolean(p.isSimulated),
        };
      });

      const loadedState = {
        ...parsed,
        event: mergeEventFromDisk(parsed.event, INITIAL_STATE.event, popcorn, activeCount),
        popcorn,
        activities: mergeActivitiesFromDisk(parsed.activities, INITIAL_ACTIVITIES),
        persons,
      };

      const cap = loadedState.tournament?.bracketCapacity;
      if (cap !== 16 && cap !== 32 && cap !== 64) {
        loadedState.tournament = {
          ...loadedState.tournament,
          bracketCapacity: TOURNAMENT_DEFAULT_CAPACITY,
        };
      }

      if (personsMigrated) {
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(loadedState, null, 2), 'utf-8');
        } catch (e) {
          console.error('Failed to write back migrated persons:', e);
        }
      }

      return loadedState;
    }
  } catch (err) {
    console.error('Error loading db.json, using initial state:', err);
  }
  return JSON.parse(JSON.stringify(INITIAL_STATE));
}

let state: AppState = loadState();

function saveLocalStateOnly() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save state to db.json:', err);
  }
}

async function syncToFirestoreCollections(targetState: AppState) {
  if (!firestoreDb) return;
  try {
    // 1. App state snapshot document
    const cleanState = cleanForFirestore({
      ...targetState,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(firestoreDb, 'appState', 'current'), cleanState);

    // 2. Connection test doc
    await setDoc(doc(firestoreDb, 'test', 'connection'), {
      id: 'connection',
      connectedAt: new Date().toISOString(),
    });

    // 3. Persons collection
    if (Array.isArray(targetState.persons)) {
      for (const p of targetState.persons) {
        if (p && p.id) {
          await setDoc(doc(firestoreDb, 'persons', p.id), cleanForFirestore(p));
        }
      }
    }

    // 4. Activities collection
    if (Array.isArray(targetState.activities)) {
      for (const a of targetState.activities) {
        if (a && a.id) {
          await setDoc(doc(firestoreDb, 'activities', a.id), cleanForFirestore(a));
        }
      }
    }

    // 5. Alpha interests collection
    if (Array.isArray(targetState.alphaInterests)) {
      for (const alpha of targetState.alphaInterests) {
        if (alpha && alpha.id) {
          await setDoc(doc(firestoreDb, 'alphaInterests', alpha.id), cleanForFirestore(alpha));
        }
      }
    }

    lastFirestoreSyncTime = new Date().toISOString();
    firestoreSyncError = null;
    console.log('[Firestore] Successfully synchronized state to Firestore at', lastFirestoreSyncTime);
  } catch (err: any) {
    firestoreSyncError = err?.message || String(err);
    console.error('[Firestore] Error syncing state to Firestore:', err);
    throw err;
  }
}

async function initFirestoreAndMigrate() {
  if (!firestoreDb) {
    console.warn('[Firestore] No firestoreDb initialized, running in local mode.');
    return;
  }
  try {
    console.log('[Firestore] Checking for existing state in Firestore...');
    const stateDocRef = doc(firestoreDb, 'appState', 'current');
    const snap = await getDoc(stateDocRef);
    if (snap.exists()) {
      const remoteState = snap.data() as AppState;
      if (remoteState && remoteState.event && remoteState.tournament) {
        console.log('[Firestore] Loaded existing state from Firestore! Persons:', remoteState.persons?.length || 0);
        state = remoteState;
        saveLocalStateOnly();
        lastFirestoreSyncTime = new Date().toISOString();
        return;
      }
    }

    console.log('[Firestore] No remote state found in Firestore. Migrating current local data (db.json) to Firestore...');
    await syncToFirestoreCollections(state);
    console.log('[Firestore] Migration to Firestore finished successfully!');
  } catch (err: any) {
    firestoreSyncError = err?.message || String(err);
    console.error('[Firestore] Initial Firestore sync/migration failed:', err);
  }
}

function cleanForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}

let firestoreSaveTimeout: NodeJS.Timeout | null = null;
async function saveToFirestoreNow(): Promise<void> {
  if (!firestoreDb) return;
  try {
    const payload = cleanForFirestore({
      ...state,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(firestoreDb, 'appState', 'current'), payload);
    lastFirestoreSyncTime = new Date().toISOString();
    firestoreSyncError = null;
  } catch (err: any) {
    firestoreSyncError = err?.message || String(err);
    console.error('[Firestore] Save error:', err);
  }
}

function saveState() {
  saveLocalStateOnly();

  if (firestoreDb) {
    if (firestoreSaveTimeout) clearTimeout(firestoreSaveTimeout);
    firestoreSaveTimeout = setTimeout(() => {
      saveToFirestoreNow();
    }, 50);
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/api/admin/verify-pin', (req, res) => {
  const { pin } = req.body || {};
  if (isValidAdminPin(pin)) {
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Ugyldig admin-PIN' });
});

app.get('/api/state', (req, res) => {
  res.json(state);
});

// Firestore status & sync endpoints
app.get('/api/firestore/status', (req, res) => {
  res.json({
    connected: Boolean(firestoreDb),
    projectId: firebaseConfig?.projectId || null,
    firestoreDatabaseId: firebaseConfig?.firestoreDatabaseId || null,
    lastSyncTime: lastFirestoreSyncTime,
    error: firestoreSyncError,
    mode: 'Firestore Database',
  });
});

app.post('/api/firestore/flush', async (req, res) => {
  if (firestoreSaveTimeout) {
    clearTimeout(firestoreSaveTimeout);
    firestoreSaveTimeout = null;
  }
  await saveToFirestoreNow();
  res.json({ success: true, lastSyncTime: lastFirestoreSyncTime, error: firestoreSyncError });
});

app.post('/api/admin/firestore/sync', requireAdmin, async (req, res) => {
  if (!firestoreDb) {
    return res.status(500).json({ error: 'Firestore er ikke konfigurert på serveren.' });
  }
  try {
    await syncToFirestoreCollections(state);
    res.json({
      success: true,
      message: 'Databasen er synkronisert til Firestore.',
      lastSyncTime: lastFirestoreSyncTime,
      itemCounts: {
        persons: state.persons?.length || 0,
        participants: state.tournament?.participants?.length || 0,
        matches: state.tournament?.matches?.length || 0,
        activities: state.activities?.length || 0,
        alphaInterests: state.alphaInterests?.length || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Kunne ikke synkronisere til Firestore' });
  }
});

// ----------------------------------------------------
// PERSON ROUTES
// ----------------------------------------------------

// Create a new anonymous person (Central Person Model with permanent nameNumber and displayId)
app.post('/api/persons', (req, res) => {
  const { firstName, anonymousToken } = req.body;
  if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
    return res.status(400).json({ error: 'Fornavn er påkrevd.' });
  }

  const cleanName = firstName.trim();
  const id = crypto.randomUUID();
  const token = (typeof anonymousToken === 'string' && anonymousToken.trim())
    ? anonymousToken.trim()
    : 'tok_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);

  // Synchronous sequence (Steps 1 through 6):
  // 1. Read existing persons
  if (!state.persons) {
    state.persons = [];
  }

  // 2. Find highest nameNumber for firstName (case-insensitive comparison)
  const key = cleanName.toLowerCase();
  const sameNamePersons = state.persons.filter(
    (p) => (p.firstName || '').toLowerCase() === key
  );
  const highestNumber = sameNamePersons.reduce(
    (max, p) => Math.max(max, typeof p.nameNumber === 'number' ? p.nameNumber : 0),
    0
  );

  // 3. Compute next sequential number and displayId
  const nextNumber = highestNumber + 1;
  const displayId = `${cleanName}_${nextNumber}`;

  // 4. Create Person entity with persistent nameNumber and displayId
  const now = new Date().toISOString();
  const person: Person = {
    id,
    firstName: cleanName,
    nameNumber: nextNumber,
    displayId,
    anonymousToken: token,
    createdAt: now,
    updatedAt: now,
    isSimulated: false,
  };

  // 5. Synchronously append to state
  state.persons.push(person);

  // 6. Synchronously flush to disk
  saveState();

  res.json({ success: true, person, state });
});

// Get all persons (Public - used by person selector)
app.get('/api/persons', (req, res) => {
  res.json({ success: true, persons: state.persons || [] });
});

// Get single person by ID
app.get('/api/persons/:id', (req, res) => {
  const person = (state.persons || []).find((p) => p.id === req.params.id);
  if (!person) {
    return res.status(404).json({ error: 'Person ikke funnet.' });
  }
  res.json({ success: true, person });
});

// Register participant for Table tennis
app.post('/api/register', (req, res) => {
  const { firstName, userId, personId, anonymousToken } = req.body;
  const cleanPersonId = typeof personId === 'string' && personId.trim() ? personId.trim() : null;
  const cleanUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : undefined;
  const cleanToken = typeof anonymousToken === 'string' && anonymousToken.trim() ? anonymousToken.trim() : null;
  const cleanName = typeof firstName === 'string' && firstName.trim() ? firstName.trim() : '';

  let resolvedPerson: Person | null = null;

  if (cleanPersonId) {
    resolvedPerson = (state.persons || []).find((p) => p.id === cleanPersonId) || null;
    if (!resolvedPerson) {
      console.warn(`[/api/register] Person with personId "${cleanPersonId}" not found in state.persons.`);
      return res.status(404).json({ error: 'Personen ble ikke funnet. Vennligst velg eller opprett profil på nytt.' });
    }
  } else {
    // Legacy fallback path: personId is missing
    // Rule: Attempt to find unambiguous existing Person; NEVER silently create a new Person.
    console.warn(`[/api/register] Legacy call received without personId. Payload:`, { firstName, userId });

    if (cleanToken) {
      const matchByToken = (state.persons || []).filter((p) => p.anonymousToken === cleanToken);
      if (matchByToken.length === 1) {
        resolvedPerson = matchByToken[0];
      }
    }

    if (!resolvedPerson && cleanName) {
      const matchesByName = (state.persons || []).filter(
        (p) => p.firstName.toLowerCase() === cleanName.toLowerCase()
      );
      if (matchesByName.length === 1) {
        resolvedPerson = matchesByName[0];
      } else if (matchesByName.length > 1) {
        console.error(`[/api/register] Ambiguous match: ${matchesByName.length} persons found with name "${cleanName}". Cannot resolve personId automatically.`);
        return res.status(400).json({
          error: `Det finnes flere profiler med fornavn "${cleanName}". Vennligst velg din spesifikke profil (f.eks. ${matchesByName[0].displayId}).`,
          ambiguous: true,
        });
      }
    }

    if (!resolvedPerson) {
      console.error(`[/api/register] Rejected legacy call: No matching Person found for name="${cleanName}" / token="${cleanToken}". Silent person creation is forbidden.`);
      return res.status(400).json({
        error: 'Ugyldig påmelding: Ingen eksisterende profil funnet. Du må velge hvem du er før du melder deg på.',
      });
    }
  }

  // Idempotency check:
  // Check if this Person (or legacy participant) is already registered
  const existing = state.tournament.participants.find(
    (p) =>
      (resolvedPerson && p.personId === resolvedPerson.id) ||
      (cleanUserId && p.userId === cleanUserId)
  );

  if (existing) {
    if (resolvedPerson) {
      existing.personId = resolvedPerson.id;
      existing.displayId = resolvedPerson.displayId;
      existing.firstName = resolvedPerson.firstName;
    }
    if (cleanUserId && !existing.userId) {
      existing.userId = cleanUserId;
    }
    saveState();
    return res.json({ success: true, participant: existing, state, alreadyRegistered: true });
  }

  const registrationCapacity = state.tournament.bracketCapacity ?? TOURNAMENT_DEFAULT_CAPACITY;
  if (
    state.tournament.status === 'registration' &&
    state.tournament.participants.length >= registrationCapacity
  ) {
    return res.status(400).json({
      error: `Cupen er full (${registrationCapacity} spillere). Be admin utvide cup-størrelsen.`,
    });
  }

  const participant: Participant = {
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    personId: resolvedPerson ? resolvedPerson.id : null,
    displayId: resolvedPerson ? resolvedPerson.displayId : cleanName,
    firstName: resolvedPerson ? resolvedPerson.firstName : cleanName,
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

    const capacity = resolveBracketCapacity(
      state.tournament.participants.length,
      state.tournament.bracketCapacity ?? TOURNAMENT_DEFAULT_CAPACITY
    );
    const minPlayers = Math.max(2, Math.floor(capacity / 2));
    if (state.tournament.participants.length < minPlayers) {
      return res.status(400).json({
        error: `Minst ${minPlayers} spillere kreves for å starte ${capacity}-spiller cupen (${capacity / 2} kamper i runde 1).`,
      });
    }

    const matches = generateBracket(state.tournament.participants, capacity as any);
    state.tournament.bracketCapacity = capacity as any;
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

    const capacity = resolveBracketCapacity(
      state.tournament.participants.length,
      state.tournament.bracketCapacity ?? TOURNAMENT_DEFAULT_CAPACITY
    );
    const matches = generateBracket(state.tournament.participants, capacity as any);
    state.tournament.bracketCapacity = capacity as any;
    state.tournament.matches = matches;
    state.tournament.status = 'active';
    state.tournament.winner = null;
    state.tournament.completedAt = null;
    state.tournament.startedAt = new Date().toISOString();

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

    const match = state.tournament.matches.find((m) => m.id === matchId);
    if (!match) {
      return res.status(404).json({ error: 'Kamp ikke funnet.' });
    }

    // Controlled conflict handling: prevent silent overwriting of already completed matches
    if (match.status === 'completed' || match.status === 'walkover') {
      return res.status(409).json({
        error: 'Kampen er allerede registrert som fullført. Bruk korrigeringsfunksjonen for å endre resultat.',
        conflict: true,
        currentStatus: match.status,
      });
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

// Reset match result (Admin)
app.post('/api/tournament/match/reset', requireAdmin, (req, res) => {
  try {
    const { matchId, confirmReset } = req.body;
    const match = state.tournament.matches.find((m) => m.id === matchId);
    if (!match) return res.status(404).json({ error: 'Kamp ikke funnet.' });

    const hasDeps = hasPlayedDependencies(matchId, state.tournament.matches);
    if (hasDeps && !confirmReset) {
      return res.status(409).json({
        requiresConfirmation: true,
        warning:
          'Senere kamper i turneringen har allerede resultat eller pågår. Nullstilling vil også tilbakestille disse kampene.',
      });
    }

    const { updatedMatches, tournamentWinner } = resetMatchResult(state.tournament.matches, matchId);
    state.tournament.matches = updatedMatches;
    state.tournament.winner = tournamentWinner;
    if (!tournamentWinner && state.tournament.status === 'completed') {
      state.tournament.status = 'active';
      state.tournament.completedAt = null;
    }

    saveState();
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Feil ved nullstilling av resultat' });
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

// Reset tournament (Admin + reset PIN)
app.post('/api/tournament/reset', requireAdmin, (req, res) => {
  if (!isValidResetPin(getResetPinFromRequest(req))) {
    return res.status(403).json({ error: 'Ugyldig eller manglende nullstillings-PIN.' });
  }

  const { keepParticipants } = req.body;
  state.tournament.status = 'registration';
  state.tournament.startedAt = null;
  state.tournament.completedAt = null;
  state.tournament.matches = [];
  state.tournament.winner = null;

  if (!keepParticipants) {
    state.tournament.participants = [];
    state.tournament.bracketCapacity = TOURNAMENT_DEFAULT_CAPACITY;
  }

  saveState();
  res.json({ success: true, state });
});

// Expand bracket capacity (Admin) — only during registration, doubles each step: 16 → 32 → 64
app.patch('/api/tournament/capacity', requireAdmin, (req, res) => {
  if (state.tournament.status !== 'registration') {
    return res.status(400).json({ error: 'Cup-størrelse kan bare endres under påmelding.' });
  }

  const current = resolveBracketCapacity(
    state.tournament.participants.length,
    state.tournament.bracketCapacity ?? TOURNAMENT_DEFAULT_CAPACITY
  );
  const nextTier = getNextCapacityTier(current);
  const requested = Number(req.body?.capacity);

  if (!nextTier) {
    return res.status(400).json({ error: 'Cupen er allerede på maksimal størrelse (64 spillere).' });
  }

  if (requested !== nextTier) {
    return res.status(400).json({
      error: `Du kan bare utvide til ${nextTier} spillere (${nextTier / 2} kamper i runde 1).`,
    });
  }

  state.tournament.bracketCapacity = nextTier;
  saveState();
  res.json({ success: true, state });
});

// Simulation generator (Admin)
app.post('/api/tournament/simulate', requireAdmin, (req, res) => {
  const requested = Number(req.body?.count) || 16;
  const count = Math.min(Math.max(Math.floor(requested), 2), TOURNAMENT_MAX_PARTICIPANTS);
  const names = generateSimulationNames(count);

  if (!state.persons) {
    state.persons = [];
  }

  const participants: Participant[] = [];
  const now = new Date();

  names.forEach((name, i) => {
    const cleanName = name.trim();
    const id = crypto.randomUUID();
    const token = 'tok_sim_' + crypto.randomUUID().replace(/-/g, '').substring(0, 12);

    // Compute sequential nameNumber for this name
    const key = cleanName.toLowerCase();
    const sameNamePersons = state.persons.filter(
      (p) => (p.firstName || '').toLowerCase() === key
    );
    const highestNumber = sameNamePersons.reduce(
      (max, p) => Math.max(max, typeof p.nameNumber === 'number' ? p.nameNumber : 0),
      0
    );
    const nextNumber = highestNumber + 1;
    const displayId = `${cleanName}_${nextNumber}`;

    const createdAt = new Date(now.getTime() - (names.length - i) * 60000).toISOString();
    const person: Person = {
      id,
      firstName: cleanName,
      nameNumber: nextNumber,
      displayId,
      anonymousToken: token,
      createdAt,
      updatedAt: createdAt,
      isSimulated: true, // Marked explicitly as simulated test person
    };

    state.persons.push(person);

    participants.push({
      id: `sim_${i + 1}_${Math.random().toString(36).substring(2, 6)}`,
      personId: person.id,
      displayId: person.displayId,
      firstName: person.firstName,
      registeredAt: createdAt,
    });
  });

  state.tournament.participants = participants;
  const simCapacity: 16 | 32 | 64 =
    count <= 16 ? 16 : count <= 32 ? 32 : 64;
  state.tournament.bracketCapacity = simCapacity;
  const matches = generateBracket(participants, simCapacity);
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
  const { firstName, phone, notes, userId, personId } = req.body;
  const cleanPersonId = typeof personId === 'string' && personId.trim() ? personId.trim() : null;

  let resolvedPerson: Person | null = null;
  if (cleanPersonId) {
    resolvedPerson = (state.persons || []).find((p) => p.id === cleanPersonId) || null;
    if (!resolvedPerson) {
      return res.status(404).json({ error: 'Personen ble ikke funnet.' });
    }
  }

  const effectiveName = resolvedPerson ? resolvedPerson.firstName : firstName;
  if (!effectiveName || typeof effectiveName !== 'string' || !effectiveName.trim()) {
    return res.status(400).json({ error: 'Fornavn er påkrevd.' });
  }

  const cleanName = effectiveName.trim();
  const cleanUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : undefined;

  // Check if already registered by personId, userId, or name
  const existing = state.alphaInterests.find(
    (a) =>
      (cleanPersonId && a.personId === cleanPersonId) ||
      (cleanUserId && a.userId === cleanUserId) ||
      a.firstName.toLowerCase() === cleanName.toLowerCase()
  );
  if (existing) {
    if (cleanPersonId && !existing.personId) {
      existing.personId = cleanPersonId;
    }
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
    personId: cleanPersonId || undefined,
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
  const personId = req.query.personId as string;
  const cleanPersonId = typeof personId === 'string' && personId.trim() ? personId.trim() : null;
  const cleanUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : null;
  const cleanUserName = typeof userName === 'string' && userName.trim() ? userName.trim() : null;

  const participant = state.tournament.participants.find(
    (p) =>
      (cleanPersonId && p.personId === cleanPersonId) ||
      (cleanUserId && p.userId === cleanUserId) ||
      (!cleanPersonId && cleanUserName && p.firstName.toLowerCase() === cleanUserName.toLowerCase())
  ) || null;

  const popcornBong = state.popcorn.bongs.find(
    (b) => (cleanPersonId && b.personId === cleanPersonId) ||
           (cleanUserId && b.clientToken === cleanUserId) ||
           (!cleanPersonId && cleanUserName && b.userName && b.userName.toLowerCase() === cleanUserName.toLowerCase())
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
  const { personId, anonymousToken, clientToken, userName } = req.body;
  const cleanPersonId = typeof personId === 'string' && personId.trim() ? personId.trim() : null;
  const cleanToken = typeof anonymousToken === 'string' && anonymousToken.trim()
    ? anonymousToken.trim()
    : typeof clientToken === 'string' && clientToken.trim()
    ? clientToken.trim()
    : null;
  const trimmedName = typeof userName === 'string' && userName.trim() ? userName.trim() : null;

  // 1. Primary technical lookup by Person.id
  if (cleanPersonId) {
    const person = (state.persons || []).find((p) => p.id === cleanPersonId);
    if (!person) {
      return res.status(404).json({ error: 'Person ikke funnet.' });
    }

    // Check if this specific Person already has an active or used bong
    const existingForPerson = state.popcorn.bongs.find((b) => b.personId === cleanPersonId);
    if (existingForPerson) {
      return res.json({ success: true, bong: existingForPerson, state, alreadyActivated: true });
    }

    // Find lowest available blank bong (chronological #1, #2, #3...)
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

    // Synchronously assign to person
    availableBong.status = 'activated';
    availableBong.activatedAt = new Date().toISOString();
    availableBong.personId = person.id; // Primary technical ID
    availableBong.userName = person.displayId; // Unikt visningsnavn (Oliver_1, Oliver_2 …)
    availableBong.clientToken = cleanToken || person.anonymousToken;

    state.event.popcornClaimedCount = state.popcorn.bongs.filter(
      (b) => b.status === 'activated' || b.status === 'used'
    ).length;

    saveState();
    return res.json({ success: true, bong: availableBong, state });
  }

  // 2. Legacy fallback if no personId was provided
  let resolvedLegacyPerson: (typeof state.persons)[number] | null = null;
  if (trimmedName && trimmedName.toLowerCase() !== 'gjest' && !trimmedName.toLowerCase().startsWith('gjest_')) {
    const personsByDisplayId = (state.persons || []).filter(
      (p) => p.displayId.toLowerCase() === trimmedName.toLowerCase()
    );
    const personsByFirstName = (state.persons || []).filter(
      (p) => p.firstName.toLowerCase() === trimmedName.toLowerCase()
    );

    if (personsByFirstName.length > 1 && personsByDisplayId.length === 0) {
      return res.status(400).json({
        error: `Det finnes flere profiler med fornavn "${trimmedName}". Velg din spesifikke profil (f.eks. ${personsByFirstName[0].displayId}).`,
        code: 'AMBIGUOUS_NAME',
      });
    }

    resolvedLegacyPerson =
      personsByDisplayId.length === 1
        ? personsByDisplayId[0]
        : personsByFirstName.length === 1
        ? personsByFirstName[0]
        : null;

    if (resolvedLegacyPerson) {
      const existingForPerson = state.popcorn.bongs.find(
        (b) => b.personId === resolvedLegacyPerson!.id
      );
      if (existingForPerson) {
        return res.json({ success: true, bong: existingForPerson, state, alreadyActivated: true });
      }
    } else {
      const existingByName = state.popcorn.bongs.find(
        (b) => b.userName && b.userName.toLowerCase() === trimmedName.toLowerCase()
      );
      if (existingByName) {
        return res.json({ success: true, bong: existingByName, state, alreadyActivated: true });
      }
    }
  }

  if (cleanToken) {
    const existingByToken = state.popcorn.bongs.find((b) => b.clientToken === cleanToken);
    if (existingByToken) {
      return res.json({ success: true, bong: existingByToken, state, alreadyActivated: true });
    }
  }

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

  availableBong.status = 'activated';
  availableBong.activatedAt = new Date().toISOString();
  availableBong.clientToken = cleanToken || resolvedLegacyPerson?.anonymousToken || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  if (resolvedLegacyPerson) {
    availableBong.personId = resolvedLegacyPerson.id;
    availableBong.userName = resolvedLegacyPerson.displayId;
  } else {
    availableBong.userName = trimmedName || null;
  }

  state.event.popcornClaimedCount = state.popcorn.bongs.filter(
    (b) => b.status === 'activated' || b.status === 'used'
  ).length;

  saveState();
  res.json({ success: true, bong: availableBong, state });
});

// Get user's active bong (Public)
app.get('/api/popcorn/my-bong', (req, res) => {
  const personId = req.query.personId as string;
  const clientToken = req.query.clientToken as string;
  const userName = req.query.userName as string;
  const cleanPersonId = typeof personId === 'string' && personId.trim() ? personId.trim() : null;
  const trimmedName = typeof userName === 'string' && userName.trim() ? userName.trim() : null;

  let bong = null;
  // 1. Primary lookup by Person.id
  if (cleanPersonId) {
    bong = state.popcorn.bongs.find((b) => b.personId === cleanPersonId) || null;
  }
  // 2. Fallback to clientToken
  if (!bong && clientToken) {
    bong = state.popcorn.bongs.find((b) => b.clientToken === clientToken) || null;
  }
  // 3. Fallback to legacy userName (kun unikt displayId eller enkelt fornavn)
  if (!bong && trimmedName && trimmedName.toLowerCase() !== 'gjest' && !trimmedName.toLowerCase().startsWith('gjest_')) {
    const byDisplayId = state.popcorn.bongs.find(
      (b) => b.userName && b.userName.toLowerCase() === trimmedName.toLowerCase()
    );
    if (byDisplayId) {
      bong = byDisplayId;
    } else {
      const personsByFirstName = (state.persons || []).filter(
        (p) => p.firstName.toLowerCase() === trimmedName.toLowerCase()
      );
      if (personsByFirstName.length === 1) {
        bong = state.popcorn.bongs.find((b) => b.personId === personsByFirstName[0].id) || null;
      }
    }
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

// Update event/program info (Admin)
app.patch('/api/event', requireAdmin, (req, res) => {
  const { name, date, time, location, organizers } = req.body;

  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'Arrangementsnavn kan ikke være tomt.' });
    state.event.name = String(name).trim();
  }
  if (date !== undefined) state.event.date = String(date).trim();
  if (time !== undefined) state.event.time = String(time).trim();
  if (location !== undefined) state.event.location = String(location).trim();
  if (organizers !== undefined) {
    state.event.organizers = Array.isArray(organizers)
      ? organizers.map((o) => String(o).trim()).filter(Boolean)
      : String(organizers)
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);
  }

  saveState();
  res.json({ success: true, event: state.event, state });
});

// Update activity content (Admin)
app.patch('/api/activities/:id', requireAdmin, (req, res) => {
  const act = state.activities.find((a) => a.id === req.params.id);
  if (!act) return res.status(404).json({ error: 'Aktivitet ikke funnet.' });

  const { name, shortDesc, fullDesc, time, location, badge, enabled } = req.body;

  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'Aktivitetsnavn kan ikke være tomt.' });
    act.name = String(name).trim();
  }
  if (shortDesc !== undefined) act.shortDesc = String(shortDesc).trim();
  if (fullDesc !== undefined) act.fullDesc = String(fullDesc).trim();
  if (time !== undefined) act.time = String(time).trim();
  if (location !== undefined) act.location = String(location).trim();
  if (badge !== undefined) act.badge = String(badge).trim() || undefined;
  if (enabled !== undefined) act.enabled = Boolean(enabled);

  saveState();
  res.json({ success: true, activity: act, state });
});

// Reset test data (Popcorn, Tournament, Alpha, and Simulated Persons) while preserving event info and real persons (Admin)
app.post('/api/admin/reset-testdata', requireAdmin, (req, res) => {
  // 1. Reset popcorn
  state.popcorn = {
    totalCapacity: 100,
    bongs: Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      status: 'blank',
      userName: null,
      clientToken: null,
      personId: null,
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
    bracketCapacity: 16,
  };

  // 3. Reset Alpha interests
  state.alphaInterests = [];

  // 4. Clean simulated persons, strictly preserving all real persons (isSimulated = false / undefined)
  if (state.persons && Array.isArray(state.persons)) {
    state.persons = state.persons.filter((p) => !p.isSimulated);
  }

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
// SEO / SEARCH ENGINE INDEXING
// ----------------------------------------------------

function getSiteUrl(req: express.Request): string {
  const appUrl = process.env.APP_URL;
  if (appUrl && appUrl !== 'MY_APP_URL') {
    return appUrl.replace(/\/$/, '');
  }
  const host = req.get('host');
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  return `${protocol}://${host}`;
}

app.get('/robots.txt', (req, res) => {
  const base = getSiteUrl(req);
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (req, res) => {
  const base = getSiteUrl(req);
  const lastmod = new Date().toISOString().split('T')[0];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
});

// ----------------------------------------------------
// VITE OR STATIC SERVING
// ----------------------------------------------------

async function start() {
  // Initialize Firestore connection and migrate/sync data
  await initFirestoreAndMigrate();

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
