/**
 * Tester: Populer testdata → slett testdata → nullstill alt.
 *
 * Dekker:
 * 1. Populer med testdata (/api/tournament/simulate)
 * 2. Slett alle testdata (/api/admin/reset-testdata) — beholder ekte personer
 * 3. Nullstill alt (/api/admin/reset-all) — sletter også ekte personer
 *
 * Kjør: bun run test:populate-reset
 * Krever: server på http://localhost:3000
 */

import type { AppState } from '../src/types';
import {
  assertConsistent,
  resetAll,
  fetchState,
  runScenario,
  createPerson,
  activatePopcorn,
  adminApi,
  api,
  RESET_PIN,
} from './lib/test-helpers';

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

function countSimulated(state: AppState): number {
  return (state.persons || []).filter((p) => p.isSimulated).length;
}

function countReal(state: AppState): number {
  return (state.persons || []).filter((p) => !p.isSimulated).length;
}

function assertEmptyRuntime(state: AppState, label: string): void {
  assert(state.persons.length === 0, `${label}: forventet 0 personer, fikk ${state.persons.length}`);
  assert(
    state.tournament.participants.length === 0,
    `${label}: forventet 0 bordtennisdeltakere, fikk ${state.tournament.participants.length}`
  );
  assert(
    state.tournament.matches.length === 0,
    `${label}: forventet 0 kamper, fikk ${state.tournament.matches.length}`
  );
  assert(state.tournament.status === 'registration', `${label}: status skal være registration`);
  assert(state.tournament.winner === null, `${label}: winner skal være null`);
  assert(state.alphaInterests.length === 0, `${label}: forventet 0 Alpha-interesser`);
  const activeBongs = state.popcorn.bongs.filter(
    (b) => b.status === 'activated' || b.status === 'used'
  );
  assert(activeBongs.length === 0, `${label}: forventet 0 aktive popcorn-bonger`);
  assert(Boolean(state.event?.name), `${label}: arrangementets navn skal beholdes`);
  assert((state.activities || []).length > 0, `${label}: aktiviteter skal beholdes`);
}

