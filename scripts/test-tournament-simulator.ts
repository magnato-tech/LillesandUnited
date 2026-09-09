import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyFormatSettingsToPlayableMatches,
  canDrawCup,
  generateBracket,
  resolveDrawCapacity,
  normalizeFormatSettings,
  normalizeStageFormatConfig,
  recordMatchResult,
  tournamentHasCupData,
} from '../src/lib/tournament';
import {
  applySimulatedMatchToTournament,
  assertOutcomeTechnicallyValid,
  generateMatchOutcome,
  generateRandomSetScore,
  getNextPlayableMatch,
  isTournamentComplete,
  SIM_FIXED_SCORING,
} from '../src/lib/tournament-simulator';
import type { Match, Participant, Tournament } from '../src/types';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
}

function makeParticipants(n: number): Participant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    personId: `person_${i}`,
    firstName: `Spiller${i + 1}`,
    displayId: `Spiller${i + 1}_1`,
    registeredAt: new Date().toISOString(),
  }));
}

console.log('Test: tournament-simulator\n');

const legacyNormalized = normalizeStageFormatConfig({
  sets: 1,
  numberOfSets: 3,
  targetPoints: 21,
  winMargin: 2,
});
assert(legacyNormalized.sets === 3, 'Legacy numberOfSets:3 + sets:1 skal normaliseres til sets:3');
assert(
  !('numberOfSets' in legacyNormalized),
  'Normalisert config skal ikke inneholde numberOfSets'
);

const legacyBuggySettings = {
  regular: { sets: 1, targetPoints: 21, winMargin: 2 },
  semifinal: { sets: 1, numberOfSets: 3, targetPoints: 21, winMargin: 2 },
  final: { sets: 1, numberOfSets: 3, targetPoints: 21, winMargin: 2 },
};
const normalizedSettings = normalizeFormatSettings(legacyBuggySettings as never);
assert(normalizedSettings.semifinal.sets === 3, 'normalizeFormatSettings semifinal.sets');
assert(normalizedSettings.final.sets === 3, 'normalizeFormatSettings final.sets');
console.log('✓ Format-normalisering');

assert(SIM_FIXED_SCORING.targetPoints === 21, 'Simulator bruker 21 poeng');
assert(SIM_FIXED_SCORING.winMargin === 2, 'Simulator bruker margin 2');

const hookPath = join(dirname(fileURLToPath(import.meta.url)), '../src/hooks/useTournamentSimulator.ts');
const hookSource = readFileSync(hookPath, 'utf-8');
assert(!hookSource.includes('submitMatchScore'), 'Hook skal ikke bruke submitMatchScore');
assert(!hookSource.includes('/api/tournament/match/score'), 'Hook skal ikke kalle match/score API');
assert(!hookSource.includes('fetchState'), 'Hook skal ikke hente server-state per kamp');
assert(!hookSource.includes("from '../services/api'"), 'Hook skal ikke importere persistens-API');
assert(hookSource.includes('recordMatchResult') || hookSource.includes('applySimulatedMatchToTournament'), 'Hook skal bruke produksjonsmotoren');
console.log('✓ Hook har ingen persistens-kallsti');

for (let i = 0; i < 50; i++) {
  const set = generateRandomSetScore();
  assert(set.scoreA >= 0 && set.scoreB >= 0, 'Settscore må være ikke-negative');
  assert(set.scoreA !== set.scoreB, 'Settscore må ha vinner (ikke uavgjort i enkeltsett)');
}

const singleSetMatch: Match = {
  id: 'm1',
  round: 1,
  roundName: 'Runde 1',
  position: 0,
  format: { sets: 1, targetPoints: 21, winMargin: 2 },
  playerA: makeParticipants(1)[0],
  playerB: makeParticipants(2)[1],
  winnerId: null,
  scoreA: null,
  scoreB: null,
  tableNumber: null,
  status: 'ready',
  isWalkover: false,
  nextMatchId: null,
  nextMatchSlot: null,
};

