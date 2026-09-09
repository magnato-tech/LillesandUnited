import {
  Match,
  MatchStatus,
  Participant,
  Tournament,
  TargetPoints,
  WinMargin,
  NumberOfSets,
  StageFormatConfig,
  TournamentFormatSettings,
  TournamentStage,
  MatchSetScore,
} from '../types';
import type { BracketCapacity } from './initial-data';
import { TOURNAMENT_DEFAULT_CAPACITY } from './initial-data';

export const DEFAULT_FORMAT_SETTINGS: TournamentFormatSettings = {
  regular: { sets: 1, targetPoints: 21, winMargin: 2 },
  semifinal: { sets: 1, targetPoints: 21, winMargin: 2 },
  final: { sets: 1, targetPoints: 21, winMargin: 2 },
};

export function getStageForRound(round: number, totalRounds: number): TournamentStage {
  const diff = totalRounds - round;
  if (diff === 0) return 'final';
  if (diff === 1) return 'semifinal';
  return 'regular';
}

export function resolveBracketCapacity(
  participantCount: number,
  configured?: number | null
): number {
  if (participantCount <= 4) return 4;
  if (participantCount <= 8) return 8;
  if (configured === 16 || configured === 32 || configured === 64) {
    if (participantCount > configured) {
      if (participantCount <= 32) return 32;
      return 64;
    }
    return configured;
  }
  if (participantCount <= 16) return 16;
  if (participantCount <= 32) return 32;
  return 64;
}

export function getCapacityInfo(capacity: number) {
  return {
    capacity,
    round1Matches: capacity / 2,
    totalRounds: Math.log2(capacity),
  };
}

export function getNextCapacityTier(current: number): BracketCapacity | null {
  if (current <= 16) return 32;
  if (current === 32) return 64;
  return null;
}

export interface ServeState {
  currentServer: 'A' | 'B';
  servesLeftInTurn: number;
  isDeuce: boolean;
  totalPoints: number;
}

/**
 * Calculates current server in a 21-point table tennis game:
 * - Each player serves 5 consecutive serves.
 * - At 20-20 (deuce, both >= 20), players alternate serve after every single point.
 */
