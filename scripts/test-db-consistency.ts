/**
 * Kjører API-scenarioer og verifiserer databasekonsistens etter hvert steg.
 * Kjør: npm run test:consistency
 * Krever dev-server på http://localhost:3000
 */

import type { AppState } from '../src/types';
import {
  assertConsistent,
  resetAll,
  fetchState,
  runScenario,
  createPerson,
  activatePopcorn,
  registerParticipant,
  adminApi,
  api,
} from './lib/test-helpers';

async function main() {
  console.log('=== Databasekonsistens – API-scenarioer ===\n');

  let state: AppState;

  await runScenario('S1: Tom database (reset-all)', async () => {
    state = await resetAll();
    assertConsistent(state, 'S1 reset-all');
  });

  await runScenario('S2: Person-opprettelse (Oliver × 3)', async () => {
    const o1 = await createPerson('Oliver');
    const o2 = await createPerson('Oliver');
    const o3 = await createPerson('Oliver');
    if (o1.displayId !== 'Oliver_1' || o2.displayId !== 'Oliver_2' || o3.displayId !== 'Oliver_3') {
      throw new Error('displayId-sekvens feil');
    }
    state = await fetchState();
    assertConsistent(state, 'S2 personer');
  });

  await runScenario('S3: Popcorn-aktivering for 2 personer', async () => {
    const persons = (await fetchState()).persons.filter((p) => p.firstName === 'Oliver');
    await activatePopcorn(persons[0].id, persons[0].anonymousToken, persons[0].displayId);
    state = await activatePopcorn(persons[1].id, persons[1].anonymousToken, persons[1].displayId);
    const bongs = state.popcorn.bongs.filter((b) => b.personId);
    if (bongs.length !== 2) throw new Error(`Forventet 2 aktive bonger, fikk ${bongs.length}`);
    assertConsistent(state, 'S3 popcorn');
  });

  await runScenario('S4: Popcorn-innløsning', async () => {
    const { res, data } = await adminApi('/api/popcorn/redeem', { bongNumber: 1 });
    if (!res.ok) throw new Error(`redeem feilet: ${data.error}`);
    state = data.state as AppState;
    const bong1 = state.popcorn.bongs.find((b) => b.number === 1);
    if (bong1?.status !== 'used') throw new Error('Bong #1 skulle være used');
    assertConsistent(state, 'S4 redeem');
  });

  await runScenario('S5: Påmelding cup med personId', async () => {
    const persons = state.persons.filter((p) => p.firstName === 'Oliver');
    state = await registerParticipant(persons[0].id, persons[0].firstName, persons[0].anonymousToken);
    state = await registerParticipant(persons[1].id, persons[1].firstName, persons[1].anonymousToken);
    if (state.tournament.participants.length < 2) {
      throw new Error('For få deltakere etter påmelding');
    }
    assertConsistent(state, 'S5 påmelding');
  });

  await runScenario('S6: Idempotent påmelding', async () => {
    const p = state.persons[0];
    const countBefore = state.tournament.participants.length;
    state = await registerParticipant(p.id, p.firstName, p.anonymousToken);
    const countAfter = state.tournament.participants.length;
    if (countAfter !== countBefore) {
      throw new Error(`Idempotent påmelding feilet: ${countBefore} → ${countAfter}`);
    }
    assertConsistent(state, 'S6 idempotent');
  });

  await runScenario('S7: Simuler 16-spiller turnering', async () => {
    const { res, data } = await adminApi('/api/tournament/simulate', { count: 16 });
    if (!res.ok) throw new Error(`simulate feilet: ${data.error}`);
    state = data.state as AppState;
    if (state.tournament.matches.length === 0) throw new Error('Ingen kamper generert');
    if (state.tournament.participants.length !== 16) {
      throw new Error(`Forventet 16 deltakere, fikk ${state.tournament.participants.length}`);
    }
    assertConsistent(state, 'S7 simulate');
  });

  await runScenario('S8: Registrer kampresultater (R1)', async () => {
    const r1 = state.tournament.matches
      .filter((m) => m.round === 1 && m.playerA && m.playerB && !m.isWalkover)
      .slice(0, 2);

    for (const m of r1) {
      const { res, data } = await adminApi('/api/tournament/match/score', {
        matchId: m.id,
        scoreA: 21,
        scoreB: 15,
      });
      if (!res.ok) throw new Error(`score feilet for ${m.id}: ${data.error}`);
      state = data.state as AppState;
    }

    const completed = state.tournament.matches.filter((m) => m.status === 'completed').length;
    if (completed < 2) throw new Error('For få fullførte kamper');
    assertConsistent(state, 'S8 scores');
  });

  await runScenario('S9: Nullstill kampresultat', async () => {
    const completed = state.tournament.matches.find((m) => m.status === 'completed');
    if (!completed) throw new Error('Ingen fullført kamp å nullstille');

    const { res, data } = await adminApi('/api/tournament/match/reset', {
      matchId: completed.id,
      confirmReset: true,
    });
    if (!res.ok) throw new Error(`reset feilet: ${data.error}`);
    state = data.state as AppState;

    const resetMatch = state.tournament.matches.find((m) => m.id === completed.id);
    if (resetMatch?.winnerId) throw new Error('Kamp har fortsatt winnerId etter reset');
    assertConsistent(state, 'S9 reset match');
  });

  await runScenario('S10: Korriger kampresultat', async () => {
    const playable = state.tournament.matches.find(
      (m) => m.playerA && m.playerB && !m.isWalkover && m.status !== 'walkover'
    );
    if (!playable) throw new Error('Ingen spillbar kamp');

    const { res: scoreRes, data: scoreData } = await adminApi('/api/tournament/match/score', {
      matchId: playable.id,
      scoreA: 21,
      scoreB: 18,
    });
    if (!scoreRes.ok) throw new Error(`score feilet: ${scoreData.error}`);
    state = scoreData.state as AppState;

    const { res, data } = await adminApi('/api/tournament/match/correct', {
      matchId: playable.id,
      newScoreA: 18,
      newScoreB: 21,
      confirmCorrection: true,
    });
    if (!res.ok) throw new Error(`correct feilet: ${data.error}`);
    state = data.state as AppState;

    const corrected = state.tournament.matches.find((m) => m.id === playable.id);
    if (corrected?.winnerId !== corrected?.playerB?.id) {
      throw new Error('Korrigering endret ikke vinner til playerB');
    }
    assertConsistent(state, 'S10 correct');
  });

  await runScenario('S11: Reset testdata (behold persons)', async () => {
    const realPersonIdsBefore = state.persons.filter((p) => !p.isSimulated).map((p) => p.id);
    const { res, data } = await adminApi('/api/admin/reset-testdata');
    if (!res.ok) throw new Error(`reset-testdata feilet: ${data.error}`);
    state = data.state as AppState;

    for (const id of realPersonIdsBefore) {
      if (!state.persons.some((p) => p.id === id)) {
        throw new Error(`Ekte person ${id} ble slettet ved reset-testdata`);
      }
    }
    const simulatedLeft = state.persons.filter((p) => p.isSimulated);
    if (simulatedLeft.length > 0) {
      throw new Error(`${simulatedLeft.length} simulerte personer ble ikke fjernet`);
    }
    if (state.tournament.participants.length !== 0) {
      throw new Error('Turnering ikke nullstilt');
    }
    const activeBongs = state.popcorn.bongs.filter(
      (b) => b.status === 'activated' || b.status === 'used'
    );
    if (activeBongs.length !== 0) throw new Error('Popcorn ikke nullstilt');
    assertConsistent(state, 'S11 reset-testdata');
  });

  await runScenario('S12: Ambiguous popcorn-navn avvises', async () => {
    const olivers = state.persons.filter((p) => p.firstName === 'Oliver');
    if (olivers.length < 2) throw new Error('Trenger minst 2 Oliver for ambiguous-test');

    const { res, data } = await api('/api/popcorn/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'Oliver', clientToken: 'legacy_test' }),
    });
    if (res.ok) throw new Error('Ambiguous aktivering skulle feilet');
    if (data.code !== 'AMBIGUOUS_NAME') {
      throw new Error(`Forventet AMBIGUOUS_NAME, fikk: ${data.error}`);
    }
    state = await fetchState();
    assertConsistent(state, 'S12 ambiguous');
  });

  console.log('\n✅ Alle 12 konsistensscenarioer bestått.');
}

main().catch((err) => {
  console.error('\n❌ Konsistenstest feilet:', err.message || err);
  process.exit(1);
});