const singleOutcome = generateMatchOutcome(singleSetMatch);
assert(singleOutcome.sets === undefined, '1-sett kamp skal ikke ha sett-array');
assert(assertOutcomeTechnicallyValid(singleOutcome), '1-sett outcome må være teknisk gyldig');

const bo3Match: Match = {
  ...singleSetMatch,
  id: 'm2',
  format: { sets: 3, targetPoints: 21, winMargin: 2 },
};

for (let i = 0; i < 30; i++) {
  const outcome = generateMatchOutcome(bo3Match);
  assert(outcome.sets !== undefined, 'Best av 3 må ha sett');
  assert(outcome.sets!.length === 2 || outcome.sets!.length === 3, 'Bo3 må gi 2 eller 3 sett');
  assert(outcome.scoreA === 2 || outcome.scoreB === 2, 'Bo3 må ende 2–0 eller 2–1');
  assert(assertOutcomeTechnicallyValid(outcome), 'Bo3 outcome må være teknisk gyldig');
}

const participants = makeParticipants(16);
const bo3FormatSettings = normalizeFormatSettings({
  regular: { sets: 1, targetPoints: 21, winMargin: 2 },
  semifinal: { sets: 3, targetPoints: 21, winMargin: 2 },
  final: { sets: 3, targetPoints: 21, winMargin: 2 },
});
const bracketMatches = generateBracket(participants, 16, bo3FormatSettings);
const regularMatch = bracketMatches.find((m) => m.stage === 'regular');
const semiMatch = bracketMatches.find((m) => m.stage === 'semifinal');
const finalMatch = bracketMatches.find((m) => m.stage === 'final');
assert(regularMatch?.format?.sets === 1, 'Regular kamper skal ha sets: 1');
assert(semiMatch?.format?.sets === 3, 'Semifinale skal ha sets: 3');
assert(finalMatch?.format?.sets === 3, 'Finale skal ha sets: 3');
console.log('✓ generateBracket setter match.format.sets per stage');

const staleTournament: Tournament = {
  id: 'stale',
  status: 'active',
  startedAt: new Date().toISOString(),
  completedAt: null,
  participants: makeParticipants(2),
  matches: [
    {
      ...singleSetMatch,
      id: 'stale_semi',
      stage: 'semifinal',
      format: { sets: 1, targetPoints: 21, winMargin: 2 },
      status: 'ready',
    },
  ],
  winner: null,
  estimatedMinutesPerMatch: 10,
  formatSettings: {
    regular: { sets: 1, targetPoints: 21, winMargin: 2 },
    semifinal: { sets: 3, targetPoints: 21, winMargin: 2 },
    final: { sets: 3, targetPoints: 21, winMargin: 2 },
  },
};
applyFormatSettingsToPlayableMatches(staleTournament);
assert(
  staleTournament.matches[0].format?.sets === 3,
  'applyFormatSettingsToPlayableMatches skal synce match.format fra formatSettings'
);
console.log('✓ Simulator syncer format fra kampoppsett');

const bo3Players = makeParticipants(2);
const bo3ReadyMatch: Match = {
  ...singleSetMatch,
  id: 'bo3_record',
  format: { sets: 3, targetPoints: 21, winMargin: 2 },
  playerA: bo3Players[0],
  playerB: bo3Players[1],
  status: 'ready',
};

const bo3Matches = [structuredClone(bo3ReadyMatch)];
const twoZero = recordMatchResult(
  bo3Matches,
  'bo3_record',
  0,
  0,
  false,
  undefined,
  [{ scoreA: 21, scoreB: 18 }, { scoreA: 21, scoreB: 15 }],
  'A'
);
assert(twoZero.updatedMatches[0].scoreA === 2, 'Bo3 2–0 scoreA');
assert(twoZero.updatedMatches[0].scoreB === 0, 'Bo3 2–0 scoreB');
assert(twoZero.updatedMatches[0].sets?.length === 2, 'Bo3 2–0 lagrer 2 sett');

