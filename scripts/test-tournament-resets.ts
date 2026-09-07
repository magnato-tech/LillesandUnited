import type { AppState, Match, Participant, Person } from '../src/types';

const BASE_URL = 'http://localhost:3000';
const ADMIN_PIN = 'united2026';

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
      'x-admin-pin': ADMIN_PIN,
      ...(options.headers as Record<string, string>),
    },
  });
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function playThrough16Cup(): Promise<{ winnerId: string; winnerDisplayId: string }> {
  for (let round = 1; round <= 4; round++) {
    const state: AppState = (await api('/api/state')).data;
    const matchesInRound = state.tournament.matches.filter((m) => m.round === round);
    for (let i = 0; i < matchesInRound.length; i++) {
      const match = (await api('/api/state')).data.tournament.matches.find(
        (m: Match) => m.id === matchesInRound[i].id
      )!;
      if (match.status === 'walkover' || match.status === 'completed') continue;

      assert(match.status === 'ready', `Kamp ${match.id} er ikke klar (status: ${match.status})`);
      assert(Boolean(match.playerA) && Boolean(match.playerB), `Kamp ${match.id} mangler spillere`);

      // Alternate winner
      const winA = i % 2 === 0;
      const scoreA = winA ? 21 : 17;
      const scoreB = winA ? 17 : 21;
      const expectedWinner = winA ? match.playerA! : match.playerB!;

      const res = await adminApi('/api/tournament/match/score', {
        method: 'POST',
        body: JSON.stringify({
          matchId: match.id,
          scoreA,
          scoreB,
        }),
      });
      assert(res.ok, `Feil ved scoring for ${match.id}: ${JSON.stringify(res.data)}`);

      const fresh: AppState = (await api('/api/state')).data;
      const scored = fresh.tournament.matches.find((m) => m.id === match.id)!;
      assert(scored.status === 'completed', `Kamp ${match.id} ikke markert completed`);
      assert(scored.winnerId === expectedWinner.id, `Feil vinner i ${match.id}`);
    }
  }

  const finalState: AppState = (await api('/api/state')).data;
  assert(finalState.tournament.status === 'completed', 'Turnering ikke markert completed');
  assert(Boolean(finalState.tournament.winner), 'Ingen turneringsvinner kåret');

  return {
    winnerId: finalState.tournament.winner!.id,
    winnerDisplayId: finalState.tournament.winner!.displayId || finalState.tournament.winner!.firstName,
  };
}

