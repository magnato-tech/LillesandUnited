import { Match, MatchStatus, Participant, Tournament } from '../types';

/**
 * Generates the round names according to the total number of rounds.
 */
export function getRoundName(round: number, totalRounds: number): string {
  const diff = totalRounds - round;
  if (diff === 0) return 'Finale';
  if (diff === 1) return 'Semifinale';
  if (diff === 2) return 'Kvartfinale';
  if (diff === 3) return 'Åttedelsfinale';
  return `Runde ${round}`;
}

/**
 * Shuffles an array randomly using Fisher-Yates.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generates a single-elimination tournament bracket for any participant count (>= 2).
 * Strictly guarantees:
 * - Single elimination
 * - Maximum one walkover per player
 * - Balanced bracket tree
 */
export function generateBracket(participants: Participant[]): Match[] {
  if (participants.length < 2) {
    throw new Error('Minst 2 deltakere kreves for å starte en turnering.');
  }

  const shuffled = shuffleArray(participants);
  const n = shuffled.length;

  // Determine the next power of 2
  let bracketSize = 2;
  while (bracketSize < n) {
    bracketSize *= 2;
  }

  const totalRounds = Math.log2(bracketSize);
  const walkoverCount = bracketSize - n; // Number of byes/walkovers in round 1

  const matches: Match[] = [];

  // 1. Create blank matches for all rounds from final down to round 1
  // We'll build by round: round 1 has bracketSize / 2 matches, round 2 has bracketSize / 4, etc.
  const roundMatchesMap: Map<number, Match[]> = new Map();

  for (let r = 1; r <= totalRounds; r++) {
    const matchesInRound = bracketSize / Math.pow(2, r);
    const roundList: Match[] = [];

    for (let p = 0; p < matchesInRound; p++) {
      const matchId = `match_r${r}_p${p}`;
      const match: Match = {
        id: matchId,
        round: r,
        roundName: getRoundName(r, totalRounds),
        position: p,
        playerA: null,
        playerB: null,
        winnerId: null,
        scoreA: null,
        scoreB: null,
        tableNumber: null,
        status: 'not_ready',
        isWalkover: false,
        walkoverPlayerId: null,
        nextMatchId: r < totalRounds ? `match_r${r + 1}_p${Math.floor(p / 2)}` : null,
        nextMatchSlot: r < totalRounds ? (p % 2 === 0 ? 'A' : 'B') : null,
      };
      roundList.push(match);
      matches.push(match);
    }
    roundMatchesMap.set(r, roundList);
  }

  // 2. Populate Round 1 with players & distribute walkovers
  // Total round 1 matches = bracketSize / 2
  const r1Matches = roundMatchesMap.get(1)!;
  const numR1Matches = r1Matches.length;

  // We have 'walkoverCount' matches that will have only 1 player.
  // Spread walkovers evenly across the bracket positions.
  const isWalkoverMatch = new Array(numR1Matches).fill(false);
  if (walkoverCount > 0) {
    // Distribute walkovers evenly
    const step = numR1Matches / walkoverCount;
    for (let i = 0; i < walkoverCount; i++) {
      const idx = Math.floor(i * step);
      isWalkoverMatch[idx] = true;
    }
  }

  let playerIndex = 0;
  for (let p = 0; p < numR1Matches; p++) {
    const match = r1Matches[p];

    if (isWalkoverMatch[p]) {
      // Single player -> Walkover!
      const player = shuffled[playerIndex++];
      match.playerA = player;
      match.playerB = null;
      match.isWalkover = true;
      match.walkoverPlayerId = player.id;
      match.winnerId = player.id;
      match.status = 'walkover';
      match.scoreA = 21;
      match.scoreB = 0;
      match.completedAt = new Date().toISOString();

      // Automatically advance to Round 2
      if (match.nextMatchId) {
        const nextMatch = matches.find((m) => m.id === match.nextMatchId);
        if (nextMatch) {
          if (match.nextMatchSlot === 'A') {
            nextMatch.playerA = player;
          } else {
            nextMatch.playerB = player;
          }
        }
      }
    } else {
      // Regular match with 2 players
      const player1 = shuffled[playerIndex++];
      const player2 = shuffled[playerIndex++];
      match.playerA = player1;
      match.playerB = player2;
      match.status = 'ready';
    }
  }

  // Update status for Round 2 matches if both players are already known (can happen if both fed from walkovers)
  updateMatchStatuses(matches);

  // Auto assign initial 2 tables
  autoAssignTables(matches);

  return matches;
}

