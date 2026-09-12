import { AppState, Participant, Match, AlphaInterest, PopcornBong, Person, TournamentFormatSettings } from '../types';

const STATE_CACHE_KEY = 'lillesand_state_cache';

let currentAdminPin =
  typeof window !== 'undefined' ? sessionStorage.getItem('lillesand_admin_pin') || '' : '';

export function setAdminPin(pin: string) {
  currentAdminPin = pin;
  if (typeof window !== 'undefined') {
    if (pin) {
      sessionStorage.setItem('lillesand_admin_pin', pin);
    } else {
      sessionStorage.removeItem('lillesand_admin_pin');
    }
  }
}

export function getAdminPin(): string {
  return currentAdminPin;
}

export async function verifyAdminPin(pin: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || 'Ugyldig admin-PIN' };
  } catch (err: any) {
    return { ok: false, error: 'Kunne ikke kontakte serveren' };
  }
}

export async function verifyResetPin(pin: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/verify-reset-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || 'Ugyldig nullstillings-PIN' };
  } catch (err: any) {
    return { ok: false, error: 'Kunne ikke kontakte serveren' };
  }
}

function getAdminHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-admin-pin': currentAdminPin,
  };
}

let lastKnownEtag: string | null = null;
let lastInMemoryState: AppState | null = null;

export async function fetchState(force?: boolean): Promise<AppState | null> {
  try {
    const headers: Record<string, string> = {};
    if (!force && lastKnownEtag) {
      headers['If-None-Match'] = lastKnownEtag;
    }

    const res = await fetch('/api/state', { headers });

    // 304 Not Modified - server data is unchanged, saving bandwidth and CPU
    if (res.status === 304) {
      return null;
    }

    if (!res.ok) throw new Error('Kunne ikke hente arrangementsdata');

    const etag = res.headers.get('ETag');
    if (etag) {
      lastKnownEtag = etag;
    }

    const data: AppState = await res.json();
    lastInMemoryState = data;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STATE_CACHE_KEY, JSON.stringify(data));
    }
    return data;
  } catch (err) {
    console.warn('Network error or server not responding, checking localStorage cache:', err);
    if (lastInMemoryState) return lastInMemoryState;
    const cached = typeof window !== 'undefined' ? localStorage.getItem(STATE_CACHE_KEY) : null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        lastInMemoryState = parsed;
        return parsed;
      } catch (e) {}
    }
    throw err;
  }
}

// ----------------------------------------------------
// CENTRAL PERSON API
// ----------------------------------------------------

export async function createPerson(
  firstName: string,
  anonymousToken?: string
): Promise<{ person: Person; state: AppState }> {
  const res = await fetch('/api/persons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, anonymousToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke opprette person');
  return data;
}

export async function fetchPersons(): Promise<Person[]> {
  try {
    const res = await fetch('/api/persons');
    if (!res.ok) return [];
    const data = await res.json();
    return data.persons || [];
  } catch (err) {
    return [];
  }
}

export async function fetchPerson(id: string): Promise<Person | null> {
  try {
    const res = await fetch(`/api/persons/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.person || null;
  } catch (err) {
    return null;
  }
}

export async function updatePerson(id: string, updates: { firstName: string }): Promise<{ person: Person; state: AppState }> {
  const res = await fetch(`/api/persons/${id}`, {
    method: 'PATCH',
    headers: getAdminHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke oppdatere person');
  return data;
}

export async function deletePerson(id: string): Promise<AppState> {
  const res = await fetch(`/api/persons/${id}`, {
    method: 'DELETE',
    headers: getAdminHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke slette person');
  return data.state;
}

export async function withdrawTournamentParticipant(options: {
  participantId?: string;
  personId?: string;
  anonymousToken?: string;
}): Promise<AppState> {
  const res = await fetch('/api/tournament/withdraw', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify(options),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke trekke påmelding');
  return data.state;
}

// ----------------------------------------------------
// POPCORN DIGITAL BONG API
// ----------------------------------------------------

export async function activatePopcornBong(
  clientToken: string,
  userName?: string,
  personId?: string
): Promise<{ bong: PopcornBong; state: AppState; alreadyActivated?: boolean }> {
  const res = await fetch('/api/popcorn/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientToken, userName, personId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke aktivere popcornbong');
  return data;
}

export async function getMyPopcornBong(
  clientToken?: string,
  userName?: string,
  personId?: string
): Promise<PopcornBong | null> {
  try {
    const params = new URLSearchParams();
    if (personId) params.set('personId', personId);
    if (clientToken) params.set('clientToken', clientToken);
    if (userName) params.set('userName', userName);
    const res = await fetch(`/api/popcorn/my-bong?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.bong || null;
  } catch (err) {
    return null;
  }
}

export async function redeemPopcornBong(bongNumber: number): Promise<{ bong: PopcornBong; state: AppState }> {
  const res = await fetch('/api/popcorn/redeem', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ bongNumber }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.error || 'Kunne ikke løse inn bong');
    err.alreadyUsed = data.alreadyUsed;
    err.usedAt = data.usedAt;
    throw err;
  }
  return data;
}

