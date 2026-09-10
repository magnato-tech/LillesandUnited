import { Match, Participant, Tournament } from '../types';

export type PlayerQueueStage =
  | 'not_registered'
  | 'registered_waiting'
  | 'in_queue'
  | 'two_matches_away'
  | 'one_match_away'
  | 'ready_table'
  | 'playing_now'
  | 'eliminated'
  | 'champion';

export interface PlayerQueueStatus {
  isRegistered: boolean;
  participant: Participant | null;
  stage: PlayerQueueStage;
  matchesAhead: number; // 0 = playing or next up on table, 1 = 1 match left, 2 = 2 matches left, etc.
  myMatch: Match | null;
  opponent: Participant | null;
  opponentName: string;
  tableNumber: 1 | 2 | null;
  roundName: string;
  title: string;
  description: string;
}

export interface InAppPushAlert {
  id: string;
  matchId: string;
  stage: 'two_matches_away' | 'one_match_away' | 'ready_table' | 'playing_now';
  title: string;
  message: string;
  roundName: string;
  tableNumber: 1 | 2 | null;
  opponentName: string;
  createdAt: number;
}

/**
 * Calculates a player's exact position in the tournament queue,
 * specifically determining when there are exactly 2 matches remaining
 * before the player's upcoming match.
 */