/**
 * Updates match statuses based on player availability.
 */
export function updateMatchStatuses(matches: Match[]): void {
  for (const match of matches) {
    if (match.status === 'completed' || match.status === 'walkover') continue;

    if (match.playerA && match.playerB) {
      if (match.status === 'not_ready') {
        match.status = 'ready';
      }
    } else {
      if (match.status !== 'in_progress') {
        match.status = 'not_ready';
      }
    }
  }
}

/**
 * Assigns Bord 1 and Bord 2 to the next ready matches according to tournament priority:
 * 1. Lowest round level first
 * 2. Position left to right
 */
export function autoAssignTables(matches: Match[]): void {
  // Find which tables are currently occupied by 'in_progress' matches
  const activeTable1 = matches.find((m) => m.status === 'in_progress' && m.tableNumber === 1);
  const activeTable2 = matches.find((m) => m.status === 'in_progress' && m.tableNumber === 2);

  const availableTables: (1 | 2)[] = [];
  if (!activeTable1) availableTables.push(1);
  if (!activeTable2) availableTables.push(2);

  if (availableTables.length === 0) return;

  // Get ready matches sorted by round asc, then position asc
  const readyMatches = matches
    .filter((m) => m.status === 'ready' && m.playerA && m.playerB && !m.tableNumber)
    .sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.position - b.position;
    });

  for (let i = 0; i < availableTables.length && i < readyMatches.length; i++) {
    const table = availableTables[i];
    const match = readyMatches[i];
    match.tableNumber = table;
    match.status = 'ready'; // Ready to be started on table
  }
}

/**
 * Validates table tennis score according to rules:
 * - 1 game to 21 points
 * - At 20-20, play continues until one player leads by 2 points (e.g., 22-20, 23-21)
 */
export function validateScore(
  scoreA: number,
  scoreB: number
): { isValid: boolean; winnerSlot: 'A' | 'B' | null; error?: string } {
  if (scoreA < 0 || scoreB < 0) {
    return { isValid: false, winnerSlot: null, error: 'Poeng kan ikke være negative.' };
  }

  const maxScore = Math.max(scoreA, scoreB);
  const minScore = Math.min(scoreA, scoreB);
  const diff = maxScore - minScore;

  if (maxScore < 21) {
    return { isValid: false, winnerSlot: null, error: 'Vinneren må ha minst 21 poeng.' };
  }

  // If score is 21 and the other is <= 19 -> valid standard win
  if (maxScore === 21 && minScore <= 19) {
    return { isValid: true, winnerSlot: scoreA > scoreB ? 'A' : 'B' };
  }

  // If both >= 20 (deuce situations: 20-20, 21-21, 22-22...), winner must lead by exactly 2 (e.g., 22-20, 23-21)
  if (minScore >= 20) {
    if (diff === 2) {
      return { isValid: true, winnerSlot: scoreA > scoreB ? 'A' : 'B' };
    }
    if (diff > 2) {
      return { isValid: false, winnerSlot: null, error: 'Ved 20-20 avsluttes spillet så snart en leder med 2 poeng.' };
    }
    return { isValid: false, winnerSlot: null, error: 'Ved 20-20 må en spiller lede med 2 poeng for å vinne.' };
  }

  // E.g., 25-10 would be invalid because it should have ended at 21
  if (maxScore > 21 && minScore < 20) {
    return { isValid: false, winnerSlot: null, error: 'Spillet skal avsluttes ved 21 poeng når motstander har under 20.' };
  }

  return { isValid: true, winnerSlot: scoreA > scoreB ? 'A' : 'B' };
}

/**
 * Finds all downstream match IDs that depend on a given match.
 */
export function getDependentMatchIds(matchId: string, allMatches: Match[]): string[] {
  const dependentIds: string[] = [];
  let currentId: string | null = matchId;

  while (currentId) {
    const current = allMatches.find((m) => m.id === currentId);
    if (current && current.nextMatchId) {
      dependentIds.push(current.nextMatchId);
      currentId = current.nextMatchId;
    } else {
      break;
    }
  }

  return dependentIds;
}

/**
 * Checks if correcting a match would affect downstream matches that have already been played or are in progress.
 */
