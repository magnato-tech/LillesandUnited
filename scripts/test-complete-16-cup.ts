import type { AppState, Match, Participant, Person } from '../src/types';

const BASE_URL = 'http://localhost:3000';
const ADMIN_PIN = process.env.ADMIN_PIN || 'United2026';
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

async function runTest1() {
  console.log('=== STARTER TEST 1: KOMPLETT 16-SPILLERS CUP ===\n');

  // 0. Nullstill turnering for en ren start
  console.log('[Steg 0] Nullstiller turnering...');
  const resetRes = await adminApi('/api/tournament/reset', {
    method: 'POST',
    body: JSON.stringify({ keepParticipants: false, resetPin: RESET_PIN, securedReset: true }),
  });
  assert(resetRes.ok, `Reset tournament feilet: ${JSON.stringify(resetRes.data)}`);

  // 1. Opprett 16 distinkte testspillere og meld dem på
  console.log('[Steg 1] Oppretter og melder på 16 testspillere...');
  const testPlayers: Person[] = [];
  for (let i = 1; i <= 16; i++) {
    const pRes = await api('/api/persons', {
      method: 'POST',
      body: JSON.stringify({ firstName: `CupSpiller_${i}` }),
    });
    assert(pRes.ok, `Kunne ikke opprette person ${i}: ${JSON.stringify(pRes.data)}`);
    const person: Person = pRes.data.person;
    testPlayers.push(person);

    const regRes = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ personId: person.id }),
    });
    assert(regRes.ok, `Kunne ikke melde på person ${i}: ${JSON.stringify(regRes.data)}`);
  }

  let stateRes = await api('/api/state');
  let state: AppState = stateRes.data;
  assert(state.tournament.participants.length === 16, `Forventet 16 deltakere, fikk ${state.tournament.participants.length}`);
  console.log(`✓ 16 deltakere påmeldt: ${state.tournament.participants.map((p) => p.displayId).join(', ')}`);

  // 2. Start turneringen og generer kamper
  console.log('\n[Steg 2] Starter turneringen og genererer bracket...');
  const startRes = await adminApi('/api/tournament/start', { method: 'POST' });
  assert(startRes.ok, `Kunne ikke starte turnering: ${JSON.stringify(startRes.data)}`);

  stateRes = await api('/api/state');
  state = stateRes.data;
  const matches: Match[] = state.tournament.matches;

  // Kontroller antall kamper: For 16 spillere i cup skal det være nøyaktig 15 kamper (8 i R1, 4 i R2, 2 i R3, 1 i finale)
  console.log(`[Steg 2.1] Kontrollerer antall kamper (forventet 15)...`);
  assert(matches.length === 15, `Forventet nøyaktig 15 kamper, fant ${matches.length}`);
  console.log(`✓ Nøyaktig 15 kamper opprettet!`);

  // 3. Kontroller bracket-struktur, ingen duplikater, ingen foreldreløse noder
  console.log('\n[Steg 3] Kontrollerer bracket-struktur og relasjoner...');
  const r1Matches = matches.filter((m) => m.round === 1);
  const r2Matches = matches.filter((m) => m.round === 2);
  const r3Matches = matches.filter((m) => m.round === 3);
  const r4Matches = matches.filter((m) => m.round === 4);

  assert(r1Matches.length === 8, `Runde 1 skal ha 8 kamper, fant ${r1Matches.length}`);
  assert(r2Matches.length === 4, `Runde 2 (Kvartfinale) skal ha 4 kamper, fant ${r2Matches.length}`);
  assert(r3Matches.length === 2, `Runde 3 (Semifinale) skal ha 2 kamper, fant ${r3Matches.length}`);
  assert(r4Matches.length === 1, `Runde 4 (Finale) skal ha 1 kamp, fant ${r4Matches.length}`);

  // Sjekk unike match ID-er
  const matchIds = new Set(matches.map((m) => m.id));
  assert(matchIds.size === 15, 'Funnet duplikate match ID-er!');

  // Sjekk nextMatchId-kjeden
  const matchMap = new Map<string, Match>(matches.map((m) => [m.id, m]));
  for (const m of matches) {
    if (m.round < 4) {
      assert(Boolean(m.nextMatchId), `Kamp ${m.id} i runde ${m.round} mangler nextMatchId!`);
      const target = matchMap.get(m.nextMatchId!);
      assert(Boolean(target), `Kamp ${m.id} refererer til en ikke-eksisterende neste kamp ${m.nextMatchId}!`);
      assert(target!.round === m.round + 1, `Kamp ${m.id} i runde ${m.round} refererer til neste kamp i feil runde ${target!.round}!`);
    } else {
      // Finalen skal ikke ha nextMatchId
      assert(!m.nextMatchId, `Finalen ${m.id} skal ikke ha nextMatchId!`);
    }
  }

  // Sjekk at alle 16 deltakere er plassert i Runde 1 uten overlapp eller hull
  const r1Players = new Set<string>();
  for (const m of r1Matches) {
    assert(Boolean(m.playerA), `Kamp ${m.id} mangler playerA!`);
    assert(Boolean(m.playerB), `Kamp ${m.id} mangler playerB!`);
    assert(m.playerA!.id !== m.playerB!.id, `Kamp ${m.id} har samme spiller som A og B!`);
    assert(!r1Players.has(m.playerA!.id), `Spiller ${m.playerA!.displayId} er plassert i flere R1-kamper!`);
    assert(!r1Players.has(m.playerB!.id), `Spiller ${m.playerB!.displayId} er plassert i flere R1-kamper!`);
    r1Players.add(m.playerA!.id);
    r1Players.add(m.playerB!.id);
    assert(m.status === 'ready', `R1 kamp ${m.id} skal ha status 'ready', har '${m.status}'`);
  }
  assert(r1Players.size === 16, `Alle 16 spillere skal være i Runde 1, fant ${r1Players.size}`);
  console.log('✓ Bracket-struktur, next_match-relasjoner og R1-plassering er 100% konsistent.');

  // 4, 5, 6, 7. Spill alle kamper fra runde 1 til og med finalen
  console.log('\n[Steg 4-7] Spiller alle kamper fortløpende og sjekker vinnerføring...');

  // Funksjon for å spille en runde
  for (let currentRound = 1; currentRound <= 4; currentRound++) {
    const roundMatches = (await api('/api/state')).data.tournament.matches.filter(
      (m: Match) => m.round === currentRound
    );
    const roundName = currentRound === 1 ? 'Runde 1 (Åttedelsfinaler)'
      : currentRound === 2 ? 'Runde 2 (Kvartfinaler)'
      : currentRound === 3 ? 'Runde 3 (Semifinaler)'
      : 'Runde 4 (Finale)';

    console.log(`\n--- Spiller ${roundName} (${roundMatches.length} kamper) ---`);

    let matchIdx = 0;
    for (const match of roundMatches) {
      // Hent fersk kamp fra serveren
      const freshMatch: Match = (await api('/api/state')).data.tournament.matches.find(
        (m: Match) => m.id === match.id
      );

      assert(freshMatch.status === 'ready', `Kamp ${freshMatch.id} skal være 'ready', var '${freshMatch.status}'`);
      assert(Boolean(freshMatch.playerA), `Kamp ${freshMatch.id} mangler playerA`);
      assert(Boolean(freshMatch.playerB), `Kamp ${freshMatch.id} mangler playerB`);

      // Alterner mellom A og B for å teste begge slot-avanseringer
      const chosenWinnerSlot: 'A' | 'B' = matchIdx % 2 === 0 ? 'A' : 'B';
      matchIdx++;
      const scoreA = chosenWinnerSlot === 'A' ? 21 : 17;
      const scoreB = chosenWinnerSlot === 'A' ? 17 : 21;
      const expectedWinner = chosenWinnerSlot === 'A' ? freshMatch.playerA! : freshMatch.playerB!;

      console.log(`  Spiller kamp ${freshMatch.id}: ${freshMatch.playerA!.displayId} vs ${freshMatch.playerB!.displayId} -> Resultat: ${scoreA}-${scoreB} (Vinner: ${expectedWinner.displayId})`);

      const scoreRes = await adminApi('/api/tournament/match/score', {
        method: 'POST',
        body: JSON.stringify({
          matchId: freshMatch.id,
          scoreA,
          scoreB,
        }),
      });

      assert(scoreRes.ok, `Feil ved registrering av score for ${freshMatch.id}: ${JSON.stringify(scoreRes.data)}`);

      // Sjekk oppdatert kamp
      const afterScoreState: AppState = (await api('/api/state')).data;
      const updatedMatch = afterScoreState.tournament.matches.find((m) => m.id === freshMatch.id)!;
      assert(updatedMatch.status === 'completed', `Kamp ${updatedMatch.id} status skal være 'completed', er '${updatedMatch.status}'`);
      assert(updatedMatch.winnerId === expectedWinner.id, `Kamp ${updatedMatch.id} vinnerId matcher ikke expectedWinner!`);
      assert(updatedMatch.scoreA === scoreA && updatedMatch.scoreB === scoreB, `Score ble ikke lagret korrekt!`);

      // Hvis ikke finalen, verifiser at vinneren ble overført til neste kamp
      if (updatedMatch.nextMatchId) {
        const nextMatch = afterScoreState.tournament.matches.find((m) => m.id === updatedMatch.nextMatchId)!;
        const inNextMatch = nextMatch.playerA?.id === expectedWinner.id || nextMatch.playerB?.id === expectedWinner.id;
        assert(inNextMatch, `Vinner ${expectedWinner.displayId} fra kamp ${updatedMatch.id} ble IKKE ført til neste kamp ${nextMatch.id}!`);
      }
    }
  }

  // 8. Kontroller finalen og turneringsvinner
  console.log('\n[Steg 8] Kontrollerer turneringsvinner og finalestatus...');
  const finalState: AppState = (await api('/api/state')).data;
  const finaleMatch = finalState.tournament.matches.find((m) => m.round === 4)!;

  assert(finaleMatch.status === 'completed', `Finalen status skal være 'completed', er '${finaleMatch.status}'`);
  assert(Boolean(finaleMatch.winnerId), 'Finalen mangler winnerId!');
  assert(finalState.tournament.status === 'completed', `Turneringsstatus skal være 'completed', er '${finalState.tournament.status}'`);
  assert(Boolean(finalState.tournament.winner), 'Turneringsvinner er null!');
  assert(finalState.tournament.winner!.id === finaleMatch.winnerId, 'Turneringsvinner matcher ikke finalens vinnerId!');

  const champion = finalState.tournament.winner!;
  console.log(`✓ Turnering fullført! Kåret vinner: ${champion.displayId} (Navn: ${champion.firstName})`);

  // 9. Verifiser database og UI-konsistens
  console.log('\n[Steg 9] Verifiserer konsistens i lagret tilstand...');
  // Sjekk at ingen kamper er foreldreløse eller mangler
  assert(finalState.tournament.matches.length === 15, 'Matches array må inneholde nøyaktig 15 kamper');
  const uncompleted = finalState.tournament.matches.filter((m) => m.status !== 'completed' && m.status !== 'walkover');
  assert(uncompleted.length === 0, `Alle kamper skal være fullført, fant ${uncompleted.length} ufullførte!`);

  console.log('\n====================================================');
  console.log('🎉 TEST 1 – KOMPLETT 16-SPILLERS CUP ER BESTÅTT! 🎉');
  console.log(`   Totalt antall kamper: ${finalState.tournament.matches.length}`);
  console.log(`   Turneringsvinner:     ${champion.displayId}`);
  console.log('====================================================');

  return {
    success: true,
    matchesCount: finalState.tournament.matches.length,
    winner: champion.displayId,
  };
}

runTest1().then((res) => {
  console.log('RESULTAT_JSON:' + JSON.stringify(res));
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ TEST 1 FEIL:', err.message);
  console.log('RESULTAT_JSON:' + JSON.stringify({ success: false, error: err.message }));
  process.exit(1);
});