export function calculateServer(
  scoreA: number,
  scoreB: number,
  firstServer: 'A' | 'B' = 'A'
): ServeState {
  const safeA = Math.max(0, scoreA || 0);
  const safeB = Math.max(0, scoreB || 0);
  const totalPoints = safeA + safeB;
  const otherServer = firstServer === 'A' ? 'B' : 'A';
  const isDeuce = safeA >= 20 && safeB >= 20;

  if (isDeuce) {
    // At deuce (both >= 20):
    // Players alternate after every single point (1 serve each).
    const deucePoints = totalPoints - 40;
    const currentServer = deucePoints % 2 === 0 ? firstServer : otherServer;
    return {
      currentServer,
      servesLeftInTurn: 1,
      isDeuce: true,
      totalPoints,
    };
  }

  // Normal phase: 5 serves each
  const turnIndex = Math.floor(totalPoints / 5);
  const currentServer = turnIndex % 2 === 0 ? firstServer : otherServer;
  const servesDoneInCurrentTurn = totalPoints % 5;
  const servesLeftInTurn = 5 - servesDoneInCurrentTurn;

  return {
    currentServer,
    servesLeftInTurn,
    isDeuce: false,
    totalPoints,
  };
}

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
export function generateBracket(
  participants: Participant[],
  capacity?: BracketCapacity | null,
  formatSettings: TournamentFormatSettings = DEFAULT_FORMAT_SETTINGS
): Match[] {
  if (participants.length < 2) {
    throw new Error('Minst 2 deltakere kreves for å starte en turnering.');
  }

  const shuffled = shuffleArray(participants);
  const n = shuffled.length;

  const bracketSize = resolveBracketCapacity(n, capacity);
  if (n > bracketSize) {
    throw new Error(
      `For mange deltakere (${n}) for valgt cup-størrelse (${bracketSize}). Utvid cup eller fjern spillere.`
    );
  }

  const totalRounds = Math.log2(bracketSize);
  const numR1Matches = bracketSize / 2;
  const minPlayers = Math.max(2, Math.floor(bracketSize / 2));
  if (n < minPlayers) {
    throw new Error(
      `Minst ${minPlayers} spillere kreves for en ${bracketSize}-spiller cup (${numR1Matches} kamper i runde 1).`
    );
  }

  const walkoverCount = bracketSize - n; // Number of byes/walkovers in round 1

  const matches: Match[] = [];

  // 1. Create blank matches for all rounds from final down to round 1
  // We'll build by round: round 1 has bracketSize / 2 matches, round 2 has bracketSize / 4, etc.
  const roundMatchesMap: Map<number, Match[]> = new Map();

  for (let r = 1; r <= totalRounds; r++) {
    const matchesInRound = bracketSize / Math.pow(2, r);
    const roundList: Match[] = [];
    const stage = getStageForRound(r, totalRounds);
    const stageFormat = { ...(formatSettings[stage] || DEFAULT_FORMAT_SETTINGS[stage]) };

    for (let p = 0; p < matchesInRound; p++) {
      const matchId = `match_r${r}_p${p}`;
      const match: Match = {
        id: matchId,
        round: r,
        roundName: getRoundName(r, totalRounds),
        stage,
        format: stageFormat,
        position: p,
        playerA: null,
        playerB: null,
        winnerId: null,
        scoreA: null,
        scoreB: null,
        sets: [],
        setsWonA: null,
        setsWonB: null,
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
  const r1Matches = roundMatchesMap.get(1)!;

  // We have 'walkoverCount' matches that will have only 1 player.
  const isWalkoverMatch = new Array(numR1Matches).fill(false);
  if (walkoverCount > 0) {
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
      const player = shuffled[playerIndex++];
      if (!player) {
        throw new Error('Intern feil: ikke nok spillere til walkover-fordeling.');
      }
      match.playerA = player;
      match.playerB = null;
      match.isWalkover = true;
      match.walkoverPlayerId = player.id;
      match.winnerId = player.id;
      match.status = 'walkover';
      const targetPts = match.format?.targetPoints || 21;
      const isBo3 = match.format?.sets === 3;
      if (isBo3) {
        match.scoreA = 2;
        match.scoreB = 0;
        match.setsWonA = 2;
        match.setsWonB = 0;
        match.sets = [
          { setNumber: 1, scoreA: targetPts, scoreB: 0 },
          { setNumber: 2, scoreA: targetPts, scoreB: 0 },
        ];
      } else {
        match.scoreA = targetPts;
        match.scoreB = 0;
        match.setsWonA = 1;
        match.setsWonB = 0;
        match.sets = [{ setNumber: 1, scoreA: targetPts, scoreB: 0 }];
      }
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
 * - targetPoints: 6, 7, 11 or 21
 * - winMargin:
 *     1 = First player to reach targetPoints wins immediately (e.g. 6-5, 7-6, 11-10, 21-20)
 *     2 = Must reach targetPoints AND lead by at least 2. Deuce when trailing player has (targetPoints - 1),
 *         requiring exact 2-point lead to conclude (e.g. 12-10, 22-20).
 */
export function validateScore(
  scoreA: number,
  scoreB: number,
  targetPoints: TargetPoints = 21,
  winMargin: WinMargin = 2
): { isValid: boolean; winnerSlot: 'A' | 'B' | null; error?: string } {
  if (scoreA < 0 || scoreB < 0) {
    return { isValid: false, winnerSlot: null, error: 'Poeng kan ikke være negative.' };
  }
  if (scoreA === scoreB) {
    return { isValid: false, winnerSlot: null, error: 'Et sett kan ikke ende uavgjort.' };
  }

  const maxScore = Math.max(scoreA, scoreB);
  const minScore = Math.min(scoreA, scoreB);
  const diff = maxScore - minScore;
  const winnerSlot: 'A' | 'B' = scoreA > scoreB ? 'A' : 'B';

  // GREIN 1: Margin 1 (Førstemann til målpoeng vinner umiddelbart)
  if (winMargin === 1) {
    if (maxScore !== targetPoints) {
      return {
        isValid: false,
        winnerSlot: null,
        error: `Settet skal avsluttes nøyaktig når en spiller når ${targetPoints} poeng (fikk ${maxScore}).`,
      };
    }
    return { isValid: true, winnerSlot };
  }

  // GREIN 2: Margin 2 (Må nå målpoeng og ha minst 2 poengs ledelse)
  if (maxScore < targetPoints) {
    return {
      isValid: false,
      winnerSlot: null,
      error: `Vinneren må ha minst ${targetPoints} poeng.`,
    };
  }

  const deuceThreshold = targetPoints - 1;

  // Normal seier uten forlengelse (f.eks. 21-15, 11-8, 7-4, 6-3)
  if (maxScore === targetPoints && minScore < deuceThreshold) {
    return { isValid: true, winnerSlot };
  }

  // Ved eller over deuce-terskel (f.eks. minScore >= 20 ved 21p, >= 10 ved 11p)
  if (minScore >= deuceThreshold) {
    if (diff === 2) {
      return { isValid: true, winnerSlot };
    }
    if (diff > 2) {
      return {
        isValid: false,
        winnerSlot: null,
        error: `Ved forlengelse skal settet avsluttes straks en leder med 2 poeng (${minScore + 2}–${minScore}).`,
      };
    }
    return {
      isValid: false,
      winnerSlot: null,
      error: `Det må være 2 poengs differanse (stillingen er ${maxScore}–${minScore}).`,
    };
  }

  // E.g., overskrider målpoeng uten at det var forlengelse (f.eks. 22-15 ved 21p)
  if (maxScore > targetPoints && minScore < deuceThreshold) {
    return {
      isValid: false,
      winnerSlot: null,
      error: `Spillet skal avsluttes ved ${targetPoints} poeng når motstander har under ${deuceThreshold}.`,
    };
  }

  return { isValid: true, winnerSlot };
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
    (m) =>
      dependentIds.includes(m.id) &&
      (m.status === 'completed' || m.status === 'in_progress' || m.status === 'walkover')
  );
}

/**
 * Nullstiller et kampresultat og rydder opp i avhengige senere kamper.
 */
export function resetMatchResult(
  matches: Match[],
  matchId: string
): { updatedMatches: Match[]; tournamentWinner: Participant | null } {
  const match = matches.find((m) => m.id === matchId);
  if (!match) throw new Error('Kamp ikke funnet.');

  const hadResult =
    match.status === 'completed' ||
    match.status === 'walkover' ||
    match.status === 'in_progress' ||
    match.winnerId !== null;

  if (!hadResult) {
    throw new Error('Kampen har ingen resultat å nullstille.');
  }

  // Fjern vinner fra neste kamp før avhengigheter nullstilles
  if (match.nextMatchId && match.winnerId) {
    const nextMatch = matches.find((m) => m.id === match.nextMatchId);
    if (nextMatch) {
      if (match.nextMatchSlot === 'A' && nextMatch.playerA?.id === match.winnerId) {
        nextMatch.playerA = null;
      }
      if (match.nextMatchSlot === 'B' && nextMatch.playerB?.id === match.winnerId) {
        nextMatch.playerB = null;
      }
    }
  }

  invalidateDependencies(matchId, matches);

  match.winnerId = null;
  match.scoreA = null;
  match.scoreB = null;
  match.sets = [];
  match.setsWonA = null;
  match.setsWonB = null;
  match.completedAt = null;
  match.startedAt = null;
  match.tableNumber = null;
  match.isWalkover = false;
  match.walkoverPlayerId = null;

  if (match.playerA && match.playerB) {
    match.status = 'ready';
  } else if (match.playerA || match.playerB) {
    match.status = 'not_ready';
  } else {
    match.status = 'not_ready';
  }

  updateMatchStatuses(matches);
  autoAssignTables(matches);

  const finalMatch = matches.find((m) => !m.nextMatchId);
  let tournamentWinner: Participant | null = null;
  if (
    finalMatch &&
    (finalMatch.status === 'completed' || finalMatch.status === 'walkover') &&
    finalMatch.winnerId
  ) {
    tournamentWinner =
      finalMatch.playerA?.id === finalMatch.winnerId ? finalMatch.playerA : finalMatch.playerB;
  }

  return { updatedMatches: matches, tournamentWinner };
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
    depMatch.sets = [];
    depMatch.setsWonA = null;
    depMatch.setsWonB = null;
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
 * Supports both single-set matches and best-of-3 set matches.
 */
export function recordMatchResult(
  matches: Match[],
  matchId: string,
  scoreA: number,
  scoreB: number,
  isWalkoverOverride: boolean = false,
  walkoverWinnerSlot?: 'A' | 'B',
  setsPayload?: { scoreA: number; scoreB: number }[]
): { updatedMatches: Match[]; tournamentWinner: Participant | null } {
  const match = matches.find((m) => m.id === matchId);
  if (!match) throw new Error(`Kamp med ID ${matchId} ble ikke funnet.`);
  if (!match.playerA || (!match.playerB && !isWalkoverOverride && !match.isWalkover)) {
    throw new Error('Begge spillere må være klare for å registrere resultat.');
  }

  const format = match.format || DEFAULT_FORMAT_SETTINGS[match.stage || 'regular'];
  const targetPts = format.targetPoints || 21;
  const winMargin = format.winMargin || 2;
  const isBo3 = format.sets === 3;

  let winnerSlot: 'A' | 'B';

  if (isWalkoverOverride && walkoverWinnerSlot) {
    winnerSlot = walkoverWinnerSlot;
    match.isWalkover = true;
    match.status = 'walkover';
    if (isBo3) {
      match.scoreA = winnerSlot === 'A' ? 2 : 0;
      match.scoreB = winnerSlot === 'B' ? 2 : 0;
      match.setsWonA = match.scoreA;
      match.setsWonB = match.scoreB;
      match.sets = [
        {
          setNumber: 1,
          scoreA: winnerSlot === 'A' ? targetPts : 0,
          scoreB: winnerSlot === 'B' ? targetPts : 0,
        },
        {
          setNumber: 2,
          scoreA: winnerSlot === 'A' ? targetPts : 0,
          scoreB: winnerSlot === 'B' ? targetPts : 0,
        },
      ];
    } else {
      match.scoreA = winnerSlot === 'A' ? targetPts : 0;
      match.scoreB = winnerSlot === 'B' ? targetPts : 0;
      match.setsWonA = winnerSlot === 'A' ? 1 : 0;
      match.setsWonB = winnerSlot === 'B' ? 1 : 0;
      match.sets = [
        {
          setNumber: 1,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
        },
      ];
    }
  } else if (isBo3 && setsPayload && setsPayload.length >= 2) {
    // Best av 3: valider hvert delsett
    const setResults: MatchSetScore[] = [];
    let winsA = 0;
    let winsB = 0;

    for (let i = 0; i < setsPayload.length; i++) {
      const s = setsPayload[i];
      const val = validateScore(s.scoreA, s.scoreB, targetPts, winMargin);
      if (!val.isValid || !val.winnerSlot) {
        throw new Error(`Ugyldig score i sett ${i + 1}: ${val.error || 'Feil'}`);
      }
      if (val.winnerSlot === 'A') winsA++;
      else winsB++;

      setResults.push({
        setNumber: i + 1,
        scoreA: s.scoreA,
        scoreB: s.scoreB,
      });

      // Hvis en spiller har 2 seire etter sett 2, skal sett 3 ikke være registrert
      if (i === 1 && (winsA === 2 || winsB === 2) && setsPayload.length > 2) {
        throw new Error('Kampen er avgjort 2–0 etter 2 sett. Sett 3 skal ikke spilles eller registreres.');
      }
    }

    if (winsA < 2 && winsB < 2) {
      throw new Error('En spiller må vinne 2 sett for å vinne kampen (best av 3).');
    }

    winnerSlot = winsA === 2 ? 'A' : 'B';
    match.setsWonA = winsA;
    match.setsWonB = winsB;
    match.scoreA = winsA;
    match.scoreB = winsB;
    match.sets = setResults;
    match.status = 'completed';
  } else {
    // 1 sett (eller fallback hvis scoreA/scoreB sendes)
    const val = validateScore(scoreA, scoreB, targetPts, winMargin);
    if (!val.isValid || !val.winnerSlot) {
      throw new Error(val.error || 'Ugyldig poengsum.');
    }
    winnerSlot = val.winnerSlot;
    match.setsWonA = winnerSlot === 'A' ? 1 : 0;
    match.setsWonB = winnerSlot === 'B' ? 1 : 0;
    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.sets = [{ setNumber: 1, scoreA, scoreB }];
    match.status = 'completed';
  }

  const winner = winnerSlot === 'A' ? match.playerA! : match.playerB!;
  match.winnerId = winner.id;
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
