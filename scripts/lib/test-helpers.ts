import type { AppState } from '../../src/types';
import { validateAppState } from '../../src/lib/state-consistency';

export const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
export const ADMIN_PIN = process.env.ADMIN_PIN || 'United2026';
export const RESET_PIN = process.env.RESET_PIN || 'ResetUnited2026';

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function adminApi(path: string, body?: unknown, method = 'POST') {
  return api(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': ADMIN_PIN,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function resetTournamentApi(keepParticipants = false) {
  return adminApi('/api/tournament/reset', { keepParticipants, resetPin: RESET_PIN });
}

export async function fetchState(): Promise<AppState> {
  const { res, data } = await api('/api/state');
  if (!res.ok) throw new Error('Kunne ikke hente state fra server');
  return data as AppState;
}

export async function resetAll(): Promise<AppState> {
  const { res, data } = await adminApi('/api/admin/reset-all');
  if (!res.ok) throw new Error(`reset-all feilet: ${data.error || res.status}`);
  return data.state as AppState;
}

export function assertConsistent(state: AppState, label: string): void {
  const result = validateAppState(state);
  if (!result.ok) {
    const msg = result.issues.map((i) => `  - ${i}`).join('\n');
    throw new Error(`Konsistensfeil etter "${label}":\n${msg}`);
  }
}

export async function runScenario(name: string, fn: () => Promise<void>): Promise<void> {
  console.log(`\n▶ ${name}`);
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

export async function createPerson(firstName: string) {
  const { res, data } = await api('/api/persons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName }),
  });
  if (!res.ok) throw new Error(`createPerson("${firstName}") feilet: ${data.error}`);
  return data.person as {
    id: string;
    displayId: string;
    firstName: string;
    anonymousToken: string;
  };
}

export async function activatePopcorn(personId: string, token: string, displayId: string) {
  const { res, data } = await api('/api/popcorn/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personId, anonymousToken: token, userName: displayId }),
  });
  if (!res.ok) throw new Error(`popcorn/activate feilet: ${data.error}`);
  return data.state as AppState;
}

export async function registerParticipant(personId: string, firstName: string, token?: string) {
  const { res, data } = await api('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personId, firstName, anonymousToken: token }),
  });
  if (!res.ok) throw new Error(`register feilet: ${data.error}`);
  return data.state as AppState;
}