export async function addPopcornCapacity(count = 10): Promise<{ totalCapacity: number; newRange: string; state: AppState }> {
  const res = await fetch('/api/popcorn/add-capacity', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ count }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke legge til bonger');
  return data;
}

export async function resetPopcorn(): Promise<AppState> {
  const res = await fetch('/api/popcorn/reset', {
    method: 'POST',
    headers: getAdminHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke tilbakestille popcorn');
  return data.state;
}

// ----------------------------------------------------
// KIOSK MENU & ITEMS API
// ----------------------------------------------------

export async function addKioskItem(item: {
  name: string;
  desc?: string;
  price: string;
  icon?: string;
  category?: string;
}): Promise<AppState> {
  const res = await fetch('/api/kiosk/items', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify(item),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke opprette vare');
  return data.state;
}

export async function updateKioskItem(
  id: string,
  updates: {
    name?: string;
    desc?: string;
    price?: string;
    icon?: string;
    category?: string;
    isAvailable?: boolean;
  }
): Promise<AppState> {
  const res = await fetch(`/api/kiosk/items/${id}`, {
    method: 'PUT',
    headers: getAdminHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke oppdatere vare');
  return data.state;
}

export async function deleteKioskItem(id: string): Promise<AppState> {
  const res = await fetch(`/api/kiosk/items/${id}`, {
    method: 'DELETE',
    headers: getAdminHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke slette vare');
  return data.state;
}

export async function toggleKioskItemAvailability(id: string): Promise<AppState> {
  const res = await fetch(`/api/kiosk/items/${id}/toggle`, {
    method: 'POST',
    headers: getAdminHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke endre status på vare');
  return data.state;
}

// ----------------------------------------------------
// PARTICIPANTS & TOURNAMENT API
// ----------------------------------------------------

export async function registerParticipant(
  firstName: string,
  userId?: string,
  personId?: string,
  anonymousToken?: string
): Promise<AppState> {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, userId, personId, anonymousToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke registrere deltaker');
  if (typeof window !== 'undefined') {
    localStorage.setItem('lillesand_my_player_name', firstName.trim());
  }
  return data.state;
}

export async function renameUser(
  userId: string,
  newName: string,
  oldName?: string
): Promise<{ newName: string; state: AppState }> {
  const res = await fetch('/api/user/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, newName, oldName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke endre navn');
  if (typeof window !== 'undefined') {
    localStorage.setItem('lillesand_my_player_name', data.newName);
  }
  return data;
}

export async function getUserStatus(userId?: string, userName?: string): Promise<any> {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (userName) params.set('userName', userName);
  const res = await fetch(`/api/user/status?${params.toString()}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.status;
}

export async function removeParticipant(id: string): Promise<AppState> {
  const res = await fetch(`/api/participants/${id}`, {
    method: 'DELETE',
    headers: getAdminHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke slette deltaker');
  return data.state;
}

export async function startTournament(): Promise<AppState> {
  const res = await fetch('/api/tournament/start', {
    method: 'POST',
    headers: getAdminHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke starte turnering');
  return data.state;
}

export async function reDrawTournament(): Promise<AppState> {
  const res = await fetch('/api/tournament/re-draw', {
    method: 'POST',
    headers: getAdminHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke generere ny trekning');
  return data.state;
}

export async function setTournamentCapacity(capacity: 8 | 16 | 32 | 64): Promise<AppState> {
  const res = await fetch('/api/tournament/capacity', {
    method: 'PATCH',
    headers: getAdminHeaders(),
    body: JSON.stringify({ capacity }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke oppdatere cup-størrelse');
  return data.state;
}

export const expandTournamentCapacity = setTournamentCapacity as (capacity: 32 | 64) => Promise<AppState>;

export async function updateTournamentFormat(
  formatSettings?: TournamentFormatSettings,
  estimatedMinutesPerMatch?: number
): Promise<AppState> {
  const res = await fetch('/api/tournament/format', {
    method: 'PATCH',
    headers: getAdminHeaders(),
    body: JSON.stringify({ formatSettings, estimatedMinutesPerMatch }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke oppdatere turneringsformat');
  return data.state;
}

export async function submitMatchScore(
  matchId: string,
  scoreA: number,
  scoreB: number,
  isWalkover = false,
  walkoverWinnerSlot?: 'A' | 'B',
  sets?: { scoreA: number; scoreB: number }[],
  winnerSlot?: 'A' | 'B'
): Promise<AppState> {
  const res = await fetch('/api/tournament/match/score', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ matchId, scoreA, scoreB, isWalkover, walkoverWinnerSlot, sets, winnerSlot }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke lagre resultat');
  return data.state;
}

export async function correctMatchScore(
  matchId: string,
  newScoreA: number,
  newScoreB: number,
  confirmCorrection = false,
  sets?: { scoreA: number; scoreB: number }[],
  winnerSlot?: 'A' | 'B'
): Promise<{ state?: AppState; requiresConfirmation?: boolean; warning?: string }> {
  const res = await fetch('/api/tournament/match/correct', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ matchId, newScoreA, newScoreB, confirmCorrection, sets, winnerSlot }),
  });
  const data = await res.json();
  if (res.status === 409 && data.requiresConfirmation) {
    return { requiresConfirmation: true, warning: data.warning };
  }
  if (!res.ok) throw new Error(data.error || 'Kunne ikke korrigere resultat');
  return { state: data.state };
}

export async function resetMatchResult(
  matchId: string,
  confirmReset = false
): Promise<{ state?: AppState; requiresConfirmation?: boolean; warning?: string }> {
  const res = await fetch('/api/tournament/match/reset', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ matchId, confirmReset }),
  });
  const data = await res.json();
  if (res.status === 409 && data.requiresConfirmation) {
    return { requiresConfirmation: true, warning: data.warning };
  }
  if (!res.ok) throw new Error(data.error || 'Kunne ikke nullstille resultat');
  return { state: data.state };
}

export async function assignMatchTable(
  matchId: string,
  tableNumber: 1 | 2 | null,
  status?: string
): Promise<AppState> {
  const res = await fetch('/api/tournament/match/assign-table', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ matchId, tableNumber, status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke tildele bord');
  return data.state;
}

export async function resetTournament(
  keepParticipants = true,
  resetPin?: string
): Promise<AppState> {
  const body: { keepParticipants: boolean; resetPin?: string; securedReset?: boolean } = {
    keepParticipants,
  };
  if (resetPin) {
    body.resetPin = resetPin;
    body.securedReset = true;
  }
  const res = await fetch('/api/tournament/reset', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke tilbakestille');
  return data.state;
}

export async function simulateTournament(count: number = 16): Promise<AppState> {
  const res = await fetch('/api/tournament/simulate', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ count }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke simulere');
  return data.state;
}

// ----------------------------------------------------
// ALPHA & RESET API
// ----------------------------------------------------

export async function registerAlphaInterest(
  firstName: string,
  phone?: string,
  notes?: string,
  userId?: string
): Promise<AppState> {
  const res = await fetch('/api/alpha/interest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, phone, notes, userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke registrere Alpha-interesse');
  return data.state;
}

export async function resetAlpha(): Promise<AppState> {
  const res = await fetch('/api/alpha/reset', {
    method: 'POST',
    headers: getAdminHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke tilbakestille Alpha');
  return data.state;
}

export async function toggleActivity(id: string, enabled: boolean): Promise<AppState> {
  const res = await fetch('/api/activity/toggle', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ id, enabled }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke oppdatere aktivitet');
  return data.state;
}

export async function updateEvent(updates: {
  name?: string;
  date?: string;
  time?: string;
  location?: string;
  organizers?: string[] | string;
}): Promise<AppState> {
  const res = await fetch('/api/event', {
    method: 'PATCH',
    headers: getAdminHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke oppdatere arrangement');
  return data.state;
}

export async function updateActivity(
  id: string,
  updates: {
    name?: string;
    shortDesc?: string;
    fullDesc?: string;
    time?: string;
    location?: string;
    badge?: string;
    enabled?: boolean;
  }
): Promise<AppState> {
  const res = await fetch(`/api/activities/${id}`, {
    method: 'PATCH',
    headers: getAdminHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke oppdatere aktivitet');
  return data.state;
}

export async function resetTestData(): Promise<AppState> {
  const res = await fetch('/api/admin/reset-testdata', {
    method: 'POST',
    headers: getAdminHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke tilbakestille testdata');
  return data.state;
}

export async function resetAllData(resetPin: string): Promise<AppState> {
  const res = await fetch('/api/admin/reset-all', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ resetPin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke tilbakestille alt');
  return data.state;
}

export async function getFirestoreStatus(): Promise<{
  connected: boolean;
  projectId: string | null;
  firestoreDatabaseId: string | null;
  lastSyncTime: string | null;
  error: string | null;
  mode: string;
}> {
  try {
    const res = await fetch('/api/firestore/status');
    if (!res.ok) throw new Error('Kunne ikke hente Firestore-status');
    return await res.json();
  } catch (e: any) {
    return {
      connected: false,
      projectId: null,
      firestoreDatabaseId: null,
      lastSyncTime: null,
      error: e?.message || 'Frakoblet',
      mode: 'Offline',
    };
  }
}

export async function syncFirestore(): Promise<{
  success: boolean;
  message: string;
  lastSyncTime: string;
  itemCounts: {
    persons: number;
    participants: number;
    matches: number;
    activities: number;
    alphaInterests: number;
  };
}> {
  const res = await fetch('/api/admin/firestore/sync', {
    method: 'POST',
    headers: getAdminHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Feil ved synkronisering til Firestore');
  return data;
}