export async function runResetTests() {
  console.log('====================================================');
  console.log('STARTER TEST: RESET TURNERING OG RESET AV SPILLERE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // DEL A: RESET TURNERING, BEHOLD SPILLERE
  // ----------------------------------------------------
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('DEL A: RESET TURNERING, BEHOLD SPILLERE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Finn eller opprett 16 personer
  let stateRes = await api('/api/state');
  let state: AppState = stateRes.data;

  // Sørg for at vi har minst 16 personer i systemet
  let persons: Person[] = state.persons || [];
  if (persons.length < 16) {
    console.log(`Fant ${persons.length} personer, oppretter opp til 16...`);
    for (let i = persons.length + 1; i <= 16; i++) {
      const pRes = await api('/api/persons', {
        method: 'POST',
        body: JSON.stringify({ firstName: `TestSpiller${i}` }),
      });
      assert(pRes.ok, `Kunne ikke opprette person ${i}`);
    }
    state = (await api('/api/state')).data;
    persons = state.persons || [];
  }

  // Velg de første 16 personene
  const selected16Persons = persons.slice(0, 16);
  const initialPersonIds = selected16Persons.map((p) => p.id);
  const initialDisplayIds = selected16Persons.map((p) => p.displayId);
  console.log(`[Del A - 1] Bruker 16 eksisterende personer: ${initialDisplayIds.slice(0, 4).join(', ')} ...`);

  // 1. Meld 16 spillere på turneringen
  // Nullstill først turneringen for å starte rent
  await adminApi('/api/tournament/reset', {
    method: 'POST',
    body: JSON.stringify({ keepParticipants: false }),
  });

  for (const p of selected16Persons) {
    const regRes = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ personId: p.id }),
    });
    assert(regRes.ok, `Kunne ikke melde på person ${p.displayId}: ${JSON.stringify(regRes.data)}`);
  }

  state = (await api('/api/state')).data;
  assert(state.tournament.participants.length === 16, `Forventet 16 påmeldte, fikk ${state.tournament.participants.length}`);
  console.log(`✓ [Del A - 1] 16 spillere meldt på turneringen.`);

  // 2. Generer 16-spillers cup
  console.log('[Del A - 2] Genererer 16-spillers cup...');
  const startRes = await adminApi('/api/tournament/start', { method: 'POST' });
  assert(startRes.ok, `Kunne ikke starte turnering: ${JSON.stringify(startRes.data)}`);
  state = (await api('/api/state')).data;
  assert(state.tournament.status === 'active', 'Turnering ikke i aktiv status');
  assert(state.tournament.matches.length === 15, `Forventet 15 kamper, fikk ${state.tournament.matches.length}`);
  console.log('✓ [Del A - 2] 16-spillers cup generert med 15 kamper.');

  // 3-5. Gjennomfør hele turneringen, registrer 15 kamper, kontroller vinner
  console.log('[Del A - 3-5] Gjennomfører hele turneringen (15 kamper)...');
  const cup1 = await playThrough16Cup();
  console.log(`✓ [Del A - 3-5] Turnering gjennomført! Vinner: ${cup1.winnerDisplayId}`);

  // 6. Bruk adminfunksjonen "Reset turnering"
  console.log('[Del A - 6] Kaller adminfunksjonen Reset Turnering (keepParticipants=false)...');
  const resetTourRes = await adminApi('/api/tournament/reset', {
    method: 'POST',
    body: JSON.stringify({ keepParticipants: false }),
  });
  assert(resetTourRes.ok, `Reset turnering feilet: ${JSON.stringify(resetTourRes.data)}`);

  // 7. Kontroller resultatet
  console.log('[Del A - 7] Kontrollerer tilstand etter Reset Turnering...');
  state = (await api('/api/state')).data;
  assert(state.tournament.status === 'registration', `Status må være 'registration', var '${state.tournament.status}'`);
  assert(state.tournament.startedAt === null, 'startedAt er ikke nullstilt');
  assert(state.tournament.completedAt === null, 'completedAt er ikke nullstilt');
  assert(state.tournament.matches.length === 0, `Forventet 0 kamper etter reset, fant ${state.tournament.matches.length}`);
  assert(state.tournament.winner === null, 'Turneringsvinner ble ikke fjernet');

  // Kontroller at spillerprofilene eksisterer og Person-IDer er uendret
  const currentPersons = state.persons || [];
  for (const expectedId of initialPersonIds) {
    const found = currentPersons.find((p) => p.id === expectedId);
    assert(Boolean(found), `Person-ID ${expectedId} ble feilaktig slettet under tournament reset!`);
  }
  console.log('✓ [Del A - 7] Kamper, resultater og vinner er fjernet. Alle 16 spillerprofiler eksisterer uendret.');

  // 8. Meld de samme spillerne på en ny turnering
  console.log('[Del A - 8] Melder de samme 16 spillerne på en ny turnering...');
  for (const p of selected16Persons) {
    const regRes = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ personId: p.id }),
    });
    assert(regRes.ok, `Kunne ikke gjenpåmelde ${p.displayId}: ${JSON.stringify(regRes.data)}`);
  }
  state = (await api('/api/state')).data;
  assert(state.tournament.participants.length === 16, `Forventet 16 gjenpåmeldte, fant ${state.tournament.participants.length}`);
  console.log('✓ [Del A - 8] Samtlige 16 spillere meldt på turneringen på nytt.');

  // 9. Generer ny 16-spillers cup
  console.log('[Del A - 9] Genererer ny 16-spillers cup...');
  const restartRes = await adminApi('/api/tournament/start', { method: 'POST' });
  assert(restartRes.ok, `Kunne ikke starte ny turnering: ${JSON.stringify(restartRes.data)}`);
  state = (await api('/api/state')).data;
  assert(state.tournament.status === 'active', 'Turnering ikke i aktiv status');
  assert(state.tournament.matches.length === 15, `Forventet 15 kamper, fikk ${state.tournament.matches.length}`);
  console.log('✓ [Del A - 9] Ny 16-spillers cup generert med 15 nye kamper.');

  // 10-11. Gjennomfør turneringen på nytt og kontroller
  console.log('[Del A - 10-11] Gjennomfører den nye turneringen...');
  const cup2 = await playThrough16Cup();
  console.log(`✓ [Del A - 10-11] Ny turnering gjennomført feilfritt! Vinner: ${cup2.winnerDisplayId}`);
  console.log('>>> DEL A BESTÅTT!\n');

  // ----------------------------------------------------
  // DEL B: RESET TURNERING OG SPILLERE
  // ----------------------------------------------------
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('DEL B: RESET TURNERING OG SPILLERE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Først: merk testpersoner eller generer simulerte testspillere for å verifisere fjerning
  console.log('[Del B - Forberedelse] Genererer test-turnering via /api/tournament/simulate...');
  const simRes = await adminApi('/api/tournament/simulate', {
    method: 'POST',
    body: JSON.stringify({ count: 16 }),
  });
  assert(simRes.ok, 'Simulate feilet');

  let preResetState: AppState = (await api('/api/state')).data;
  const simCountBefore = (preResetState.persons || []).filter((p) => p.isSimulated).length;
  console.log(`Pre-reset: ${simCountBefore} simulerte testspillere, ${preResetState.tournament.matches.length} kamper.`);

  // 1. Bruk funksjonen som fjerner turnerings-/testdata og spillere: /api/admin/reset-testdata
  console.log('[Del B - 1] Kaller /api/admin/reset-testdata...');
  const resetTestDataRes = await adminApi('/api/admin/reset-testdata', { method: 'POST' });
  assert(resetTestDataRes.ok, `Reset testdata feilet: ${JSON.stringify(resetTestDataRes.data)}`);

  // 2. Kontroller databasen og tilstand
  console.log('[Del B - 2] Kontrollerer database og tilstand etter reset-testdata...');
  state = (await api('/api/state')).data;

  // Kontroller at testspillere (isSimulated) er fjernet
  const simCountAfter = (state.persons || []).filter((p) => p.isSimulated).length;
  assert(simCountAfter === 0, `Forventet 0 simulerte testspillere, fant ${simCountAfter}`);
  console.log(`✓ Simulerte testspillere er fjernet (${simCountBefore} -> ${simCountAfter}).`);

  // Kontroller at gamle turneringsdata, kamper, resultater og vinner er fjernet
  assert(state.tournament.status === 'registration', 'Turneringsstatus er ikke registration');
  assert(state.tournament.startedAt === null, 'startedAt er ikke null');
  assert(state.tournament.completedAt === null, 'completedAt er ikke null');
  assert(state.tournament.participants.length === 0, 'participants er ikke tømt');
  assert(state.tournament.matches.length === 0, 'matches er ikke tømt');
  assert(state.tournament.winner === null, 'winner er ikke null');
  console.log('✓ Turneringsdata, kamper, resultater og vinner er fullstendig fjernet.');

  // Kontroller at faste data beholdes:
  assert(Boolean(state.event.name), 'Event-navn mangler');
  assert(Boolean(state.event.date), 'Event-dato mangler');
  assert(Boolean(state.event.organizers && state.event.organizers.length > 0), 'Organizers mangler');
  assert(Boolean(state.activities && state.activities.length > 0), 'Aktiviteter ble feilaktig slettet');
  console.log('✓ Faste arrangementsdata og program er 100% intakte.');
  console.log('>>> DEL B BESTÅTT!\n');

  // ----------------------------------------------------
  // DEL C: NYE 16 SPILLERE
  // ----------------------------------------------------
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('DEL C: NYE 16 SPILLERE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('[Del C - 1] Oppretter 16 helt nye spillere...');
  const newPersons: Person[] = [];
  const timestampSuffix = Date.now().toString().slice(-4);

  for (let i = 1; i <= 16; i++) {
    const name = `NySpiller_${i}_${timestampSuffix}`;
    const pRes = await api('/api/persons', {
      method: 'POST',
      body: JSON.stringify({ firstName: name }),
    });
    assert(pRes.ok, `Kunne ikke opprette ${name}: ${JSON.stringify(pRes.data)}`);
    newPersons.push(pRes.data.person);
  }

  // Kontroller at alle 16 har egne tekniske IDer
  const idSet = new Set(newPersons.map((p) => p.id));
  assert(idSet.size === 16, `Ikke unike person-IDer for nye spillere (fikk ${idSet.size})`);
  console.log('✓ Alle 16 nye spillere har unike tekniske ID-er.');

  // Meld samtlige 16 på turneringen
  console.log('[Del C - 2] Melder alle 16 nye spillere på bordtennisturneringen...');
  for (const p of newPersons) {
    const regRes = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ personId: p.id }),
    });
    assert(regRes.ok, `Kunne ikke melde på ${p.displayId}: ${JSON.stringify(regRes.data)}`);
  }

  state = (await api('/api/state')).data;
  assert(state.tournament.participants.length === 16, `Forventet 16 påmeldte, fant ${state.tournament.participants.length}`);

  // Kontroller at ingen gamle spillere er blandet inn
  const participantPersonIds = new Set(state.tournament.participants.map((p) => p.personId));
  for (const p of newPersons) {
    assert(participantPersonIds.has(p.id), `Spiller ${p.displayId} mangler i påmeldte`);
  }
  for (const part of state.tournament.participants) {
    assert(idSet.has(part.personId), `Uventet gammel spiller ${part.displayId} funnet i turneringen!`);
  }
  console.log('✓ Ingen gamle spillere er blandet inn.');

  // Kontroller at ingen gamle kamper eller resultater eksisterer
  assert(state.tournament.matches.length === 0, 'Gamle kamper eksisterer før start');
  assert(state.tournament.winner === null, 'Gammel vinner eksisterer før start');
  console.log('✓ Ingen gamle kamper eller resultater finnes i tilstanden.');

  // Generer ny 16-spillers cup
  console.log('[Del C - 3] Genererer ny 16-spillers cup for de 16 nye spillerne...');
  const startCRes = await adminApi('/api/tournament/start', { method: 'POST' });
  assert(startCRes.ok, `Kunne ikke starte turnering: ${JSON.stringify(startCRes.data)}`);

  state = (await api('/api/state')).data;
  const cMatches = state.tournament.matches;
  assert(cMatches.length === 15, `Forventet 15 kamper, fikk ${cMatches.length}`);

  // Kontroller bracket, nextMatchId, nextMatchSlot
  console.log('[Del C - 4] Kontrollerer bracket-struktur, nextMatchId og nextMatchSlot...');
  const matchMap = new Map<string, Match>();
  for (const m of cMatches) {
    matchMap.set(m.id, m);
  }

  for (const m of cMatches) {
    if (m.round < 4) {
      assert(Boolean(m.nextMatchId), `Kamp ${m.id} mangler nextMatchId`);
      const target = matchMap.get(m.nextMatchId!);
      assert(Boolean(target), `nextMatchId ${m.nextMatchId} finnes ikke`);
      assert(target!.round === m.round + 1, `nextMatch ${target!.id} er ikke i runde ${m.round + 1}`);
      const expectedSlot = m.position % 2 === 0 ? 'A' : 'B';
      assert(m.nextMatchSlot === expectedSlot, `Feil slot i ${m.id}: forventet ${expectedSlot}, fikk ${m.nextMatchSlot}`);
    } else {
      assert(!m.nextMatchId, `Finalen ${m.id} skal ikke ha nextMatchId`);
    }
  }
  console.log('✓ Bracket, nextMatchId og nextMatchSlot er 100% konsistente.');

  // Gjennomfør alle 15 kampene
  console.log('[Del C - 5] Gjennomfører alle 15 kampene...');
  const cup3 = await playThrough16Cup();
  console.log(`✓ [Del C - 5] Alle 15 kamper spilt. Turneringsvinner: ${cup3.winnerDisplayId}`);

  // Kontroller databasen og UI-tilstand
  const finalState = (await api('/api/state')).data;
  assert(finalState.tournament.status === 'completed', 'Status ikke completed');
  assert(finalState.tournament.winner?.id === cup3.winnerId, 'Feil vinner i tournament.winner');
  const unfinished = finalState.tournament.matches.filter((m: Match) => m.status !== 'completed' && m.status !== 'walkover');
  assert(unfinished.length === 0, 'Det finnes ufullførte kamper');

  console.log('\n====================================================');
  console.log('🎉 ALLE TESTER (DEL A, DEL B, DEL C) ER BESTÅTT! 🎉');
  console.log('====================================================');

  return {
    delA: true,
    delB: true,
    delC: true,
    winnerDelA: cup1.winnerDisplayId,
    winnerDelA2: cup2.winnerDisplayId,
    winnerDelC: cup3.winnerDisplayId,
  };
}

if (process.argv[1]?.endsWith('test-tournament-resets.ts')) {
  runResetTests()
    .then((res) => {
      console.log('TEST_RESETS_RESULT:' + JSON.stringify(res));
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ TEST FEIL:', err.message);
      console.log('TEST_RESETS_RESULT:' + JSON.stringify({ success: false, error: err.message }));
      process.exit(1);
    });
}