async function main() {
  console.log('=== Populer testdata / slett testdata / nullstill alt ===\n');

  let state: AppState;
  let realPersonId: string;
  let realPersonDisplayId: string;

  // ----------------------------------------------------
  // 0. Ren start
  // ----------------------------------------------------
  await runScenario('0. Nullstill database (ren start)', async () => {
    state = await resetAll();
    assertEmptyRuntime(state, 'ren start');
    assertConsistent(state, 'ren start');
  });

  // ----------------------------------------------------
  // 1. Opprett én ekte person (skal overleve reset-testdata)
  // ----------------------------------------------------
  await runScenario('1. Opprett ekte person + popcorn + Alpha', async () => {
    const person = await createPerson('EkteTestbruker');
    realPersonId = person.id;
    realPersonDisplayId = person.displayId;

    state = await activatePopcorn(person.id, person.anonymousToken, person.displayId);
    assert(
      state.popcorn.bongs.some((b) => b.personId === person.id && b.status === 'activated'),
      'Ekte person skulle ha aktivert popcorn-bong'
    );

    const { res: alphaRes, data: alphaData } = await api('/api/alpha/interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: person.firstName,
        personId: person.id,
        phone: '90000000',
      }),
    });
    assert(alphaRes.ok, `Alpha-registrering feilet: ${alphaData.error}`);
    state = alphaData.state as AppState;

    assert(countReal(state) === 1, 'Skal ha nøyaktig 1 ekte person');
    assert(countSimulated(state) === 0, 'Skal ikke ha simulerte personer ennå');
    assert(state.alphaInterests.length === 1, 'Skal ha 1 Alpha-interesse');
    assertConsistent(state, 'ekte person klar');
  });

  // ----------------------------------------------------
  // 2. Populer med testdata (simulate)
  // ----------------------------------------------------
  await runScenario('2. Populer med testdata (simulate 16)', async () => {
    const { res, data } = await adminApi('/api/tournament/simulate', { count: 16 });
    assert(res.ok, `simulate feilet: ${data.error || res.status}`);
    state = data.state as AppState;

    assert(data.count === 16, `Forventet count=16, fikk ${data.count}`);
    assert(
      state.tournament.participants.length === 16,
      `Forventet 16 bordtennisdeltakere, fikk ${state.tournament.participants.length}`
    );
    assert(state.tournament.matches.length > 0, 'Cup-tre skulle være generert');
    assert(state.tournament.status === 'active', 'Turnering skulle være active');
    assert(countSimulated(state) === 16, `Forventet 16 simulerte personer, fikk ${countSimulated(state)}`);
    assert(countReal(state) === 1, 'Ekte person skal fortsatt finnes etter populate');
    assert(
      state.persons.some((p) => p.id === realPersonId),
      `Ekte person ${realPersonDisplayId} mangler etter populate`
    );
    assert(
      state.persons.filter((p) => p.isSimulated).every((p) => p.isSimulated === true),
      'Simulerte personer må ha isSimulated=true'
    );
    assertConsistent(state, 'etter populate');
  });

  // ----------------------------------------------------
  // 3. Slett alle testdata (reset-testdata)
  // ----------------------------------------------------
  await runScenario('3. Slett alle testdata (reset-testdata)', async () => {
    const { res, data } = await adminApi('/api/admin/reset-testdata', { resetPin: RESET_PIN });
    assert(res.ok, `reset-testdata feilet: ${data.error || res.status}`);
    state = data.state as AppState;

    assert(countSimulated(state) === 0, `Simulerte personer skulle være borte, fant ${countSimulated(state)}`);
    assert(countReal(state) === 1, `Ekte person skulle beholdes, fant ${countReal(state)} ekte`);
    assert(
      state.persons.some((p) => p.id === realPersonId && !p.isSimulated),
      `Ekte person ${realPersonDisplayId} ble slettet ved reset-testdata`
    );

    assert(state.tournament.participants.length === 0, 'Bordtennisdeltakere skulle være tømt');
    assert(state.tournament.matches.length === 0, 'Kamper skulle være tømt');
    assert(state.tournament.status === 'registration', 'Status skulle være registration');
    assert(state.tournament.winner === null, 'Winner skulle være null');
    assert(state.alphaInterests.length === 0, 'Alpha skulle være tømt');

    const activeBongs = state.popcorn.bongs.filter(
      (b) => b.status === 'activated' || b.status === 'used'
    );
    assert(activeBongs.length === 0, 'Popcorn skulle være nullstilt');
    assert(Boolean(state.event?.name), 'Arrangementets navn skal beholdes');
    assert((state.activities || []).length > 0, 'Aktiviteter skal beholdes');
    assertConsistent(state, 'etter reset-testdata');
  });

  // ----------------------------------------------------
  // 4. Populer på nytt, deretter nullstill ALT
  // ----------------------------------------------------
  await runScenario('4. Populer på nytt + nullstill database (reset-all)', async () => {
    // Populer igjen så vi har noe å slette
    const { res: simRes, data: simData } = await adminApi('/api/tournament/simulate', { count: 16 });
    assert(simRes.ok, `andre simulate feilet: ${simData.error}`);
    state = simData.state as AppState;
    assert(countSimulated(state) === 16, 'Skal ha 16 simulerte etter andre populate');
    assert(countReal(state) === 1, 'Ekte person skal fortsatt finnes');
    assert(state.tournament.participants.length === 16, 'Skal ha 16 deltakere før reset-all');

    // Full nullstilling
    const { res, data } = await adminApi('/api/admin/reset-all', { resetPin: RESET_PIN });
    assert(res.ok, `reset-all feilet: ${data.error || res.status}`);
    state = data.state as AppState;

    assertEmptyRuntime(state, 'etter reset-all');
    assert(
      !state.persons.some((p) => p.id === realPersonId),
      'Ekte person skal også være slettet ved reset-all'
    );
    assertConsistent(state, 'etter reset-all');
  });

  // ----------------------------------------------------
  // 5. Verifiser at ny registrering starter rent (Oliver_1)
  // ----------------------------------------------------
  await runScenario('5. Ny person etter nullstilling får Oliver_1', async () => {
    const oliver = await createPerson('Oliver');
    assert(oliver.displayId === 'Oliver_1', `Forventet Oliver_1, fikk ${oliver.displayId}`);
    state = await fetchState();
    assert(state.persons.length === 1, 'Skal ha nøyaktig 1 person etter ny registrering');
    assert(countSimulated(state) === 0, 'Ny person skal ikke være simulert');
    assertConsistent(state, 'ny person etter reset-all');
  });

  // Opprydding
  await resetAll();

  console.log('\n✅ Alle populate / slett testdata / nullstill-scenarioer bestått.');
}

main().catch((err) => {
  console.error('\n❌ Populate/reset-test feilet:', err.message || err);
  process.exit(1);
});