export function calculatePlayerQueueStatus(
  tournament: Tournament | null | undefined,
  activePersonId?: string | null,
  playerName?: string | null
): PlayerQueueStatus | null {
  if (!tournament) return null;

  const participants = tournament.participants || [];

  // Match participant by personId, id, or normalized name
  const participant =
    (activePersonId &&
      participants.find(
        (p) =>
          (p.personId && p.personId === activePersonId) ||
          p.id === activePersonId
      )) ||
    (playerName &&
      playerName.trim() &&
      participants.find(
        (p) =>
          p.firstName?.toLowerCase() === playerName.trim().toLowerCase() ||
          p.displayId?.toLowerCase() === playerName.trim().toLowerCase()
      )) ||
    null;

  if (!participant) {
    return {
      isRegistered: false,
      participant: null,
      stage: 'not_registered',
      matchesAhead: 999,
      myMatch: null,
      opponent: null,
      opponentName: '',
      tableNumber: null,
      roundName: '',
      title: 'Ikke påmeldt cupen',
      description: 'Meld deg på for å bli med i bordtenniscupen!',
    };
  }

  // Registration phase
  if (tournament.status === 'registration') {
    return {
      isRegistered: true,
      participant,
      stage: 'registered_waiting',
      matchesAhead: 999,
      myMatch: null,
      opponent: null,
      opponentName: '',
      tableNumber: null,
      roundName: '',
      title: 'Du er påmeldt cupen! 🎉',
      description: 'Venter på at trekningen skal starte kl. 18:45.',
    };
  }

  const myMatches = (tournament.matches || []).filter(
    (m) =>
      (m.playerA &&
        ((activePersonId && m.playerA.personId === activePersonId) ||
          m.playerA.id === participant.id)) ||
      (m.playerB &&
        ((activePersonId && m.playerB.personId === activePersonId) ||
          m.playerB.id === participant.id))
  );

  // Check champion
  if (
    tournament.winner &&
    ((activePersonId && tournament.winner.personId === activePersonId) ||
      tournament.winner.id === participant.id)
  ) {
    return {
      isRegistered: true,
      participant,
      stage: 'champion',
      matchesAhead: 0,
      myMatch: null,
      opponent: null,
      opponentName: '',
      tableNumber: null,
      roundName: 'Finale',
      title: '🏆 GRATULERER! DU VANT BORDTENNISCUPEN! 🏆',
      description: 'Du vant hele turneringen! Gratulerer med seieren!',
    };
  }

  // Check if eliminated
  const lostMatch = myMatches.find(
    (m) =>
      m.status === 'completed' &&
      m.winnerId &&
      m.winnerId !== participant.id &&
      (!activePersonId || m.winnerId !== activePersonId)
  );

  // Active or upcoming match
  const upcomingMatch = myMatches.find(
    (m) => m.status !== 'completed' && !m.isWalkover && !m.winnerId
  );

  if (!upcomingMatch) {
    if (lostMatch) {
      return {
        isRegistered: true,
        participant,
        stage: 'eliminated',
        matchesAhead: 999,
        myMatch: lostMatch,
        opponent: null,
        opponentName: '',
        tableNumber: null,
        roundName: lostMatch.roundName,
        title: 'Takk for god innsats!',
        description: `Du ble slått ut i ${lostMatch.roundName}. Nyt kvelden og hei på de andre!`,
      };
    }

    return {
      isRegistered: true,
      participant,
      stage: 'in_queue',
      matchesAhead: 999,
      myMatch: null,
      opponent: null,
      opponentName: '',
      tableNumber: null,
      roundName: '',
      title: 'Aktiv i turneringen',
      description: 'Følg med på oversikten og storskjermen.',
    };
  }

  const isMe = (p: Participant | null) => {
    if (!p) return false;
    if (activePersonId && p.personId === activePersonId) return true;
    return p.id === participant.id;
  };

  const opponent = isMe(upcomingMatch.playerA)
    ? upcomingMatch.playerB
    : upcomingMatch.playerA;

  const opponentName =
    opponent?.displayId || opponent?.firstName || 'Venter på motstander';

  // 1. In progress
  if (upcomingMatch.status === 'in_progress') {
    return {
      isRegistered: true,
      participant,
      stage: 'playing_now',
      matchesAhead: 0,
      myMatch: upcomingMatch,
      opponent,
      opponentName,
      tableNumber: upcomingMatch.tableNumber || 1,
      roundName: upcomingMatch.roundName,
      title: `🚨 DIN KAMP SPILLES NÅ!`,
      description: `Gå til BORD ${upcomingMatch.tableNumber || 1}! Du spiller mot ${opponentName}!`,
    };
  }

  // Calculate order among all pending uncompleted matches
  const pendingMatches = (tournament.matches || [])
    .filter((m) => m.status !== 'completed' && !m.isWalkover && !m.winnerId)
    .sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.position - b.position;
    });

  const queueIndex = pendingMatches.findIndex((m) => m.id === upcomingMatch.id);
  const matchesAhead = queueIndex >= 0 ? queueIndex : 0;

  // 2. Ready with assigned table
  if (upcomingMatch.status === 'ready' && upcomingMatch.tableNumber) {
    return {
      isRegistered: true,
      participant,
      stage: 'ready_table',
      matchesAhead: 0,
      myMatch: upcomingMatch,
      opponent,
      opponentName,
      tableNumber: upcomingMatch.tableNumber,
      roundName: upcomingMatch.roundName,
      title: `🔔 DU ER NESTE PÅ BORD ${upcomingMatch.tableNumber}!`,
      description: `Gjør deg klar ved Bord ${upcomingMatch.tableNumber}. Motstander: ${opponentName}.`,
    };
  }

  // 3. Exactly 2 matches left!
  if (matchesAhead === 2) {
    return {
      isRegistered: true,
      participant,
      stage: 'two_matches_away',
      matchesAhead: 2,
      myMatch: upcomingMatch,
      opponent,
      opponentName,
      tableNumber: null,
      roundName: upcomingMatch.roundName,
      title: `⏳ 2 KAMPER IGJEN FØR DU SKAL SPILLE!`,
      description: `Gjør deg klar! Det er nå 2 kamper igjen før din kamp i ${upcomingMatch.roundName}. Motstander: ${opponentName}. Finn racketen og varm opp!`,
    };
  }

  // 4. Exactly 1 match left!
  if (matchesAhead === 1) {
    return {
      isRegistered: true,
      participant,
      stage: 'one_match_away',
      matchesAhead: 1,
      myMatch: upcomingMatch,
      opponent,
      opponentName,
      tableNumber: null,
      roundName: upcomingMatch.roundName,
      title: `🔔 1 KAMP IGJEN (NESTE KAMP I KØEN)!`,
      description: `Du skal spille neste gang et bord blir ledig! Still deg opp ved bordene. Motstander: ${opponentName}.`,
    };
  }

  // 5. Earlier in queue (3+ matches away)
  return {
    isRegistered: true,
    participant,
    stage: 'in_queue',
    matchesAhead,
    myMatch: upcomingMatch,
    opponent,
    opponentName,
    tableNumber: null,
    roundName: upcomingMatch.roundName,
    title: `I turneringskø (${upcomingMatch.roundName})`,
    description:
      matchesAhead > 0
        ? `Det er ${matchesAhead} kamper igjen før din tur. Motstander: ${opponentName}.`
        : `Venter på ledig bord. Motstander: ${opponentName}.`,
  };
}

/**
 * Plays a clean, pleasant in-app chime using the Web Audio API synthesizer.
 * Fails gracefully and silently if audio autoplay is restricted.
 */
export function playNotificationChime(
  type: 'two_matches' | 'one_match' | 'playing_now' = 'two_matches'
) {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Pleasant chords:
    // two_matches: Attention chime (D5 -> A5)
    // one_match: Warning chime (E5 -> B5)
    // playing_now: Urgent fanfare (C5 -> E5 -> G5 -> C6)
    const tones =
      type === 'playing_now'
        ? [523.25, 659.25, 783.99, 1046.5]
        : type === 'one_match'
        ? [659.25, 987.77]
        : [587.33, 880.0];

    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.65);
    });
  } catch (e) {
    // Autoplay restrictions are normal
  }
}

/**
 * Triggers mobile device vibration pattern if supported.
 */
export function triggerDeviceVibration(pattern: number[] = [200, 100, 200]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
}

/**
 * Requests browser push notification permission.
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (e) {
    return null;
  }
}

/**
 * Dispatches a native browser push notification if permission is granted.
 */
export function sendBrowserPushNotification(
  title: string,
  options?: NotificationOptions
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });
    } catch (e) {}
  }
}
