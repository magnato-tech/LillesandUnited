import { AppState, Match, Person, PopcornBong } from '../types';

export interface ValidationResult {
  ok: boolean;
  issues: string[];
}

function issue(issues: string[], msg: string): void {
  issues.push(msg);
}

function validatePersons(persons: Person[], issues: string[]): void {
  const ids = new Set<string>();
  const tokens = new Set<string>();
  const displayIds = new Set<string>();
  const byFirstName = new Map<string, number[]>();

  for (const p of persons) {
    if (!p.id) issue(issues, 'Person mangler id');
    else if (ids.has(p.id)) issue(issues, `Duplikat person.id: ${p.id}`);
    else ids.add(p.id);

    if (!p.anonymousToken) issue(issues, `Person ${p.id} mangler anonymousToken`);
    else if (tokens.has(p.anonymousToken)) {
      issue(issues, `Duplikat anonymousToken for person ${p.id}`);
    } else tokens.add(p.anonymousToken);

    const expectedDisplay = `${p.firstName}_${p.nameNumber}`;
    if (p.displayId !== expectedDisplay) {
      issue(issues, `Person ${p.id}: displayId er "${p.displayId}", forventet "${expectedDisplay}"`);
    }
    if (displayIds.has(p.displayId)) {
      issue(issues, `Duplikat displayId: ${p.displayId}`);
    } else {
      displayIds.add(p.displayId);
    }

    const key = (p.firstName || '').toLowerCase();
    const nums = byFirstName.get(key) || [];
    nums.push(p.nameNumber);
    byFirstName.set(key, nums);
  }

  for (const [name, nums] of byFirstName) {
    const sorted = [...nums].sort((a, b) => a - b);
    const unique = new Set(sorted);
    if (unique.size !== sorted.length) {
      issue(issues, `Duplikat nameNumber for fornavn "${name}"`);
    }
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i + 1) {
        issue(issues, `nameNumber-hull for "${name}": forventet 1..${sorted.length}, fikk [${sorted.join(', ')}]`);
        break;
      }
    }
  }
}

function validatePopcorn(state: AppState, issues: string[]): void {
  const { popcorn, event } = state;
  if (!popcorn?.bongs || !Array.isArray(popcorn.bongs)) {
    issue(issues, 'popcorn.bongs mangler eller er ugyldig');
    return;
  }

  if (event.freePopcornLimit !== popcorn.totalCapacity) {
    issue(
      issues,
      `event.freePopcornLimit (${event.freePopcornLimit}) !== popcorn.totalCapacity (${popcorn.totalCapacity})`
    );
  }

  const activeCount = popcorn.bongs.filter(
    (b) => b.status === 'activated' || b.status === 'used'
  ).length;
  if (event.popcornClaimedCount !== activeCount) {
    issue(
      issues,
      `event.popcornClaimedCount (${event.popcornClaimedCount}) !== faktisk aktive/brukt (${activeCount})`
    );
  }

  const numbers = new Set<number>();
  const personBongs = new Map<string, number>();

  for (const bong of popcorn.bongs) {
    if (numbers.has(bong.number)) {
      issue(issues, `Duplikat bongnummer: #${bong.number}`);
    } else {
      numbers.add(bong.number);
    }

    if (bong.number < 1 || bong.number > popcorn.totalCapacity) {
      issue(issues, `Bong #${bong.number} utenfor kapasitet 1–${popcorn.totalCapacity}`);
    }

    if (bong.status === 'blank') {
      if (bong.personId) issue(issues, `Blank bong #${bong.number} har personId`);
      if (bong.usedAt) issue(issues, `Blank bong #${bong.number} har usedAt`);
    }

    if (bong.status === 'activated' || bong.status === 'used') {
      if (!bong.personId && !bong.clientToken) {
        issue(issues, `Bong #${bong.number} (${bong.status}) mangler både personId og clientToken`);
      }
      if (bong.personId) {
        if (personBongs.has(bong.personId)) {
          issue(
            issues,
            `Person ${bong.personId} har flere bonger (#${personBongs.get(bong.personId)} og #${bong.number})`
          );
        } else {
          personBongs.set(bong.personId, bong.number);
        }
      }
    }

    if (bong.status === 'used' && !bong.usedAt) {
      issue(issues, `Bong #${bong.number} er "used" men mangler usedAt`);
    }
  }

  for (const p of state.persons || []) {
    const bong = popcorn.bongs.find((b) => b.personId === p.id);
    if (bong && bong.userName && bong.userName !== p.displayId) {
      issue(
        issues,
        `Bong #${bong.number} userName "${bong.userName}" matcher ikke person.displayId "${p.displayId}"`
      );
    }
  }
}