export function hasPlayedDependencies(matchId: string, allMatches: Match[]): boolean {
  const dependentIds = getDependentMatchIds(matchId, allMatches);
  return allMatches.some(
    (m) => dependentIds.includes(m.id) && (m.status === 'completed' || m.status === 'in_progress')
  );
}

/**
 * Safely invalidates/resets dependent downstream matches when a score is corrected.
 */
export function invalidateDependencies(matchId: string, allMatches: Match[]): void {
  const dependentIds = getDependentMatchIds(matchId, allMatches);
  const matchMap = new Map(allMatches.map((m) => [m.id, m]));

  for (const depId of dependentIds) {
    const depMatch = matchMap.get(depId);
    if (!depMatch) continue;

    // Reset this dependent match
    depMatch.status = 'not_ready';
    depMatch.winnerId = null;
    depMatch.scoreA = null;
    depMatch.scoreB = null;
    depMatch.tableNumber = null;
    depMatch.startedAt = null;
    depMatch.completedAt = null;

    // Check upstream feeders
    const feederA = allMatches.find((m) => m.nextMatchId === depId && m.nextMatchSlot === 'A');
    const feederB = allMatches.find((m) => m.nextMatchId === depId && m.nextMatchSlot === 'B');

    depMatch.playerA = feederA && feederA.winnerId ? (feederA.playerA?.id === feederA.winnerId ? feederA.playerA : feederA.playerB) : null;
    depMatch.playerB = feederB && feederB.winnerId ? (feederB.playerA?.id === feederB.winnerId ? feederB.playerA : feederB.playerB) : null;
  }
}

/**
 * Records a match result and advances the winner.
 */
export function recordMatchResult(
  matches: Match[],
  matchId: string,
  scoreA: number,
  scoreB: number,
  isWalkoverOverride: boolean = false,
  walkoverWinnerSlot?: 'A' | 'B'
): { updatedMatches: Match[]; tournamentWinner: Participant | null } {
  const match = matches.find((m) => m.id === matchId);
  if (!match) throw new Error(`Kamp med ID ${matchId} ble ikke funnet.`);
  if (!match.playerA || (!match.playerB && !isWalkoverOverride && !match.isWalkover)) {
    throw new Error('Begge spillere må være klare for å registrere resultat.');
  }

  // Validate score
  let winnerSlot: 'A' | 'B';
  if (isWalkoverOverride && walkoverWinnerSlot) {
    winnerSlot = walkoverWinnerSlot;
    match.isWalkover = true;
    match.status = 'walkover';
  } else {
    const val = validateScore(scoreA, scoreB);
    if (!val.isValid || !val.winnerSlot) {
      throw new Error(val.error || 'Ugyldig poengsum.');
    }
    winnerSlot = val.winnerSlot;
    match.status = 'completed';
  }

  const winner = winnerSlot === 'A' ? match.playerA! : match.playerB!;
  match.winnerId = winner.id;
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.completedAt = new Date().toISOString();
  match.tableNumber = null; // Free up table

  let tournamentWinner: Participant | null = null;

  // Advance winner to next match if not final
  if (match.nextMatchId) {
    const nextMatch = matches.find((m) => m.id === match.nextMatchId);
    if (nextMatch) {
      if (match.nextMatchSlot === 'A') {
        nextMatch.playerA = winner;
      } else {
        nextMatch.playerB = winner;
      }
    }
  } else {
    // This was the final!
    tournamentWinner = winner;
  }

  updateMatchStatuses(matches);
  autoAssignTables(matches);

  return { updatedMatches: matches, tournamentWinner };
}

/**
 * Calculates estimated tournament completion time and remaining matches.
 */
export function calculateTournamentStats(matches: Match[], estMinutesPerMatch = 10): {
  totalMatches: number;
  completedMatches: number;
  remainingMatches: number;
  estimatedRemainingMinutes: number;
  isOverCapacity: boolean; // Over 2 hours (120 min)
} {
  const playableMatches = matches.filter((m) => !m.isWalkover);
  const totalMatches = playableMatches.length;
  const completedMatches = playableMatches.filter((m) => m.status === 'completed').length;
  const remainingMatches = totalMatches - completedMatches;

  // 2 tables means 2 matches played concurrently:
  const estimatedRemainingMinutes = Math.ceil(remainingMatches / 2) * estMinutesPerMatch;
  const isOverCapacity = estimatedRemainingMinutes > 120;

  return {
    totalMatches,
    completedMatches,
    remainingMatches,
    estimatedRemainingMinutes,
    isOverCapacity,
  };
}
