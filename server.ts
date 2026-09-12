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
  DEFAULT_FORMAT_SETTINGS,
  normalizeFormatSettings,
  normalizeStageFormatConfig,
  resolveMatchFormat,
  tournamentHasCupData,
  resolveDrawCapacity,
} from './src/lib/tournament';
import { INITIAL_STATE, INITIAL_ACTIVITIES, INITIAL_POPCORN, createEmptyAppState, SIMULATION_NAMES_16, SIMULATION_NAMES_31, generateSimulationNames, TOURNAMENT_MAX_PARTICIPANTS, TOURNAMENT_DEFAULT_CAPACITY } from './src/lib/initial-data';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

const app = express();
const PORT = 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || 'United2026';
const RESET_PIN = process.env.RESET_PIN || 'ResetUnited2026';

app.use(express.json({ limit: '256kb' }));

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

// In-memory rate limiting / brute-force protection for PIN verification
interface FailedPinAttempt {
  count: number;
  lockedUntil: number;
}
const failedPinAttempts = new Map<string, FailedPinAttempt>();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function checkPinRateLimit(ip: string): { locked: boolean; retryAfterSeconds: number } {
  const attempt = failedPinAttempts.get(ip);
  if (!attempt) return { locked: false, retryAfterSeconds: 0 };
  const now = Date.now();
  if (attempt.lockedUntil > now) {
    return { locked: true, retryAfterSeconds: Math.ceil((attempt.lockedUntil - now) / 1000) };
  }
  return { locked: false, retryAfterSeconds: 0 };
}

function recordFailedPinAttempt(ip: string): { locked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const attempt = failedPinAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  attempt.count += 1;
  if (attempt.count >= 5) {
    attempt.lockedUntil = now + 60 * 1000; // 60s cooldown after 5 failed attempts
    attempt.count = 0; // reset counter after locking
    failedPinAttempts.set(ip, attempt);
    return { locked: true, retryAfterSeconds: 60 };
  }
  failedPinAttempts.set(ip, attempt);
  return { locked: false, retryAfterSeconds: 0 };
}

function recordSuccessfulPin(ip: string) {
  failedPinAttempts.delete(ip);
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

function requireResetPin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isValidResetPin(getResetPinFromRequest(req))) {
    return res.status(403).json({ error: 'Ugyldig eller manglende nullstillings-PIN.' });
  }
  next();
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
        kioskItems: Array.isArray(parsed.kioskItems) ? parsed.kioskItems : [],
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

      if (!loadedState.updatedAt) {
        loadedState.updatedAt = new Date().toISOString();
      }

      if (personsMigrated) {
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(loadedState), 'utf-8');
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
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(state), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to save state to db.json:', err);
  }
}

async function deleteFirestoreCollection(collectionName: string): Promise<void> {
  if (!firestoreDb) return;
  const snap = await getDocs(collection(firestoreDb, collectionName));
  for (const docSnap of snap.docs) {
    await deleteDoc(docSnap.ref);
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
  state.updatedAt = new Date().toISOString();
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
  const ip = getClientIp(req);
  const status = checkPinRateLimit(ip);
  if (status.locked) {
    return res.status(429).json({
      error: `For mange feilforsøk. Prøv igjen om ${status.retryAfterSeconds} sekunder.`,
      retryAfterSeconds: status.retryAfterSeconds,
    });
  }

  const { pin } = req.body || {};
  if (isValidAdminPin(pin)) {
    recordSuccessfulPin(ip);
    return res.json({ success: true });
  }

  const failStatus = recordFailedPinAttempt(ip);
  if (failStatus.locked) {
    return res.status(429).json({
      error: `For mange feilforsøk. Låst i 60 sekunder.`,
      retryAfterSeconds: 60,
    });
  }

  return res.status(401).json({ error: 'Ugyldig admin-PIN' });
});