const bo3Matches21 = [structuredClone(bo3ReadyMatch)];
const twoOne = recordMatchResult(
  bo3Matches21,
  'bo3_record',
  0,
  0,
  false,
  undefined,
  [
    { scoreA: 21, scoreB: 18 },
    { scoreA: 15, scoreB: 21 },
    { scoreA: 21, scoreB: 19 },
  ],
  'A'
);
assert(twoOne.updatedMatches[0].scoreA === 2, 'Bo3 2–1 scoreA');
assert(twoOne.updatedMatches[0].scoreB === 1, 'Bo3 2–1 scoreB');
assert(twoOne.updatedMatches[0].sets?.length === 3, 'Bo3 2–1 lagrer 3 sett');

let bo3InvalidThrown = false;
try {
  recordMatchResult(
    [structuredClone(bo3ReadyMatch)],
    'bo3_record',
    0,
    0,
    false,
    undefined,
    [{ scoreA: 21, scoreB: 18 }, { scoreA: 18, scoreB: 21 }],
    'A'
  );
} catch {
  bo3InvalidThrown = true;
}
assert(bo3InvalidThrown, 'Bo3 1–1 med 2 sett skal avvises');
console.log('✓ recordMatchResult bo3-validering');

const originalTournament: Tournament = {
  id: 't_sim_test',
  status: 'active',
  startedAt: new Date().toISOString(),
  completedAt: null,
  participants,
  matches: bracketMatches,
  winner: null,
  estimatedMinutesPerMatch: 10,
  bracketCapacity: 16,
};

const originalSnapshot = JSON.stringify(originalTournament);
const clone = structuredClone(originalTournament);

let safety = 0;
while (getNextPlayableMatch(clone.matches) && safety < 64) {
  const next = getNextPlayableMatch(clone.matches)!;
  applySimulatedMatchToTournament(clone, next.id);
  safety++;
}

assert(isTournamentComplete(clone.matches, clone.winner), 'Simulering skal nå finale/vinner');
assert(clone.winner !== null, 'Simulert turnering må ha vinner');
assert(clone.status === 'completed', 'Simulert turnering skal være completed');
assert(JSON.stringify(originalTournament) === originalSnapshot, 'Original tournament-state skal være uendret');
assert(typeof recordMatchResult === 'function', 'recordMatchResult er kilden til advancement');

const walkover = originalTournament.matches.find((m) => m.isWalkover);
if (walkover) {
  assert(getNextPlayableMatch([walkover]) === null, 'Walkover-kamp skal ikke velges');
}

const fiveDrawCapacity = resolveDrawCapacity(5, 16);
assert(fiveDrawCapacity === 8, '5 spillere skal trekkes i 8-slots cup');
const fivePlayerBracket = generateBracket(makeParticipants(5), fiveDrawCapacity);
assert(fivePlayerBracket.length === 7, '5 spillere på 8-slots cup skal gi 7 kamper');
assert(
  fivePlayerBracket.some((m) => m.round === 1 && m.status === 'walkover'),
  '5 spillere skal ha walkovers i runde 1'
);

const twoDrawCapacity = resolveDrawCapacity(2, 16);
assert(twoDrawCapacity === 4, '2 spillere skal trekkes i 4-slots cup');
const twoPlayerBracket = generateBracket(makeParticipants(2), twoDrawCapacity);
assert(twoPlayerBracket.length === 3, '2 spillere på 4-slots cup skal gi 3 kamper');

const registrationTournament: Tournament = {
  id: 'draw_test',
  status: 'registration',
  startedAt: null,
  completedAt: null,
  participants: makeParticipants(5),
  matches: [],
  winner: null,
  estimatedMinutesPerMatch: 10,
  bracketCapacity: 16,
};
assert(canDrawCup(registrationTournament), 'canDrawCup med 5 spillere og ingen cup');
assert(!tournamentHasCupData(registrationTournament), 'Ingen cup-data før trekning');
assert(
  !canDrawCup({ ...registrationTournament, matches: bracketMatches }),
  'canDrawCup false når cup allerede finnes'
);
console.log('✓ Fleksibel cup-trekning (2–N spillere)');

console.log('✓ Alle simulator-tester bestått.\n');
