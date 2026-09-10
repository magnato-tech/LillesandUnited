import {
  generateBracket,
  validateScore,
  recordMatchResult,
  invalidateDependencies,
  calculateServer,
  resolveBracketCapacity,
} from '../src/lib/tournament';
import type { Participant, Match, Person, AppState } from '../src/types';

const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const RESET_PIN = process.env.RESET_PIN || 'ResetUnited2026';

async function api(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function adminApi(path: string, options: RequestInit = {}) {
  return api(path, {
    ...options,
    headers: {
      'x-admin-pin': process.env.ADMIN_PIN || 'United2026',
      ...(options.headers as Record<string, string>),
    },
  });
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

async function runRetest() {
  console.log('====================================================');
  console.log('GAIS – KRITISK RETEST (12 PUNKTER)');
  console.log('====================================================\n');

  // Reset before starting
  await adminApi('/api/admin/reset-all', {
    method: 'POST',
    body: JSON.stringify({ resetPin: RESET_PIN }),
  });

  // ----------------------------------------------------
  // TEST 1: Samtidige popcorn-bonger (12 pers, samtidige requester)
  // ----------------------------------------------------
  console.log('Test 1: Samtidige popcorn-bonger...');
  const persons12: Person[] = [];
  for (let i = 1; i <= 12; i++) {
    const res = await api('/api/persons', {
      method: 'POST',
      body: JSON.stringify({ firstName: `PopcornGjest_${i}` }),
    });
    assert(res.ok, `Kunne ikke opprette person ${i}: ${JSON.stringify(res.data)}`);
    persons12.push(res.data.person);
  }
  assert(persons12.length === 12, 'Skulle opprette 12 personer');

  // Aktiver bonger samtidig
  const bongPromises = persons12.map((p) =>
    api('/api/popcorn/activate', {
      method: 'POST',
      body: JSON.stringify({ personId: p.id }),
    })
  );
  const bongResponses = await Promise.all(bongPromises);

  const assignedNumbers = new Set<number>();
  for (let i = 0; i < bongResponses.length; i++) {
    const res = bongResponses[i];
    assert(res.ok, `Aktivering feilet for person ${persons12[i].displayId}`);
    const bongNum = res.data.bong.number;
    assert(bongNum >= 1 && bongNum <= 100, `Ugyldig bongnummer: ${bongNum}`);
    assert(!assignedNumbers.has(bongNum), `Duplikat bongnummer ${bongNum} oppdaget!`);
    assignedNumbers.add(bongNum);
    assert(res.data.bong.personId === persons12[i].id, 'Feil personId på bong');
  }
  assert(assignedNumbers.size === 12, '12 forskjellige bongnummer forventet');
  console.log(`✓ Test 1 BESTÅTT: 12 unike bongnummer tildelt uten overskriving: [${Array.from(assignedNumbers).join(', ')}]\n`);

  // ----------------------------------------------------
  // TEST 2: Samme navn (Oliver_1 vs Oliver_2 data-isolasjon)
  // ----------------------------------------------------
  console.log('Test 2: Samme navn (Oliver_1 og Oliver_2 data-isolasjon)...');
  const o1Res = await api('/api/persons', {
    method: 'POST',
    body: JSON.stringify({ firstName: 'Oliver' }),
  });
  const o2Res = await api('/api/persons', {
    method: 'POST',
    body: JSON.stringify({ firstName: 'Oliver' }),
  });
  const oliver1: Person = o1Res.data.person;
  const oliver2: Person = o2Res.data.person;

  assert(oliver1.displayId === 'Oliver_1', `Forventet Oliver_1, fikk ${oliver1.displayId}`);
  assert(oliver2.displayId === 'Oliver_2', `Forventet Oliver_2, fikk ${oliver2.displayId}`);
  assert(oliver1.id !== oliver2.id, 'Oliver_1 og Oliver_2 må ha forskjellige person-IDer');

  // Oliver_1 melder seg på bordtennis
  const o1Tour = await api('/api/register', {
    method: 'POST',
    body: JSON.stringify({ personId: oliver1.id }),
  });
  assert(o1Tour.ok, `Oliver_1 registrering bordtennis feilet: ${JSON.stringify(o1Tour.data)}`);

  // Oliver_2 melder interesse for Alpha
  const o2Alpha = await api('/api/alpha/interest', {
    method: 'POST',
    body: JSON.stringify({ personId: oliver2.id, phone: '99887766' }),
  });
  assert(o2Alpha.ok, 'Oliver_2 Alpha feilet');

  // Hent status for begge
  const stateRes = await api('/api/state');
  const currentState: AppState = stateRes.data;

  const o1InTour = currentState.tournament.participants.find((p) => p.personId === oliver1.id);
  const o2InTour = currentState.tournament.participants.find((p) => p.personId === oliver2.id);
  const o1InAlpha = currentState.alphaInterests.find((a) => a.personId === oliver1.id);
  const o2InAlpha = currentState.alphaInterests.find((a) => a.personId === oliver2.id);

  assert(Boolean(o1InTour) && !o2InTour, 'Oliver_1 skal være i turnering, men IKKE Oliver_2');
  assert(!o1InAlpha && Boolean(o2InAlpha), 'Oliver_2 skal være i Alpha, men IKKE Oliver_1');
  console.log('✓ Test 2 BESTÅTT: Data for Oliver_1 og Oliver_2 er fullstendig isolert og aldri blandet.\n');

  // ----------------------------------------------------
  // TEST 3: Dobbel påmelding (Idempotens)
  // ----------------------------------------------------
  console.log('Test 3: Dobbel påmelding (samme person to ganger)...');
  const initialParticipantCount = currentState.tournament.participants.length;

  const dupRes = await api('/api/register', {
    method: 'POST',
    body: JSON.stringify({ personId: oliver1.id }),
  });
  assert(dupRes.ok, 'Gjentatt påmelding skal svare ok (idempotent)');
  assert(dupRes.data.alreadyRegistered === true, 'alreadyRegistered flagg skal være true');

  const afterDupState = await api('/api/state');
  assert(
    afterDupState.data.tournament.participants.length === initialParticipantCount,
    'Deltakerantallet skal IKKE øke ved dobbel påmelding'
  );
  console.log('✓ Test 3 BESTÅTT: Dobbel påmelding er idempotent, nøyaktig én deltaker.\n');

  // ----------------------------------------------------
  // TEST 4: Samtidig bordtennispåmelding (Race condition)
  // ----------------------------------------------------
  console.log('Test 4: Samtidig bordtennispåmelding...');
  const newPersonRes = await api('/api/persons', {
    method: 'POST',
    body: JSON.stringify({ firstName: 'RaceTestSpiller' }),
  });
  const racePerson: Person = newPersonRes.data.person;

  // Send 6 samtidige påmeldinger for samme personId
  const concurrentRegs = await Promise.all(
    Array.from({ length: 6 }, () =>
      api('/api/register', {
        method: 'POST',
        body: JSON.stringify({ personId: racePerson.id }),
      })
    )
  );

  concurrentRegs.forEach((r) => assert(r.ok, 'Påmelding feilet i concurrent batch'));
  const stateAfterRace = await api('/api/state');
  const raceMatches = stateAfterRace.data.tournament.participants.filter(
    (p: Participant) => p.personId === racePerson.id
  );
  assert(raceMatches.length === 1, `Forventet nøyaktig 1 deltaker, fant ${raceMatches.length}`);
  console.log('✓ Test 4 BESTÅTT: 6 samtidige påmeldinger ga nøyaktig 1 deltakerregistrering.\n');

  // ----------------------------------------------------
  // TEST 5: Walkover (3, 5 og 7 spillere)
  // ----------------------------------------------------
  console.log('Test 5: Walkover med 3, 5 og 7 spillere...');
  for (const count of [3, 5, 7]) {
    const participants: Participant[] = Array.from({ length: count }, (_, i) => ({
      id: `part_${count}_${i + 1}`,
      personId: `person_${count}_${i + 1}`,
      displayId: `Spiller_${count}_${i + 1}`,
      firstName: `Spiller${i + 1}`,
      registeredAt: new Date().toISOString(),
    }));

    const bracket = generateBracket(participants);
    assert(bracket.length > 0, `Bracket tom for ${count} spillere`);

    const r1 = bracket.filter((m) => m.round === 1);
    const woMatches = r1.filter((m) => m.status === 'walkover' || m.isWalkover);
    const capacity = resolveBracketCapacity(count);
    const expectedWoCount = capacity - count;

    assert(
      woMatches.length === expectedWoCount,
      `For ${count} spillere (kapasitet ${capacity}): forventet ${expectedWoCount} walkovers, fikk ${woMatches.length}`
    );

    // Verifiser at hver walkover-spiller er plassert i neste kamp
    for (const wo of woMatches) {
      assert(wo.winnerId === wo.playerA?.id, `WO vinnerId stemmer ikke i kamp ${wo.id}`);
      assert(Boolean(wo.nextMatchId), `WO kamp ${wo.id} mangler neste kamp-referanse`);
      const nextMatch = bracket.find((m) => m.id === wo.nextMatchId);
      assert(Boolean(nextMatch), `Neste kamp ${wo.nextMatchId} finnes ikke`);
      const inNext = nextMatch?.playerA?.id === wo.winnerId || nextMatch?.playerB?.id === wo.winnerId;
      assert(inNext, `WO spiller ${wo.winnerId} kom ikke automatisk videre til neste kamp ${nextMatch?.id}`);
    }

    // Verifiser at det ikke er noen ugyldige kamper i bracket
    for (const m of bracket) {
      if (m.round === 1 && !m.isWalkover) {
        assert(Boolean(m.playerA && m.playerB), `R1 kamp ${m.id} mangler spillere`);
      }
    }
    console.log(`  ✓ ${count} spillere: Kapasitet=${capacity}, R1 kamper=${r1.length}, Walkovers=${woMatches.length}, alle spillere automatisk videre.`);
  }
  console.log('✓ Test 5 BESTÅTT: Walkover for 3, 5 og 7 spillere fungerer plettfritt uten ugyldige brackets.\n');

  // ----------------------------------------------------
  // TEST 6: Teknisk poengvalidering (ingen regelmotor)
  // ----------------------------------------------------
  console.log('Test 6: Teknisk poengvalidering (ingen regelmotor)...');
  const vNeg = validateScore(-1, 5);
  assert(!vNeg.isValid, 'Negative poeng skal avvises');

  const vNaN = validateScore(Number.NaN, 5);
  assert(!vNaN.isValid, 'NaN skal avvises');

  const v21_18 = validateScore(21, 18);
  assert(v21_18.isValid, '21-18 skal godtas teknisk');

  const v21_20 = validateScore(21, 20);
  assert(v21_20.isValid, '21-20 skal godtas teknisk');

  const v23_20 = validateScore(23, 20);
  assert(v23_20.isValid, '23-20 skal godtas teknisk');

  const v20_20 = validateScore(20, 20);
  assert(v20_20.isValid, '20-20 skal godtas teknisk (vinner velges separat)');

  const samplePlayers: Participant[] = [
    { id: 'p_a', firstName: 'Dommer_A', registeredAt: new Date().toISOString() },
    { id: 'p_b', firstName: 'Dommer_B', registeredAt: new Date().toISOString() },
  ];
  const sampleMatch: Match = {
    id: 'm_dommer',
    round: 1,
    roundName: 'Test',
    position: 0,
    playerA: samplePlayers[0],
    playerB: samplePlayers[1],
    winnerId: null,
    scoreA: null,
    scoreB: null,
    tableNumber: null,
    status: 'ready',
    isWalkover: false,
    nextMatchId: null,
    nextMatchSlot: null,
  };
  const { updatedMatches: atypicalMatches } = recordMatchResult(
    [sampleMatch],
    'm_dommer',
    21,
    18,
    false
  );
  const atypical = atypicalMatches.find((m) => m.id === 'm_dommer')!;
  assert(atypical.winnerId === 'p_a', 'Spiller A med høyest score (21–18) skal automatisk settes som vinner');
  assert(atypical.scoreA === 21 && atypical.scoreB === 18, 'Poengsummen skal lagres som dømt');
  console.log('✓ Test 6 BESTÅTT: Teknisk validering + automatisk vinnerkåring (Single Source of Truth) fungerer.\n');

  // ----------------------------------------------------
  // TEST 7: Serveregel (5 server før 20-20, 1 serve ved deuce)
  // ----------------------------------------------------
  console.log('Test 7: Serveregel (5 server hver, skifte ved 20–20 etter PRD)...');
  // 0-0: A server, 5 gjenstår
  let s = calculateServer(0, 0, 'A');
  assert(s.currentServer === 'A' && s.servesLeftInTurn === 5, '0-0: server A, 5 server');

  // 2-2 (4 poeng spilt): A server, 1 gjenstår
  s = calculateServer(2, 2, 'A');
  assert(s.currentServer === 'A' && s.servesLeftInTurn === 1, '2-2: server A, 1 serve igjen');

  // 3-2 (5 poeng spilt): B overtar serve, 5 gjenstår
  s = calculateServer(3, 2, 'A');
  assert(s.currentServer === 'B' && s.servesLeftInTurn === 5, '3-2: server B, 5 server');

  // 5-5 (10 poeng spilt): A overtar serve, 5 gjenstår
  s = calculateServer(5, 5, 'A');
  assert(s.currentServer === 'A' && s.servesLeftInTurn === 5, '5-5: server A, 5 server');

  // 20-19 (39 poeng spilt): B server siste serve i bolken
  s = calculateServer(20, 19, 'A');
  assert(s.currentServer === 'B' && s.servesLeftInTurn === 1 && !s.isDeuce, '20-19: server B, 1 serve');

  // 20-20 (40 poeng spilt): DEUCE! Server skifter etter HVER serve
  s = calculateServer(20, 20, 'A');
  assert(s.isDeuce === true, '20-20 må markeres som deuce');
  assert(s.currentServer === 'A' && s.servesLeftInTurn === 1, '20-20: server A, 1 serve');

  // 21-20: B server
  s = calculateServer(21, 20, 'A');
  assert(s.isDeuce === true, '21-20: fortsatt deuce');
  assert(s.currentServer === 'B' && s.servesLeftInTurn === 1, '21-20: server B, 1 serve');

  // 21-21: A server
  s = calculateServer(21, 21, 'A');
  assert(s.currentServer === 'A' && s.servesLeftInTurn === 1, '21-21: server A, 1 serve');
  console.log('✓ Test 7 BESTÅTT: Serveregel skifter nøyaktig etter 5 server og alternerer etter hver serve ved 20–20.\n');

  // ----------------------------------------------------
  // TEST 8: Resultatkorrigering og downstream-konsistens
  // ----------------------------------------------------
  console.log('Test 8: Resultatkorrigering (A vinner kamp 1, så B vinner ved korrigering)...');
  // Nullstill turnering og opprett en 4-spillers cup
  await adminApi('/api/tournament/reset', {
    method: 'POST',
    body: JSON.stringify({ keepParticipants: false, resetPin: RESET_PIN, securedReset: true }),
  });

  const fourPlayers: Person[] = [];
  for (const name of ['Kandidat_A', 'Kandidat_B', 'Kandidat_C', 'Kandidat_D']) {
    const r = await api('/api/persons', {
      method: 'POST',
      body: JSON.stringify({ firstName: name }),
    });
    fourPlayers.push(r.data.person);
    await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ personId: r.data.person.id }),
    });
  }

  // Start turnering
  const startRes = await adminApi('/api/tournament/start', { method: 'POST' });
  assert(startRes.ok, `Kunne ikke starte 4-spillers turnering: ${JSON.stringify(startRes.data)}`);

  let tState: AppState = (await api('/api/state')).data;
  const match1 = tState.tournament.matches.find((m) => m.round === 1 && m.id.endsWith('_p0'))!;
  const match2 = tState.tournament.matches.find((m) => m.round === 1 && m.id.endsWith('_p1'))!;
  const finalMatch = tState.tournament.matches.find((m) => m.round === 2)!;

  assert(Boolean(match1 && match2 && finalMatch), 'Fant ikke forventede kamper i 4-spillers cup');

  const playerA = match1.playerA!;
  const playerB = match1.playerB!;

  // 1. A vinner kamp 1 (21-15)
  const score1Res = await adminApi('/api/tournament/match/score', {
    method: 'POST',
    body: JSON.stringify({
      matchId: match1.id,
      scoreA: 21,
      scoreB: 15,
    }),
  });
  assert(score1Res.ok, 'Kamp 1 registrering feilet');

  // 2. Kamp 2 spilles (C vinner 21-18)
  const score2Res = await adminApi('/api/tournament/match/score', {
    method: 'POST',
    body: JSON.stringify({
      matchId: match2.id,
      scoreA: 21,
      scoreB: 18,
    }),
  });
  assert(score2Res.ok, 'Kamp 2 registrering feilet');

  // 3. A spiller finale mot C og vinner turneringen (21-10)
  const scoreFinalRes = await adminApi('/api/tournament/match/score', {
    method: 'POST',
    body: JSON.stringify({
      matchId: finalMatch.id,
      scoreA: 21,
      scoreB: 10,
    }),
  });
  assert(scoreFinalRes.ok, 'Finale registrering feilet');

  tState = (await api('/api/state')).data;
  assert(tState.tournament.status === 'completed', 'Turnering skal være fullført');
  assert(tState.tournament.winner?.id === playerA.id, 'Spiller A skal stå som turneringsvinner');

  // 4. Gå tilbake og korriger Kamp 1 slik at B vinner (15-21)
  const correctRes = await adminApi('/api/tournament/match/correct', {
    method: 'POST',
    body: JSON.stringify({
      matchId: match1.id,
      newScoreA: 15,
      newScoreB: 21,
      winnerSlot: 'B',
      confirmCorrection: true,
    }),
  });
  assert(correctRes.ok, `Korrigeringsfeil: ${correctRes.data.error}`);

  // Sjekk tilstanden etter korrigering:
  tState = (await api('/api/state')).data;
  assert(tState.tournament.status === 'active', 'Turnering skal være aktiv igjen (ikke fullført)');
  assert(tState.tournament.winner === null, 'Gammel turneringsvinner må være slettet');

  const updatedMatch1 = tState.tournament.matches.find((m) => m.id === match1.id)!;
  assert(updatedMatch1.winnerId === playerB.id, 'Kamp 1 vinner må nå være Spiller B');

  const updatedFinal = tState.tournament.matches.find((m) => m.id === finalMatch.id)!;
  assert(
    updatedFinal.playerA?.id === playerB.id || updatedFinal.playerB?.id === playerB.id,
    'Spiller B må være avansert til finalen'
  );
  assert(
    updatedFinal.playerA?.id !== playerA.id && updatedFinal.playerB?.id !== playerA.id,
    'Spiller A skal IKKE lenger være i finalen'
  );
  assert(updatedFinal.status === 'ready', 'Finalen skal nå være klar med nye motstandere');
  assert(updatedFinal.scoreA === null && updatedFinal.scoreB === null, 'Tidligere finale-score må være nullstilt');
  console.log('✓ Test 8 BESTÅTT: Downstream-struktur er fullstendig konsistent, gammel vinner fjernet.\n');

  // ----------------------------------------------------
  // TEST 9: Ugyldige referanser (Feilhåndtering ved manglende Person-ID)
  // ----------------------------------------------------
  console.log('Test 9: Ugyldige referanser (ikke-eksisterende Person-ID)...');
  const bogusId = 'ikke_eksisterende_id_999999';

  // 1. Alpha
  const alphaBogus = await api('/api/alpha/interest', {
    method: 'POST',
    body: JSON.stringify({ personId: bogusId }),
  });
  assert(
    alphaBogus.status === 404 && alphaBogus.data.error,
    `Alpha: Forventet 404 kontrollert feil, fikk HTTP ${alphaBogus.status}`
  );

  // 2. Popcorn
  const popcornBogus = await api('/api/popcorn/activate', {
    method: 'POST',
    body: JSON.stringify({ personId: bogusId }),
  });
  assert(
    popcornBogus.status === 404 && popcornBogus.data.error,
    `Popcorn: Forventet 404 kontrollert feil, fikk HTTP ${popcornBogus.status}`
  );

  // 3. Bordtennis
  const tourBogus = await api('/api/register', {
    method: 'POST',
    body: JSON.stringify({ personId: bogusId }),
  });
  assert(
    tourBogus.status === 404 && tourBogus.data.error,
    `Bordtennis: Forventet 404 kontrollert feil, fikk HTTP ${tourBogus.status}`
  );
  console.log('✓ Test 9 BESTÅTT: Ugyldige Person-IDer gir kontrollerte feilmeldinger (404), aldri 500.\n');

  // ----------------------------------------------------
  // TEST 10: Samtidige kampresultater (Konflikthåndtering)
  // ----------------------------------------------------
  console.log('Test 10: Samtidige kampresultater (konflikthåndtering mot samme kamp)...');
  // updatedFinal er nå 'ready'
  const postResults = await Promise.all([
    adminApi('/api/tournament/match/score', {
      method: 'POST',
      body: JSON.stringify({ matchId: updatedFinal.id, scoreA: 21, scoreB: 18 }),
    }),
    adminApi('/api/tournament/match/score', {
      method: 'POST',
      body: JSON.stringify({ matchId: updatedFinal.id, scoreA: 18, scoreB: 21 }),
    }),
  ]);

  const successCount = postResults.filter((r) => r.ok).length;
  const conflictCount = postResults.filter((r) => r.status === 409).length;

  assert(successCount === 1, `Forventet nøyaktig 1 vellykket registrering, fikk ${successCount}`);
  assert(conflictCount === 1, `Forventet nøyaktig 1 409-konflikt respons, fikk ${conflictCount}`);
  console.log('✓ Test 10 BESTÅTT: Samtidige kampresultater håndtert kontrollert uten stille overskriving.\n');

  // ----------------------------------------------------
  // TEST 11: Reset (Testdata vs. personer)
  // ----------------------------------------------------
  console.log('Test 11: Reset (personer beholdes mens turneringsdata fjernes)...');
  // Opprett en ekte person
  const realPersonRes = await api('/api/persons', {
    method: 'POST',
    body: JSON.stringify({ firstName: 'EktePersonMagnar' }),
  });
  const realPerson: Person = realPersonRes.data.person;

  // Kjør tournament reset
  const tResetRes = await adminApi('/api/tournament/reset', {
    method: 'POST',
    body: JSON.stringify({ keepParticipants: false, resetPin: RESET_PIN, securedReset: true }),
  });
  assert(tResetRes.ok, 'Tournament reset feilet');

  const postResetState = (await api('/api/state')).data;
  assert(postResetState.tournament.matches.length === 0, 'Kamper skal være nullstilt');
  assert(postResetState.tournament.status === 'registration', 'Status skal være registration');

  const personStillExists = postResetState.persons.some((p: Person) => p.id === realPerson.id);
  assert(personStillExists, 'Ekte person skal beholdes i databasen etter tournament reset');
  console.log('✓ Test 11 BESTÅTT: Tournament reset fjerner turneringsdata, men bevarer personene.\n');

  // ----------------------------------------------------
  // TEST 12: Simulering (16 spillere, bracket, reset-testdata)
  // ----------------------------------------------------
  console.log('Test 12: Simulering (16 spillere, bracket og testdata-reset)...');
  const simRes = await adminApi('/api/tournament/simulate', {
    method: 'POST',
    body: JSON.stringify({ count: 16 }),
  });
  assert(simRes.ok, 'Simulering feilet');

  let simState: AppState = (await api('/api/state')).data;
  assert(simState.tournament.participants.length === 16, '16 deltakere forventet');
  assert(simState.tournament.matches.length === 15, '15 kamper forventet i 16-spillers cup (8+4+2+1)');
  assert(simState.tournament.status === 'active', 'Turnering skal være aktiv');

  // Kontroller at ekte person fortsatt eksisterer
  assert(
    simState.persons.some((p: Person) => p.id === realPerson.id),
    'Ekte person må fortsatt eksistere under simulering'
  );

  // Kjør reset testdata
  const resetTestDataRes = await adminApi('/api/admin/reset-testdata', {
    method: 'POST',
    body: JSON.stringify({ resetPin: RESET_PIN }),
  });
  assert(resetTestDataRes.ok, 'Reset testdata feilet');

  const afterTestResetState: AppState = (await api('/api/state')).data;
  assert(afterTestResetState.tournament.participants.length === 0, 'Turneringsdeltakere skal være tømt');
  assert(afterTestResetState.tournament.matches.length === 0, 'Turneringskamper skal være tømt');

  // Verifiser at simulerte personer ble slettet, mens ekte person bevares
  const realPersonFound = afterTestResetState.persons.some((p) => p.id === realPerson.id);
  const simPersonsFound = afterTestResetState.persons.some((p) => p.isSimulated);

  assert(realPersonFound, 'Ekte person må fortsatt bevares etter reset-testdata!');
  assert(!simPersonsFound, 'Simulerte testpersoner må være fjernet etter reset-testdata!');
  console.log('✓ Test 12 BESTÅTT: 16-spiller simulering, korrekt bracket, og selektiv testdata-reset virker.\n');

  console.log('====================================================');
  console.log('ALLE 12 RETEST-SCENARIER BESTÅTT MED 100% SUKSESS!');
  console.log('====================================================');
}

runRetest().catch((err) => {
  console.error('\n❌ RETEST FEIL:', err.message);
  process.exit(1);
});
