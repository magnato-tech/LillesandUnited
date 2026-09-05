// Shared anonymous user profile utilities for Lillesand United
// Reuses the exact same token and identity mechanism as the popcorn bong engine

export function getUserToken(userName?: string | null, guestIdOverride?: string): string {
  if (typeof window === 'undefined') return 'server_token';

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
