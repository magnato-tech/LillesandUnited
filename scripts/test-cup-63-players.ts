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

export async function runTest2() {
  console.log('====================================================');
  console.log('STARTER TEST 2: 63 SPILLERE / 64-PLASSERS CUP');
  console.log('====================================================\n');

  // 1. Nullstill og initialiser 63 spillere via simulate-endepunktet
  console.log('[Steg 1] Initialiserer turnering med 63 spillere via /api/tournament/simulate...');
  const simRes = await adminApi('/api/tournament/simulate', {
    method: 'POST',
    body: JSON.stringify({ count: 63 }),
  });
  assert(simRes.ok, `Simulering med 63 spillere feilet: ${JSON.stringify(simRes.data)}`);

  let stateRes = await api('/api/state');
  let state: AppState = stateRes.data;

  // Kontroller grunnleggende parametere
  const participants: Participant[] = state.tournament.participants;
  const matches: Match[] = state.tournament.matches;
  const bracketCapacity = state.tournament.bracketCapacity;

  console.log(`[Steg 1.1] Kontrollerer spillerantall og kapasitet...`);
  assert(participants.length === 63, `Forventet 63 deltakere, fikk ${participants.length}`);
  assert(bracketCapacity === 64, `Forventet bracket-kapasitet 64, fikk ${bracketCapacity}`);
  console.log(`✓ 63 deltakere og 64 bracket-plasser bekreftet.`);

  // Kontroller antall kamper
  console.log(`[Steg 1.2] Kontrollerer totalt antall kamper...`);
  assert(matches.length === 63, `Forventet nøyaktig 63 kamper i turneringen, fikk ${matches.length}`);
  console.log(`✓ Nøyaktig 63 kamper opprettet i turneringen.`);

  // Kontroller antall kamper per runde
  const r1 = matches.filter((m) => m.round === 1);
  const r2 = matches.filter((m) => m.round === 2);
  const r3 = matches.filter((m) => m.round === 3);
  const r4 = matches.filter((m) => m.round === 4);
  const r5 = matches.filter((m) => m.round === 5);
  const r6 = matches.filter((m) => m.round === 6);

  console.log(`[Steg 1.3] Kontrollerer kampfordeling per runde:`);
  console.log(`  Runde 1: ${r1.length} kamper (forventet 32)`);
  console.log(`  Runde 2: ${r2.length} kamper (forventet 16)`);
  console.log(`  Runde 3: ${r3.length} kamper (forventet 8)`);
  console.log(`  Runde 4: ${r4.length} kamper (forventet 4)`);
  console.log(`  Runde 5: ${r5.length} kamper (forventet 2)`);
  console.log(`  Runde 6 (Finale): ${r6.length} kamper (forventet 1)`);

  assert(r1.length === 32, `Runde 1 må ha 32 kamper, fant ${r1.length}`);
  assert(r2.length === 16, `Runde 2 må ha 16 kamper, fant ${r2.length}`);
  assert(r3.length === 8, `Runde 3 må ha 8 kamper, fant ${r3.length}`);
  assert(r4.length === 4, `Runde 4 må ha 4 kamper, fant ${r4.length}`);
  assert(r5.length === 2, `Runde 5 må ha 2 kamper, fant ${r5.length}`);
  assert(r6.length === 1, `Runde 6 (Finale) må ha 1 kamp, fant ${r6.length}`);
  console.log('✓ Kampfordeling per runde er 100% korrekt.');

  // Kontroller walkover
  console.log('\n[Steg 2] Kontrollerer walkover i Runde 1...');
  const walkoverMatches = r1.filter((m) => m.isWalkover);
  assert(walkoverMatches.length === 1, `Forventet nøyaktig 1 walkover, fant ${walkoverMatches.length}`);
  const woMatch = walkoverMatches[0];
  assert(woMatch.status === 'walkover', `Walkover-kamp har feil status: ${woMatch.status}`);
  assert(Boolean(woMatch.playerA) && !woMatch.playerB, 'Walkover-kamp skal ha kun playerA');
  assert(woMatch.winnerId === woMatch.playerA!.id, 'Walkover-kamp vinnerId matcher ikke playerA');
  console.log(`✓ Nøyaktig 1 walkover funnet i kamp ${woMatch.id} for spiller ${woMatch.playerA!.displayId}`);

  // Kontroller at walkover-vinneren er korrekt plassert i neste kamp (i Runde 2)
  assert(Boolean(woMatch.nextMatchId), 'Walkover-kamp mangler nextMatchId');
  const woNextMatch = matches.find((m) => m.id === woMatch.nextMatchId)!;
  assert(Boolean(woNextMatch), `Neste kamp ${woMatch.nextMatchId} finnes ikke`);
  const woPlayerPlaced =
    (woMatch.nextMatchSlot === 'A' && woNextMatch.playerA?.id === woMatch.playerA!.id) ||
    (woMatch.nextMatchSlot === 'B' && woNextMatch.playerB?.id === woMatch.playerA!.id);
  assert(woPlayerPlaced, `Walkover-spiller ${woMatch.playerA!.displayId} ble IKKE plassert i ${woMatch.nextMatchId} slot ${woMatch.nextMatchSlot}!`);
  console.log(`✓ Walkover-vinner er automatisk og korrekt plassert i ${woNextMatch.id} (slot ${woMatch.nextMatchSlot}).`);

  // Kontroller hele turneringsgrafen
  console.log('\n[Steg 3] Kontrollerer hele turneringsgrafen (noder, referanser, duplikater)...');
  const matchIdSet = new Set<string>();
  const matchMap = new Map<string, Match>();

  for (const m of matches) {
    assert(!matchIdSet.has(m.id), `Duplikat kamp-ID funnet: ${m.id}`);
    matchIdSet.add(m.id);
    matchMap.set(m.id, m);
  }

  // Sjekk next_match-relasjoner for samtlige runder
  for (const m of matches) {
    if (m.round < 6) {
      assert(Boolean(m.nextMatchId), `Kamp ${m.id} i runde ${m.round} mangler nextMatchId`);
      const targetMatch = matchMap.get(m.nextMatchId!);
      assert(Boolean(targetMatch), `Kamp ${m.id} refererer til ikke-eksisterende nextMatch ${m.nextMatchId}`);
      assert(targetMatch!.round === m.round + 1, `Kamp ${m.id} (R${m.round}) refererer til R${targetMatch!.round} i stedet for R${m.round + 1}`);

      const expectedTargetPos = Math.floor(m.position / 2);
      assert(targetMatch!.position === expectedTargetPos, `Feil target-posisjon: forventet p${expectedTargetPos}, fikk p${targetMatch!.position}`);

      const expectedSlot = m.position % 2 === 0 ? 'A' : 'B';
      assert(m.nextMatchSlot === expectedSlot, `Kamp ${m.id} har nextMatchSlot ${m.nextMatchSlot}, forventet ${expectedSlot}`);
    } else {
      assert(!m.nextMatchId, `Finalen ${m.id} skal ikke ha nextMatchId`);
      assert(!m.nextMatchSlot, `Finalen ${m.id} skal ikke ha nextMatchSlot`);
    }
  }
  console.log('✓ Alle next_match-relasjoner og slots er 100% gyldige, ingen brutte referanser eller foreldreløse kamper.');

  // Kontroller spillerfordeling i Runde 1
  const r1Players = new Set<string>();
  for (const m of r1) {
    assert(Boolean(m.playerA), `Kamp ${m.id} mangler playerA`);
    assert(!r1Players.has(m.playerA!.id), `Spiller ${m.playerA!.displayId} registrert flere ganger i R1`);
    r1Players.add(m.playerA!.id);

    if (!m.isWalkover) {
      assert(Boolean(m.playerB), `Ordinær kamp ${m.id} mangler playerB`);
      assert(m.playerA!.id !== m.playerB!.id, `Kamp ${m.id} har samme spiller i A og B`);
      assert(!r1Players.has(m.playerB!.id), `Spiller ${m.playerB!.displayId} registrert flere ganger i R1`);
      r1Players.add(m.playerB!.id);
      assert(m.status === 'ready', `Ordinær kamp ${m.id} skal være 'ready'`);
    }
  }
  assert(r1Players.size === 63, `Forventet 63 unike spillere i Runde 1, fant ${r1Players.size}`);
  console.log('✓ Alle 63 unike spillere er plassert i Runde 1 uten duplikater.');

  // Gjennomfør hele turneringen runde for runde
  console.log('\n[Steg 4] Gjennomfører hele turneringen runde for runde (Runde 1 til Runde 6)...');

  for (let currentRound = 1; currentRound <= 6; currentRound++) {
    const roundName = currentRound === 6 ? 'Runde 6 (Finale)'
      : currentRound === 5 ? 'Runde 5 (Semifinaler)'
      : currentRound === 4 ? 'Runde 4 (Kvartfinaler)'
      : currentRound === 3 ? 'Runde 3 (Åttedelsfinaler)'
      : currentRound === 2 ? 'Runde 2 (Sekstendelsfinaler)'
      : 'Runde 1 (Trettitodelsfinaler)';

    const roundMatches = (await api('/api/state')).data.tournament.matches.filter(
      (m: Match) => m.round === currentRound
    );

    console.log(`\n--- Spiller ${roundName} (${roundMatches.length} kamper) ---`);

    let matchCountInRound = 0;
    for (const m of roundMatches) {
      // Hent nyeste tilstand for denne kampen
      const freshMatch: Match = (await api('/api/state')).data.tournament.matches.find(
        (cand: Match) => cand.id === m.id
      )!;

      if (freshMatch.status === 'walkover') {
        console.log(`  Kamp ${freshMatch.id}: Walkover for ${freshMatch.playerA?.displayId} -> allerede videre`);
        continue;
      }

      assert(freshMatch.status === 'ready', `Kamp ${freshMatch.id} skal ha status 'ready', har '${freshMatch.status}'`);
      assert(Boolean(freshMatch.playerA), `Kamp ${freshMatch.id} mangler playerA`);
      assert(Boolean(freshMatch.playerB), `Kamp ${freshMatch.id} mangler playerB`);
      assert(freshMatch.playerA!.id !== freshMatch.playerB!.id, `Kamp ${freshMatch.id} har identiske spillere!`);

      // Velg vinner (veksle mellom A og B)
      const chooseA = matchCountInRound % 2 === 0;
      matchCountInRound++;
      const scoreA = chooseA ? 21 : 16;
      const scoreB = chooseA ? 16 : 21;
      const winner = chooseA ? freshMatch.playerA! : freshMatch.playerB!;

      const scoreRes = await adminApi('/api/tournament/match/score', {
        method: 'POST',
        body: JSON.stringify({
          matchId: freshMatch.id,
          scoreA,
          scoreB,
        }),
      });
      assert(scoreRes.ok, `Feil ved scoring for ${freshMatch.id}: ${JSON.stringify(scoreRes.data)}`);

      // Verifiser at vinneren rykket opp til neste kamp
      const afterState: AppState = (await api('/api/state')).data;
      const scoredMatch = afterState.tournament.matches.find((cand) => cand.id === freshMatch.id)!;
      assert(scoredMatch.status === 'completed', `Kamp ${freshMatch.id} ikke markert 'completed'`);
      assert(scoredMatch.winnerId === winner.id, `Feil winnerId i kamp ${freshMatch.id}`);

      if (scoredMatch.nextMatchId) {
        const nextMatch = afterState.tournament.matches.find((cand) => cand.id === scoredMatch.nextMatchId)!;
        const placed = scoredMatch.nextMatchSlot === 'A'
          ? nextMatch.playerA?.id === winner.id
          : nextMatch.playerB?.id === winner.id;
        assert(placed, `Vinner ${winner.displayId} fra ${freshMatch.id} ble ikke plassert i ${nextMatch.id} (${scoredMatch.nextMatchSlot})`);
      }
    }

    // Sjekk at ingen spiller opptrer i flere aktive kamper i denne runden
    const activePlayers = new Set<string>();
    const updatedRoundMatches: Match[] = (await api('/api/state')).data.tournament.matches.filter(
      (m: Match) => m.round === currentRound
    );
    for (const m of updatedRoundMatches) {
      if (m.status === 'ready') {
        assert(!activePlayers.has(m.playerA!.id), `Spiller ${m.playerA!.displayId} i flere aktive kamper`);
        assert(!activePlayers.has(m.playerB!.id), `Spiller ${m.playerB!.displayId} i flere aktive kamper`);
        activePlayers.add(m.playerA!.id);
        activePlayers.add(m.playerB!.id);
      }
    }
  }

  // Kontroller finalen og turneringsvinner
  console.log('\n[Steg 5] Kontrollerer finale og kåring av turneringsvinner...');
  const finalState: AppState = (await api('/api/state')).data;
  const finaleMatch = finalState.tournament.matches.find((m) => m.round === 6)!;

  assert(finaleMatch.status === 'completed', `Finalen har ikke status 'completed' (er '${finaleMatch.status}')`);
  assert(Boolean(finaleMatch.winnerId), 'Finalen mangler winnerId');
  assert(finalState.tournament.status === 'completed', `Turneringsstatus er ikke 'completed' (er '${finalState.tournament.status}')`);
  assert(Boolean(finalState.tournament.winner), 'Turneringsvinner er ikke registrert');
  assert(finalState.tournament.winner!.id === finaleMatch.winnerId, 'Turneringsvinner matcher ikke finalens vinnerId');

  const winner = finalState.tournament.winner!;
  console.log(`✓ Turneringen er fullført!`);
  console.log(`  Kåret vinner: ${winner.displayId} (${winner.firstName})`);
  console.log(`  Finaleresultat: ${finaleMatch.scoreA} – ${finaleMatch.scoreB}`);

  // Kontroller tilstandens integritet
  console.log('\n[Steg 6] Kontrollerer databasen og konsistens...');
  assert(finalState.tournament.matches.length === 63, `Matches må være nøyaktig 63, fant ${finalState.tournament.matches.length}`);
  const unfinished = finalState.tournament.matches.filter((m) => m.status !== 'completed' && m.status !== 'walkover');
  assert(unfinished.length === 0, `Fant ${unfinished.length} ufullførte kamper etter turneringens slutt`);

  console.log('\n====================================================');
  console.log('🎉 TEST 2 – 63 SPILLERE / 64-PLASSERS CUP BESTÅTT! 🎉');
  console.log(`   Antall spillere:        ${participants.length}`);
  console.log(`   Antall bracket-plasser: ${bracketCapacity}`);
  console.log(`   Antall walkovers:       ${walkoverMatches.length}`);
  console.log(`   Antall kamper:          ${finalState.tournament.matches.length}`);
  console.log(`   Vinner:                 ${winner.displayId}`);
  console.log('====================================================');

  return {
    success: true,
    players: participants.length,
    capacity: bracketCapacity,
    walkovers: walkoverMatches.length,
    matches: finalState.tournament.matches.length,
    winner: winner.displayId,
  };
}

if (process.argv[1]?.endsWith('test-cup-63-players.ts')) {
  runTest2()
    .then((res) => {
      console.log('TEST2_RESULT:' + JSON.stringify(res));
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ TEST 2 FEIL:', err.message);
      console.log('TEST2_RESULT:' + JSON.stringify({ success: false, error: err.message }));
      process.exit(1);
    });
}
