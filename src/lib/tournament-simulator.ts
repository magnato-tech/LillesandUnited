import { Match, Tournament } from '../types';
import { recordMatchResult, resolveMatchFormat, validateScore } from './tournament';

export const SIM_FIXED_SCORING = { targetPoints: 21, winMargin: 2 };

export type SetScoreOutcome = {
  scoreA: number;
  scoreB: number;
  winnerSlot: 'A' | 'B';
};

export type MatchOutcome = {
  winnerSlot: 'A' | 'B';
  scoreA: number;
  scoreB: number;
  sets?: { scoreA: number; scoreB: number }[];
};

/** Pick A or B as set winner. */
function randomSlot(): 'A' | 'B' {
  return Math.random() < 0.5 ? 'A' : 'B';
}

/**
 * Generates a random 21-point set result with 2-point margin.
 * Does not simulate point-by-point play.
 */
export function generateRandomSetScore(winnerSlot?: 'A' | 'B'): SetScoreOutcome {
  const winner = winnerSlot ?? randomSlot();
  const target = SIM_FIXED_SCORING.targetPoints;
  const margin = SIM_FIXED_SCORING.winMargin;

  let winnerScore: number;
  let loserScore: number;

  if (Math.random() < 0.25) {
    const deuceExtra = Math.floor(Math.random() * 5);
    winnerScore = target + 1 + deuceExtra;
    loserScore = winnerScore - margin;
  } else {
    winnerScore = target;
    loserScore = Math.floor(Math.random() * (target - margin));
  }

  const scoreA = winner === 'A' ? winnerScore : loserScore;
  const scoreB = winner === 'B' ? winnerScore : loserScore;

  return { scoreA, scoreB, winnerSlot: winner };
}

/**
 * Generates a full match outcome based on match.format.sets only.
 * Scores always use 21 points / margin 2 regardless of format targetPoints.
 */
export function generateMatchOutcome(match: Match, formatSettings?: Tournament['formatSettings']): MatchOutcome {
  const numberOfSets = resolveMatchFormat(match, formatSettings).sets;
  const matchWinner = randomSlot();
  const loserSlot: 'A' | 'B' = matchWinner === 'A' ? 'B' : 'A';

  if (numberOfSets === 3) {
    const goesToThree = Math.random() < 0.5;
    const sets: { scoreA: number; scoreB: number }[] = [];

    if (goesToThree) {
      const set1 = generateRandomSetScore(matchWinner);
      const set2 = generateRandomSetScore(loserSlot);
      const set3 = generateRandomSetScore(matchWinner);
      sets.push({ scoreA: set1.scoreA, scoreB: set1.scoreB });
      sets.push({ scoreA: set2.scoreA, scoreB: set2.scoreB });
      sets.push({ scoreA: set3.scoreA, scoreB: set3.scoreB });
    } else {
      const set1 = generateRandomSetScore(matchWinner);
      const set2 = generateRandomSetScore(matchWinner);
      sets.push({ scoreA: set1.scoreA, scoreB: set1.scoreB });
      sets.push({ scoreA: set2.scoreA, scoreB: set2.scoreB });
    }

    const winsA = sets.filter((s) => s.scoreA > s.scoreB).length;
    const winsB = sets.filter((s) => s.scoreB > s.scoreA).length;

    return {
      winnerSlot: matchWinner,
      scoreA: winsA,
      scoreB: winsB,
      sets,
    };
  }

  const set = generateRandomSetScore(matchWinner);
  return {
    winnerSlot: set.winnerSlot,
    scoreA: set.scoreA,
    scoreB: set.scoreB,
  };
}

/** Next ready/in_progress match with both players, lowest round first. */
export function getNextPlayableMatch(matches: Match[]): Match | null {
  const playable = matches
    .filter(
      (m) =>
        (m.status === 'ready' || m.status === 'in_progress') &&
        m.playerA &&
        m.playerB &&
        !m.isWalkover
    )
    .sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.position - b.position;
    });

  return playable[0] ?? null;
}

export function isTournamentComplete(
  matches: Match[],
  tournamentWinner?: { id: string } | null
): boolean {
  if (tournamentWinner) return true;
  const finalMatch = matches.find((m) => !m.nextMatchId);
  return Boolean(finalMatch?.winnerId);
}

export function buildScorePayload(outcome: MatchOutcome) {
  return {
    scoreA: outcome.scoreA,
    scoreB: outcome.scoreB,
    winnerSlot: outcome.winnerSlot,
    sets: outcome.sets,
  };
}

/**
 * Applies one simulated match result using the production advancement engine.
 * Mutates the given tournament clone in place. Does not persist.
 */
export function applySimulatedMatchToTournament(tournament: Tournament, matchId: string): Tournament {
  const match = tournament.matches.find((m) => m.id === matchId);
  if (!match) throw new Error('Kamp ikke funnet.');
  if (match.status !== 'ready' && match.status !== 'in_progress') {
    throw new Error('Kampen er ikke spillbar.');
  }

  const payload = buildScorePayload(generateMatchOutcome(match, tournament.formatSettings));
  const { updatedMatches, tournamentWinner } = recordMatchResult(
    tournament.matches,
    matchId,
    payload.scoreA,
    payload.scoreB,
    false,
    undefined,
    payload.sets,
    payload.winnerSlot
  );

  tournament.matches = updatedMatches;
  if (tournamentWinner) {
    tournament.winner = tournamentWinner;
    tournament.status = 'completed';
    tournament.completedAt = new Date().toISOString();
  }
  return tournament;
}

export function countTotalPlayableMatches(matches: Match[]): number {
  return matches.filter((m) => m.playerA && m.playerB && !m.isWalkover).length;
}

export function canRunSimulation(
  participants: { personId?: string | null }[],
  persons: { id: string; isSimulated?: boolean }[]
): { allowed: boolean; reason?: string } {
  if (participants.length === 0) {
    return {
      allowed: false,
      reason: 'Ingen deltakere i turneringen. Bruk Test → Simuler spillere først.',
    };
  }

  for (const participant of participants) {
    const person = persons.find((p) => p.id === participant.personId);
    if (!person) {
      return { allowed: false, reason: 'Alle deltakere må ha gyldig person-profil.' };
    }
    if (!person.isSimulated) {
      return {
        allowed: false,
        reason:
          'Simulering er kun tillatt med testspillere. Bruk Test → Simuler 16/32/64 først.',
      };
    }
  }

  return { allowed: true };
}

/** Validates that generated scores pass technical validation only. */
export function assertOutcomeTechnicallyValid(outcome: MatchOutcome): boolean {
  if (outcome.sets && outcome.sets.length > 0) {
    return outcome.sets.every((s) => validateScore(s.scoreA, s.scoreB).isValid);
  }
  return validateScore(outcome.scoreA, outcome.scoreB).isValid;
}
