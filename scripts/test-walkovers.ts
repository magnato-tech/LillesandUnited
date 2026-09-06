import { generateBracket } from '../src/lib/tournament';
import type { Match, Participant } from '../src/types';

function makeParticipants(n: number): Participant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    personId: `person_${i}`,
    firstName: `Spiller${i + 1}`,
    displayId: `Spiller${i + 1}_1`,
    userId: null,
    registeredAt: new Date().toISOString(),
  }));
}

function bracketSize(n: number): number {
  let size = 2;
  while (size < n) size *= 2;
  return size;
}

function validateBracket(n: number, capacity: number, runs = 20) {
  const expectedBracket = capacity;
  const expectedWalkovers = expectedBracket - n;
  const issues: string[] = [];
  let sample: { walkoverPlayer: string; nextMatch: string; nextOpponent: string | null } | undefined;

  for (let run = 0; run < runs; run++) {
    const participants = makeParticipants(n);
    const matches = generateBracket(participants, capacity as 16 | 32 | 64);

    const r1 = matches.filter((m) => m.round === 1);
    const walkoverMatches = r1.filter((m) => m.isWalkover || m.status === 'walkover');
    const regularR1 = r1.filter((m) => !m.isWalkover);

    if (r1.length !== expectedBracket / 2) {
      issues.push(`run ${run}: r1 count ${r1.length}, expected ${expectedBracket / 2}`);
    }
    if (walkoverMatches.length !== expectedWalkovers) {
      issues.push(
        `run ${run}: walkover count ${walkoverMatches.length}, expected ${expectedWalkovers}`
      );
    }

    const walkoverPlayerIds = new Set<string>();
    for (const wo of walkoverMatches) {
      if (!wo.playerA) issues.push(`run ${run}: WO ${wo.id} missing playerA`);
      if (wo.playerB) issues.push(`run ${run}: WO ${wo.id} should not have playerB`);
      if (wo.winnerId !== wo.playerA?.id) issues.push(`run ${run}: WO ${wo.id} winner mismatch`);
      if (wo.status !== 'walkover') issues.push(`run ${run}: WO ${wo.id} wrong status`);
      if (wo.walkoverPlayerId !== wo.playerA?.id) {
        issues.push(`run ${run}: WO ${wo.id} walkoverPlayerId mismatch`);
      }

      const player = wo.playerA!;
      if (walkoverPlayerIds.has(player.id)) {
        issues.push(`run ${run}: player ${player.id} received multiple walkovers`);
      }
      walkoverPlayerIds.add(player.id);

      if (!wo.nextMatchId) {
        issues.push(`run ${run}: WO ${wo.id} has no nextMatchId`);
        continue;
      }

      const next = matches.find((m) => m.id === wo.nextMatchId);
      if (!next) {
        issues.push(`run ${run}: next match ${wo.nextMatchId} not found`);
        continue;
      }

      const inNext =
        next.playerA?.id === player.id || next.playerB?.id === player.id;
      if (!inNext) {
        issues.push(
          `run ${run}: WO player ${player.displayId} not placed in next match ${next.id}`
        );
      } else {
        const slotOk =
          (wo.nextMatchSlot === 'A' && next.playerA?.id === player.id) ||
          (wo.nextMatchSlot === 'B' && next.playerB?.id === player.id);
        if (!slotOk) {
          issues.push(`run ${run}: wrong slot for ${player.displayId} in ${next.id}`);
        }
      }

      if (run === 0 && !sample) {
        const opponent =
          next.playerA?.id === player.id ? next.playerB : next.playerA;
        sample = {
          walkoverPlayer: player.displayId || player.firstName,
          nextMatch: `${next.roundName} (${next.id})`,
          nextOpponent: opponent ? opponent.displayId || opponent.firstName : 'venter på motstander',
        };
      }
    }

    for (const m of regularR1) {
      if (!m.playerA || !m.playerB) {
        issues.push(`run ${run}: regular match ${m.id} missing players`);
      }
    }

    const usedInR1 = new Set<string>();
    for (const m of r1) {
      if (m.playerA) usedInR1.add(m.playerA.id);
      if (m.playerB) usedInR1.add(m.playerB.id);
    }
    if (usedInR1.size !== n) {
      issues.push(`run ${run}: only ${usedInR1.size}/${n} players used in round 1`);
    }

    // Every participant should appear exactly once in round 1 (either in WO or regular)
    for (const p of participants) {
      if (!usedInR1.has(p.id)) {
        issues.push(`run ${run}: participant ${p.id} missing from round 1`);
      }
    }
  }

  return {
    n,
    expectedBracket,
    expectedWalkovers,
    ok: issues.length === 0,
    issues,
    sample,
  };
}

function printTreeSample(n: number, capacity: number): void {
  const participants = makeParticipants(n);
  const matches = generateBracket(participants, capacity as 16 | 32 | 64);
  const totalRounds = Math.max(...matches.map((m) => m.round));

  console.log(`\nEksempel-tre for ${n} spillere (cup ${capacity}, ${capacity / 2} kamper r1):`);

  for (let round = 1; round <= Math.min(2, totalRounds); round++) {
    const roundMatches = matches
      .filter((m) => m.round === round)
      .sort((a, b) => a.position - b.position);

    console.log(`  Runde ${round} (${roundMatches[0]?.roundName || ''}):`);
    for (const m of roundMatches) {
      if (m.isWalkover) {
        const next = m.nextMatchId
          ? matches.find((x) => x.id === m.nextMatchId)
          : null;
        const advanced =
          next &&
          (next.playerA?.id === m.playerA?.id || next.playerB?.id === m.playerA?.id);
        console.log(
          `    [WO] ${m.playerA?.displayId} -> videre til ${m.nextMatchId} (OK=${advanced})`
        );
      } else {
        console.log(
          `    ${m.playerA?.displayId} vs ${m.playerB?.displayId} (${m.status})`
        );
      }
    }
  }
}

const testCases = [
  { players: 8, capacity: 16 },
  { players: 17, capacity: 32 },
  { players: 35, capacity: 64 },
  { players: 63, capacity: 64 },
];
let allOk = true;

for (const { players, capacity } of testCases) {
  const result = validateBracket(players, capacity, 50);
  console.log(
    `\n=== ${players} spillere @ cup ${capacity} | ${result.expectedWalkovers} walkover(s) ===`
  );
  console.log(result.ok ? 'PASS (50 random runs)' : `FAIL (${result.issues.length} issues)`);
  if (!result.ok) {
    allOk = false;
    result.issues.slice(0, 8).forEach((i) => console.log(`  - ${i}`));
  }
  if (result.sample) {
    console.log(
      `  Eksempel: ${result.sample.walkoverPlayer} fikk walkover -> ${result.sample.nextMatch}, motstander: ${result.sample.nextOpponent}`
    );
  }
  printTreeSample(players, capacity);
}

process.exit(allOk ? 0 : 1);