app.post('/api/admin/verify-reset-pin', (req, res) => {
  const ip = getClientIp(req);
  const status = checkPinRateLimit(ip);
  if (status.locked) {
    return res.status(429).json({
      error: `For mange feilforsøk. Prøv igjen om ${status.retryAfterSeconds} sekunder.`,
      retryAfterSeconds: status.retryAfterSeconds,
    });
  }

  const { pin } = req.body || {};
  if (isValidResetPin(pin)) {
    recordSuccessfulPin(ip);
    return res.json({ success: true });
  }

  const failStatus = recordFailedPinAttempt(ip);
  if (failStatus.locked) {
    return res.status(429).json({
      error: `For mange feilforsøk. Låst i 60 sekunder.`,
      retryAfterSeconds: 60,
    });
  }

  return res.status(403).json({ error: 'Ugyldig nullstillings-PIN' });
});

app.get('/api/state', (req, res) => {
  const serverEtag = `"${state.updatedAt || '0'}"`;
  res.setHeader('ETag', serverEtag);
  const clientEtag = req.headers['if-none-match'];
  if (clientEtag && clientEtag === serverEtag) {
    return res.status(304).end();
  }
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

app.post('/api/firestore/flush', requireAdmin, async (req, res) => {
  try {
    if (firestoreSaveTimeout) {
      clearTimeout(firestoreSaveTimeout);
      firestoreSaveTimeout = null;
    }
    await saveToFirestoreNow();
    res.json({ success: true, lastSyncTime: lastFirestoreSyncTime, error: firestoreSyncError });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Kunne ikke flushe til Firestore' });
  }
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

// Update person (Admin)
app.patch('/api/persons/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { firstName } = req.body || {};
  const person = (state.persons || []).find((p) => p.id === id);
  if (!person) {
    return res.status(404).json({ error: 'Person ikke funnet.' });
  }
  if (typeof firstName === 'string' && firstName.trim()) {
    const cleanName = firstName.trim();
    person.firstName = cleanName;
    person.displayId = `${cleanName}_${person.nameNumber || 1}`;
    person.updatedAt = new Date().toISOString();

    // Update in tournament participants
    for (const part of state.tournament.participants) {
      if (part.personId === person.id) {
        part.firstName = person.firstName;
        part.displayId = person.displayId;
      }
    }
    // Update in popcorn bongs
    if (state.popcorn?.bongs) {
      for (const bong of state.popcorn.bongs) {
        if (bong.personId === person.id) {
          bong.userName = person.displayId;
        }
      }
    }
    // Update in alphaInterests
    if (state.alphaInterests) {
      for (const alpha of state.alphaInterests) {
        if (alpha.personId === person.id) {
          alpha.firstName = person.firstName;
        }
      }
    }
  }
  saveState();
  res.json({ success: true, person, state });
});

// Delete person (Admin)
app.delete('/api/persons/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  state.persons = (state.persons || []).filter((p) => p.id !== id);
  // Also remove from tournament participants if registration is open
  if (state.tournament.status === 'registration') {
    state.tournament.participants = state.tournament.participants.filter((p) => p.personId !== id);
  }
  saveState();
  res.json({ success: true, state });
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
    // If the cup is full but contains simulated test players, let the real participant replace the last test player!
    const lastSimIndex = state.tournament.participants
      .map((p, idx) => ({ p, idx }))
      .filter((item) => {
        const isSimId = item.p.id?.startsWith('sim_');
        const isSimPerson = item.p.personId
          ? state.persons?.find((per) => per.id === item.p.personId)?.isSimulated
          : false;
        return isSimId || isSimPerson;
      })
      .pop()?.idx;

    if (typeof lastSimIndex === 'number' && lastSimIndex >= 0) {
      state.tournament.participants.splice(lastSimIndex, 1);
    } else {
      return res.status(400).json({
        error: `Cupen er full (${registrationCapacity} spillere). Be admin utvide cup-størrelsen.`,
      });
    }
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

// Withdraw from tournament (User or Admin)
app.post('/api/tournament/withdraw', (req, res) => {
  const { participantId, personId, anonymousToken } = req.body || {};
  const adminPin = req.headers['x-admin-pin'] || req.query.adminPin || (req.body && req.body.adminPin);
  const isAdmin = isValidAdminPin(adminPin);

  const target = state.tournament.participants.find(
    (p) => (participantId && p.id === participantId) || (personId && p.personId === personId)
  );

  if (!target) {
    return res.status(404).json({ error: 'Påmelding ikke funnet.' });
  }

  if (!isAdmin) {
    if (state.tournament.status !== 'registration') {
      return res.status(400).json({ error: 'Turneringen er allerede i gang. Kontakt arrangør for å trekke deg.' });
    }
    if (target.personId && anonymousToken) {
      const person = (state.persons || []).find((p) => p.id === target.personId);
      if (person && person.anonymousToken && person.anonymousToken !== anonymousToken) {
        return res.status(403).json({ error: 'Ugyldig tilgang til denne deltakeren.' });
      }
    }
  }

  state.tournament.participants = state.tournament.participants.filter((p) => p.id !== target.id);
  saveState();
  res.json({ success: true, state, removedParticipantId: target.id });
});

// Start / Generate tournament bracket (Admin)
app.post('/api/tournament/start', requireAdmin, (req, res) => {
  try {
    if (state.tournament.participants.length < 2) {
      return res.status(400).json({ error: 'Minst 2 deltakere kreves for å starte turneringen.' });
    }

    if (tournamentHasCupData(state.tournament)) {
      return res.status(400).json({
        error: 'Cup er allerede startet. Nullstill cup i Test-fanen før ny trekning.',
      });
    }

    const capacity = resolveDrawCapacity(
      state.tournament.participants.length,
      state.tournament.bracketCapacity ?? TOURNAMENT_DEFAULT_CAPACITY
    );

    const formatSettings = normalizeFormatSettings(state.tournament.formatSettings);
    state.tournament.formatSettings = formatSettings;
    const matches = generateBracket(state.tournament.participants, capacity, formatSettings);
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

// Generate new bracket draw with existing participants (Admin + reset PIN)
app.post('/api/tournament/re-draw', requireAdmin, (req, res) => {
  try {
    if (state.tournament.participants.length < 2) {
      return res.status(400).json({ error: 'Minst 2 deltakere kreves for å generere ny trekning.' });
    }

    const capacity = resolveBracketCapacity(
      state.tournament.participants.length,
      state.tournament.bracketCapacity ?? TOURNAMENT_DEFAULT_CAPACITY
    );
    const formatSettings = normalizeFormatSettings(state.tournament.formatSettings);
    state.tournament.formatSettings = formatSettings;
    const matches = generateBracket(state.tournament.participants, capacity as any, formatSettings);
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

// Update tournament format settings and estimated duration (Admin)
// Format changes ONLY apply to matches that are not started (status 'ready' or 'not_ready')
app.patch('/api/tournament/format', requireAdmin, (req, res) => {
  try {
    const { formatSettings, estimatedMinutesPerMatch } = req.body;

    if (estimatedMinutesPerMatch !== undefined) {
      const minutes = Number(estimatedMinutesPerMatch);
      if (minutes > 0 && minutes <= 60) {
        state.tournament.estimatedMinutesPerMatch = minutes;
      }
    }

    if (formatSettings) {
      state.tournament.formatSettings = normalizeFormatSettings({
        regular: formatSettings.regular || state.tournament.formatSettings?.regular,
        semifinal: formatSettings.semifinal || state.tournament.formatSettings?.semifinal,
        final: formatSettings.final || state.tournament.formatSettings?.final,
      });

      // Apply to unstarted matches only:
      if (state.tournament.matches && state.tournament.matches.length > 0) {
        for (const match of state.tournament.matches) {
          if (match.status === 'ready' || match.status === 'not_ready') {
            const stage = match.stage || 'regular';
            match.format = resolveMatchFormat(match, state.tournament.formatSettings);
          }
        }
      }
    }

    saveState();
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Feil ved oppdatering av turneringsformat' });
  }
});

// Record match score (Admin)
app.post('/api/tournament/match/score', requireAdmin, (req, res) => {
  try {
    const { matchId, scoreA, scoreB, isWalkover, walkoverWinnerSlot, sets, winnerSlot } = req.body;
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

    const formatSettings = normalizeFormatSettings(state.tournament.formatSettings);
    if (match.status === 'ready' || match.status === 'in_progress') {
      match.format = resolveMatchFormat(match, formatSettings);
    }

    const { updatedMatches, tournamentWinner } = recordMatchResult(
      state.tournament.matches,
      matchId,
      Number(scoreA),
      Number(scoreB),
      Boolean(isWalkover),
      walkoverWinnerSlot,
      sets,
      winnerSlot
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
    const { matchId, newScoreA, newScoreB, confirmCorrection, sets, winnerSlot } = req.body;
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

    const formatSettings = normalizeFormatSettings(state.tournament.formatSettings);
    if (match.status === 'ready' || match.status === 'in_progress') {
      match.format = resolveMatchFormat(match, formatSettings);
    }

    // Record the new score
    const { updatedMatches, tournamentWinner } = recordMatchResult(
      state.tournament.matches,
      matchId,
      Number(newScoreA),
      Number(newScoreB),
      false,
      undefined,
      sets,
      winnerSlot
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

// Reset tournament (Admin; secured reset from TEST & RESET requires RESET_PIN)
app.post('/api/tournament/reset', requireAdmin, (req, res) => {
  if (req.body?.securedReset === true && !isValidResetPin(getResetPinFromRequest(req))) {
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

// Set bracket capacity (Admin) — 8, 16, 32 or 64
app.patch('/api/tournament/capacity', requireAdmin, (req, res) => {
  if (state.tournament.status !== 'registration') {
    return res.status(400).json({ error: 'Cup-størrelse kan bare endres under påmelding.' });
  }

  const requested = Number(req.body?.capacity);
  const validTiers = [8, 16, 32, 64];
  if (!validTiers.includes(requested)) {
    return res.status(400).json({
      error: 'Ugyldig cup-størrelse. Velg mellom 8, 16, 32 eller 64 spillere.',
    });
  }

  const enrolledCount = state.tournament.participants?.length || 0;
  if (requested < enrolledCount) {
    return res.status(400).json({
      error: `Kan ikke sette cup-størrelse til ${requested} når det allerede er ${enrolledCount} påmeldte spillere.`,
    });
  }

  state.tournament.bracketCapacity = requested as 8 | 16 | 32 | 64;
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
  const simCapacity: 4 | 8 | 16 | 32 | 64 =
    count <= 4 ? 4 : count <= 8 ? 8 : count <= 16 ? 16 : count <= 32 ? 32 : 64;
  state.tournament.bracketCapacity = simCapacity;
  const formatSettings = normalizeFormatSettings(state.tournament.formatSettings);
  state.tournament.formatSettings = formatSettings;
  const matches = generateBracket(participants, simCapacity, formatSettings);
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

// Reset Alpha interests (Admin + reset PIN)
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

// Reset Popcorn (Admin + reset PIN)
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

// ----------------------------------------------------
// KIOSK MENU & ITEMS (Admin & Public)
// ----------------------------------------------------

// Add kiosk item (Admin)
app.post('/api/kiosk/items', requireAdmin, (req, res) => {
  const { name, desc, price, icon, category } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Varenavn er påkrevd.' });
  }
  if (!price || typeof price !== 'string' || !price.trim()) {
    return res.status(400).json({ error: 'Pris er påkrevd.' });
  }

  if (!Array.isArray(state.kioskItems)) {
    state.kioskItems = [];
  }

  const newItem = {
    id: `kiosk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    desc: typeof desc === 'string' ? desc.trim() : '',
    price: price.trim(),
    icon: typeof icon === 'string' && icon.trim() ? icon.trim() : '🛒',
    isAvailable: true,
    category: typeof category === 'string' && category.trim() ? category.trim() : 'Diverse',
    createdAt: new Date().toISOString(),
  };

  state.kioskItems.push(newItem);
  state.updatedAt = new Date().toISOString();
  saveState();

  res.json({ success: true, item: newItem, state });
});

// Update kiosk item (Admin)
app.put('/api/kiosk/items/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, desc, price, icon, category, isAvailable } = req.body;

  if (!Array.isArray(state.kioskItems)) {
    state.kioskItems = [];
  }

  const itemIndex = state.kioskItems.findIndex((item) => item.id === id);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Varen ble ikke funnet.' });
  }

  const existing = state.kioskItems[itemIndex];
  state.kioskItems[itemIndex] = {
    ...existing,
    name: typeof name === 'string' && name.trim() ? name.trim() : existing.name,
    desc: typeof desc === 'string' ? desc.trim() : existing.desc,
    price: typeof price === 'string' && price.trim() ? price.trim() : existing.price,
    icon: typeof icon === 'string' && icon.trim() ? icon.trim() : existing.icon,
    category: typeof category === 'string' && category.trim() ? category.trim() : existing.category,
    isAvailable: typeof isAvailable === 'boolean' ? isAvailable : existing.isAvailable ?? true,
  };

  state.updatedAt = new Date().toISOString();
  saveState();

  res.json({ success: true, item: state.kioskItems[itemIndex], state });
});

// Delete kiosk item (Admin)
app.delete('/api/kiosk/items/:id', requireAdmin, (req, res) => {
  const { id } = req.params;

  if (!Array.isArray(state.kioskItems)) {
    state.kioskItems = [];
  }

  const itemIndex = state.kioskItems.findIndex((item) => item.id === id);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Varen ble ikke funnet.' });
  }

  const deleted = state.kioskItems.splice(itemIndex, 1)[0];
  state.updatedAt = new Date().toISOString();
  saveState();

  res.json({ success: true, deleted, state });
});

// Toggle kiosk item availability (Admin)
app.post('/api/kiosk/items/:id/toggle', requireAdmin, (req, res) => {
  const { id } = req.params;

  if (!Array.isArray(state.kioskItems)) {
    state.kioskItems = [];
  }

  const item = state.kioskItems.find((i) => i.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Varen ble ikke funnet.' });
  }

  item.isAvailable = !(item.isAvailable ?? true);
  state.updatedAt = new Date().toISOString();
  saveState();

  res.json({ success: true, item, state });
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

// Reset test data (Popcorn, Tournament, Alpha, and Simulated Persons) while preserving event info and real persons (Admin + reset PIN)
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

// Reset entire database to initial state (Admin + reset PIN)
app.post('/api/admin/reset-all', requireAdmin, requireResetPin, async (req, res) => {
  try {
    if (firestoreSaveTimeout) {
      clearTimeout(firestoreSaveTimeout);
      firestoreSaveTimeout = null;
    }

    if (firestoreDb) {
      try {
        await deleteFirestoreCollection('persons');
        await deleteFirestoreCollection('alphaInterests');
      } catch (deleteErr: any) {
        console.warn(
          '[reset-all] Kunne ikke slette Firestore-underkolleksjoner:',
          deleteErr?.message || deleteErr
        );
      }
    }

    state = JSON.parse(JSON.stringify(createEmptyAppState()));
    saveLocalStateOnly();

    if (firestoreDb) {
      await syncToFirestoreCollections(state);
    }

    res.json({ success: true, state });
  } catch (err: any) {
    firestoreSyncError = err?.message || String(err);
    console.error('[reset-all] Failed to reset database:', err);
    res.status(500).json({ error: err?.message || 'Kunne ikke nullstille databasen.' });
  }
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