function validateParticipants(state: AppState, issues: string[]): void {
  const { tournament, persons } = state;
  const personMap = new Map((persons || []).map((p) => [p.id, p]));
  const personIds = new Set<string>();
  const capacity = tournament.bracketCapacity ?? 16;

  if (tournament.participants.length > capacity) {
    issue(
      issues,
      `Antall deltakere (${tournament.participants.length}) overstiger bracketCapacity (${capacity})`
    );
  }

  for (const p of tournament.participants) {
    if (!p.id) issue(issues, 'Participant mangler id');

    if (p.personId) {
      if (personIds.has(p.personId)) {
        issue(issues, `Duplikat personId i participants: ${p.personId}`);
      } else {
        personIds.add(p.personId);
      }

      const person = personMap.get(p.personId);
      if (!person) {
        issue(issues, `Participant ${p.id} refererer til ukjent personId ${p.personId}`);
      } else {
        if (p.displayId && p.displayId !== person.displayId) {
          issue(
            issues,
            `Participant ${p.id} displayId "${p.displayId}" matcher ikke person "${person.displayId}"`
          );
        }
        if (p.firstName !== person.firstName) {
          issue(
            issues,
            `Participant ${p.id} firstName "${p.firstName}" matcher ikke person "${person.firstName}"`
          );
        }
      }
    }
  }
}

function getWinnerParticipant(match: Match) {
  if (!match.winnerId) return null;
  if (match.playerA?.id === match.winnerId) return match.playerA;
  if (match.playerB?.id === match.winnerId) return match.playerB;
  return null;
}

function validateMatches(state: AppState, issues: string[]): void {
  const { tournament } = state;
  const matches = tournament.matches;
  const matchMap = new Map(matches.map((m) => [m.id, m]));
  const inProgressByTable = new Map<number, string>();

  for (const match of matches) {
    if (match.nextMatchId && !matchMap.has(match.nextMatchId)) {
      issue(issues, `Kamp ${match.id} peker på ukjent nextMatchId ${match.nextMatchId}`);
    }

    if (match.winnerId) {
      const winner =
        match.playerA?.id === match.winnerId
          ? match.playerA
          : match.playerB?.id === match.winnerId
          ? match.playerB
          : null;
      if (!winner) {
        issue(issues, `Kamp ${match.id}: winnerId ${match.winnerId} finnes ikke blant spillere`);
      }
    }

    if (match.status === 'walkover' || match.isWalkover) {
      if (!match.playerA) issue(issues, `Walkover ${match.id} mangler playerA`);
      if (match.playerB) issue(issues, `Walkover ${match.id} skal ikke ha playerB`);
      if (match.winnerId && match.playerA && match.winnerId !== match.playerA.id) {
        issue(issues, `Walkover ${match.id}: winnerId matcher ikke playerA`);
      }
    }

    if (match.status === 'completed') {
      if (match.scoreA === null || match.scoreB === null) {
        issue(issues, `Fullført kamp ${match.id} mangler score`);
      }
      if (!match.winnerId) {
        issue(issues, `Fullført kamp ${match.id} mangler winnerId`);
      }
    }

    if (match.status === 'in_progress' && match.tableNumber) {
      const existing = inProgressByTable.get(match.tableNumber);
      if (existing) {
        issue(
          issues,
          `Bord ${match.tableNumber} har flere kamper in_progress: ${existing} og ${match.id}`
        );
      } else {
        inProgressByTable.set(match.tableNumber, match.id);
      }
    }

    if (
      (match.status === 'completed' || match.status === 'walkover') &&
      match.winnerId &&
      match.nextMatchId &&
      match.nextMatchSlot
    ) {
      const next = matchMap.get(match.nextMatchId);
      const winner = getWinnerParticipant(match);
      if (next && winner) {
        const slotPlayer = match.nextMatchSlot === 'A' ? next.playerA : next.playerB;
        if (slotPlayer && slotPlayer.id !== winner.id) {
          issue(
            issues,
            `Kamp ${match.id}: vinner ${winner.displayId || winner.firstName} er ikke i neste kamp ${next.id} slot ${match.nextMatchSlot}`
          );
        }
      }
    }
  }

  const finalMatch = matches.find((m) => !m.nextMatchId);
  if (tournament.winner) {
    if (!finalMatch) {
      issue(issues, 'tournament.winner er satt men ingen finale-kamp finnes');
    } else if (finalMatch.winnerId !== tournament.winner.id) {
      issue(
        issues,
        `tournament.winner (${tournament.winner.id}) matcher ikke finale-vinner (${finalMatch.winnerId})`
      );
    }
  }

  if (tournament.status === 'completed' && !tournament.winner) {
    issue(issues, 'tournament.status er "completed" men winner er null');
  }
}

/**
 * Validerer at AppState er konsistent på tvers av persons, popcorn og turnering.
 */
export function validateAppState(state: AppState): ValidationResult {
  const issues: string[] = [];

  if (!state) {
    return { ok: false, issues: ['State er null/undefined'] };
  }

  validatePersons(state.persons || [], issues);
  validatePopcorn(state, issues);
  validateParticipants(state, issues);
  validateMatches(state, issues);

  return { ok: issues.length === 0, issues };
}

/**
 * Beregner forventet popcornClaimedCount fra bong-data (som loadState gjør).
 */
export function computePopcornClaimedCount(bongs: PopcornBong[]): number {
  return bongs.filter((b) => b.status === 'activated' || b.status === 'used').length;
}
