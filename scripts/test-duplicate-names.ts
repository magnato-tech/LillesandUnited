/**
 * Verifiserer at Oliver_1 og Oliver_2 behandles som separate personer for popcorn-bong.
 * Kjør: npx tsx scripts/test-duplicate-names.ts
 * Krever dev-server på http://localhost:3000
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_PIN = process.env.ADMIN_PIN || 'United2026';
const RESET_PIN = process.env.RESET_PIN || 'ResetUnited2026';

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function createPerson(firstName: string) {
  const { res, data } = await api('/api/persons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName }),
  });
  if (!res.ok) throw new Error(`createPerson failed: ${data.error || res.status}`);
  return data.person as {
    id: string;
    displayId: string;
    firstName: string;
    anonymousToken: string;
  };
}

async function activatePopcorn(personId: string, token: string, userName?: string) {
  const { res, data } = await api('/api/popcorn/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personId, anonymousToken: token, userName }),
  });
  return { ok: res.ok, status: res.status, data };
}

async function getMyBong(personId: string) {
  const { res, data } = await api(`/api/popcorn/my-bong?personId=${encodeURIComponent(personId)}`);
  if (!res.ok) return null;
  return data.bong;
}

async function main() {
  console.log('=== Test: unike personer med samme fornavn (Oliver) ===\n');

  const { res: resetRes } = await api('/api/admin/reset-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-pin': ADMIN_PIN },
    body: JSON.stringify({ resetPin: RESET_PIN }),
  });
  if (!resetRes.ok) {
    throw new Error('Kunne ikke resette testdata. Er serveren oppe på ' + BASE + '?');
  }

  const oliver1 = await createPerson('Oliver');
  const oliver2 = await createPerson('Oliver');

  console.log(`Opprettet: ${oliver1.displayId} (${oliver1.id})`);
  console.log(`Opprettet: ${oliver2.displayId} (${oliver2.id})`);

  if (oliver1.displayId !== 'Oliver_1' || oliver2.displayId !== 'Oliver_2') {
    throw new Error(
      `Forventet Oliver_1 og Oliver_2, fikk ${oliver1.displayId} og ${oliver2.displayId}`
    );
  }

  const activate1 = await activatePopcorn(oliver1.id, oliver1.anonymousToken, oliver1.displayId);
  if (!activate1.ok) {
    throw new Error(`Aktivering for Oliver_1 feilet: ${activate1.data.error}`);
  }
  const bong1 = activate1.data.bong;
  console.log(`\nOliver_1 aktiverte bong #${bong1.number} (personId=${bong1.personId})`);

  const bong2After = await getMyBong(oliver2.id);
  if (bong2After) {
    throw new Error(
      `Oliver_2 skulle ikke ha bong, men har bong #${bong2After.number} (personId=${bong2After.personId})`
    );
  }
  console.log('Oliver_2 har ingen bong (korrekt isolasjon)');

  const ambiguous = await activatePopcorn('', 'legacy_token', 'Oliver');
  if (ambiguous.ok) {
    throw new Error('Ambiguous aktivering med bare "Oliver" skulle feilet');
  }
  if (ambiguous.data.code !== 'AMBIGUOUS_NAME') {
    throw new Error(`Forventet AMBIGUOUS_NAME, fikk: ${ambiguous.data.error}`);
  }
  console.log('Ambiguous navn "Oliver" uten personId avvist (korrekt)');

  const activate2 = await activatePopcorn(oliver2.id, oliver2.anonymousToken, oliver2.displayId);
  if (!activate2.ok) {
    throw new Error(`Aktivering for Oliver_2 feilet: ${activate2.data.error}`);
  }
  const bong2 = activate2.data.bong;
  if (bong2.personId !== oliver2.id) {
    throw new Error('Oliver_2 bong knyttet til feil personId');
  }
  if (bong2.number === bong1.number) {
    throw new Error('Oliver_1 og Oliver_2 deler samme bongnummer');
  }
  console.log(`Oliver_2 aktiverte egen bong #${bong2.number}`);

  const bong1Again = await getMyBong(oliver1.id);
  if (!bong1Again || bong1Again.number !== bong1.number) {
    throw new Error('Oliver_1 bong ble endret etter Oliver_2 aktiverte');
  }
  console.log('Oliver_1 bong uendret etter Oliver_2 aktiverte');

  console.log('\n✅ Alle tester bestått: Oliver_1 og Oliver_2 er separate personer.');
}

main().catch((err) => {
  console.error('\n❌ Test feilet:', err.message || err);
  process.exit(1);
});
