// Shared anonymous user profile utilities for Lillesand United
// Reuses the exact same token and identity mechanism as the popcorn bong engine

export const ACTIVE_PERSON_ID_KEY = 'lillesand_active_person_id';
export const ACTIVE_PERSON_TOKEN_KEY = 'lillesand_active_person_token';
export const TEST_PERSON_OVERRIDE_ID_KEY = 'lillesand_test_person_override_id';
export const TEST_PERSON_OVERRIDE_TOKEN_KEY = 'lillesand_test_person_override_token';

export function getActivePersonId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_PERSON_ID_KEY);
}

export function setActivePersonId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id) {
    localStorage.setItem(ACTIVE_PERSON_ID_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_PERSON_ID_KEY);
  }
}

export function getActivePersonToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_PERSON_TOKEN_KEY);
}

export function setActivePersonToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(ACTIVE_PERSON_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACTIVE_PERSON_TOKEN_KEY);
  }
}

export function getTestPersonOverrideId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TEST_PERSON_OVERRIDE_ID_KEY);
}

export function setTestPersonOverrideId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id) {
    sessionStorage.setItem(TEST_PERSON_OVERRIDE_ID_KEY, id);
  } else {
    sessionStorage.removeItem(TEST_PERSON_OVERRIDE_ID_KEY);
  }
}

export function getTestPersonOverrideToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TEST_PERSON_OVERRIDE_TOKEN_KEY);
}

export function setTestPersonOverrideToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    sessionStorage.setItem(TEST_PERSON_OVERRIDE_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TEST_PERSON_OVERRIDE_TOKEN_KEY);
  }
}

export function clearTestPersonOverride(): void {
  setTestPersonOverrideId(null);
  setTestPersonOverrideToken(null);
}

export function getUserToken(userName?: string | null, guestIdOverride?: string): string {
  if (typeof window === 'undefined') return 'server_token';

  const activeToken = getActivePersonToken();
  if (activeToken) return activeToken;

  const effectiveName = userName !== undefined ? userName : localStorage.getItem('lillesand_my_player_name');
  const cleanName = effectiveName && effectiveName.trim() ? effectiveName.trim().toLowerCase() : null;
  if (cleanName && cleanName !== 'gjest') {
    const key = `lillesand_popcorn_token_${cleanName}`;
    let tok = localStorage.getItem(key);
    if (!tok) {
      tok = `usr_${cleanName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      localStorage.setItem(key, tok);
    }
    return tok;
  } else {
    const gid = guestIdOverride || localStorage.getItem('lillesand_popcorn_guest_id') || 'guest_1';
    const key = `lillesand_popcorn_token_${gid}`;
    let tok = localStorage.getItem(key);
    if (!tok) {
      tok = `usr_${gid}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      localStorage.setItem(key, tok);
    }
    return tok;
  }
}

export function saveUserTokenForName(userName: string, token: string): void {
  if (typeof window === 'undefined') return;
  const clean = userName.trim().toLowerCase();
  localStorage.setItem(`lillesand_popcorn_token_${clean}`, token);
}

export function startNewGuestSession(): { guestId: string; token: string } {
  const nextId = 'guest_' + (Date.now() % 100000);
  if (typeof window !== 'undefined') {
    localStorage.setItem('lillesand_popcorn_guest_id', nextId);
    localStorage.removeItem('lillesand_my_player_name');
  }
  const token = getUserToken(null, nextId);
  return { guestId: nextId, token };
}
