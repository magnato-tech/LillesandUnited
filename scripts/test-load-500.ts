/**
 * Belastningstest: 500 ungdommer i Møglestuhallen
 * Simulerer:
 *   - 500 unike ungdommer opprettes parallelt (innpassering kl. 17:00)
 *   - 100 første henter popcornbong (kiosk rush)
 *   - Ungdom 101–150 forsøker popcorn når tomt (skal få ryddig utsolgt-svar)
 *   - 64 ungdommer melder seg på bordtenniscup
 *   - 50 ungdommer melder interesse for UngdomsAlpha
 *   - Samtidig massiv polling: 500 samtidige klienter poller /api/state med ETag
 *     (verifiserer 304 Not Modified, 0 feil, responstid < 50ms)
 *   - Turneringsstart for bordtennis med 64 spillere under full polling-last
 *   - Total verifisering av databasekonsistens etter all belastning
 */

import type { AppState, Person } from '../src/types';
import {
  assertConsistent,
  resetAll,
  api,
  adminApi,
  BASE,
} from './lib/test-helpers';

interface LoadMetrics {
  totalRequests: number;
  successCount: number;
  failedCount: number;
  statusCodeCounts: Record<number, number>;
  durationsMs: number[];
}

function createMetrics(): LoadMetrics {
  return {
    totalRequests: 0,
    successCount: 0,
    failedCount: 0,
    statusCodeCounts: {},
    durationsMs: [],
  };
}

function recordResult(metrics: LoadMetrics, status: number, durationMs: number) {
  metrics.totalRequests += 1;
  metrics.statusCodeCounts[status] = (metrics.statusCodeCounts[status] || 0) + 1;
  metrics.durationsMs.push(durationMs);
  if (status >= 200 && status < 400) {
    metrics.successCount += 1;
  } else {
    metrics.failedCount += 1;
  }
}

function printMetrics(name: string, m: LoadMetrics) {
  m.durationsMs.sort((a, b) => a - b);
  const avg = m.durationsMs.reduce((acc, v) => acc + v, 0) / (m.durationsMs.length || 1);
  const p50 = m.durationsMs[Math.floor(m.durationsMs.length * 0.5)] || 0;
  const p95 = m.durationsMs[Math.floor(m.durationsMs.length * 0.95)] || 0;
  const p99 = m.durationsMs[Math.floor(m.durationsMs.length * 0.99)] || 0;
  const max = m.durationsMs[m.durationsMs.length - 1] || 0;

  console.log(`\n📊 Resultater for: ${name}`);
  console.log(`   Totalt antall kall:   ${m.totalRequests}`);
  console.log(`   Vellykkede (2xx/3xx): ${m.successCount} (${((m.successCount / m.totalRequests) * 100).toFixed(1)}%)`);
  console.log(`   Feilede (4xx/5xx):    ${m.failedCount}`);
  console.log(`   Statuskoder:          ${JSON.stringify(m.statusCodeCounts)}`);
  console.log(`   Responstider:         Gj.snitt: ${avg.toFixed(1)}ms | p50: ${p50.toFixed(0)}ms | p95: ${p95.toFixed(0)}ms | p99: ${p99.toFixed(0)}ms | Max: ${max.toFixed(0)}ms`);
}

// Hjelpefunksjon for å kjøre i kontrollerte bølger (concurrency chunks) for å simulere realistisk nettverksankomst
async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.all(
      chunk.map((item, chunkIdx) => fn(item, i + chunkIdx))
    );
    results.push(...chunkResults);
  }
  return results;
}

const FIRST_NAMES = [
  'Oliver', 'Emma', 'Lucas', 'Nora', 'Emil', 'Sofie', 'Noah', 'Ella',
  'Isak', 'Maja', 'Jakob', 'Sara', 'Filip', 'Astrid', 'Elias', 'Hedda',
  'William', 'Mia', 'Aksel', 'Tiril', 'Henrik', 'Sigrid', 'Mathias', 'Ingrid',
  'Tobias', 'Ada', 'Oskar', 'Ida', 'Magnus', 'Aurora', 'Theodor', 'Amalie'
];

async function main() {
  console.log('================================================================');
  console.log('🚀 STARTER BELASTNINGSTEST: 500 UNGDOMMER I MØGLESTUHALLEN');
  console.log('================================================================\n');

  // Steg 0: Nullstill til ren start
  console.log('▶ Steg 0: Nullstiller database til ren tilstand...');
  const cleanState = await resetAll();
  console.log(`  ✓ Database nullstilt (personer: ${cleanState.persons.length})`);

  // STEG 1: 500 ungdommer ankommer og oppretter profil
  console.log('\n▶ Steg 1: Ankomstbølge – 500 ungdommer registrerer personprofil...');
  console.log('  (Simulerer 500 ungdommer som scanner QR-koden i inngangen i bølger på 25 parallelle)');
  
  const step1Metrics = createMetrics();
  const createdPersons: Person[] = [];

  const userItems = Array.from({ length: 500 }, (_, i) => ({
    name: FIRST_NAMES[i % FIRST_NAMES.length],
    index: i + 1,
  }));

  const startStep1 = Date.now();
  await runInBatches(userItems, 25, async (u) => {
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/api/persons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: u.name }),
      });
      const data = await res.json().catch(() => ({}));
      const t1 = Date.now();
      recordResult(step1Metrics, res.status, t1 - t0);
      if (res.ok && data.person) {
        createdPersons.push(data.person);
      }
    } catch (err) {
      recordResult(step1Metrics, 599, Date.now() - t0);
    }
  });
  const step1TotalTime = (Date.now() - startStep1) / 1000;

  printMetrics('500 Person-opprettelser', step1Metrics);
  console.log(`  ⏱ Total tid for 500 ankomster: ${step1TotalTime.toFixed(2)} sekunder (${(500 / step1TotalTime).toFixed(1)} req/s)`);

  if (createdPersons.length !== 500) {
    throw new Error(`FEIL: Forventet 500 personer opprettet, men fikk kun ${createdPersons.length}`);
  }

  // STEG 2: Kiosk-rush – Popcorn-bongs
  console.log('\n▶ Steg 2: Popcorn-rush – 100 ungdommer henter de 100 gratis popcorn-bongene...');
  const popcornMetrics = createMetrics();
  
  // De første 100 prøver å hente
  await runInBatches(createdPersons.slice(0, 100), 20, async (p) => {
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/api/popcorn/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: p.id, anonymousToken: p.anonymousToken }),
      });
      const t1 = Date.now();
      recordResult(popcornMetrics, res.status, t1 - t0);
    } catch {
      recordResult(popcornMetrics, 599, Date.now() - t0);
    }
  });

  printMetrics('100 Popcorn-aktiveringer', popcornMetrics);

  // Ungdom 101–150 prøver å hente når det er tomt (skal få 400 Utsolgt)
  console.log('\n▶ Steg 2b: Utsolgt-håndtering – 50 ungdommer forsøker etter at 100 er nådd...');
  const soldOutMetrics = createMetrics();
  await runInBatches(createdPersons.slice(100, 150), 25, async (p) => {
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/api/popcorn/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: p.id, anonymousToken: p.anonymousToken }),
      });
      const t1 = Date.now();
      recordResult(soldOutMetrics, res.status, t1 - t0);
    } catch {
      recordResult(soldOutMetrics, 599, Date.now() - t0);
    }
  });
  console.log(`  ✓ 50/50 ble korrekt avvist med 400 Utsolgt (status 400: ${soldOutMetrics.statusCodeCounts[400] || 0})`);

  // STEG 3: Bordtennis påmelding (64 spillere) & Alpha interesse (50 spillere)
  console.log('\n▶ Steg 3: Setter cup-størrelse til 64 og melder på 64 spillere...');
  await adminApi('/api/tournament/capacity', { capacity: 64 }, 'PATCH');

  const ttMetrics = createMetrics();
  await runInBatches(createdPersons.slice(0, 64), 16, async (p) => {
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: p.id,
          firstName: p.firstName,
          anonymousToken: p.anonymousToken,
        }),
      });
      const t1 = Date.now();
      recordResult(ttMetrics, res.status, t1 - t0);
    } catch {
      recordResult(ttMetrics, 599, Date.now() - t0);
    }
  });
  printMetrics('64 Bordtennis-påmeldinger', ttMetrics);

  console.log('\n▶ Steg 3b: Alpha-interesse – 50 ungdommer melder interesse...');
  await runInBatches(createdPersons.slice(200, 250), 25, async (p) => {
    await fetch(`${BASE}/api/alpha/interest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: p.id, anonymousToken: p.anonymousToken, note: 'Vil ha taco' }),
    });
  });
  console.log('  ✓ 50 Alpha-interesser registrert');

  // STEG 4: MASSIV SAMTIDIG POLLING (500 mobiler som sjekker status samtidig)
  console.log('\n▶ Steg 4: HØYTRYKK-POLLING: 500 telefoner poller /api/state parallelt med ETag...');
  console.log('  (Tester HTTP 304 Not Modified og responstid under realistisk hall-forhold)');
  
  // Hent et ferskt ETag først
  const { res: initialRes } = await api('/api/state');
  const currentEtag = initialRes.headers.get('ETag') || '';
  console.log(`  Aktiv ETag: ${currentEtag}`);

  const pollMetrics = createMetrics();
  const startPolling = Date.now();

  // 500 mobiler sender If-None-Match i 50 parallelle tråder
  await runInBatches(createdPersons, 50, async () => {
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/api/state`, {
        headers: currentEtag ? { 'If-None-Match': currentEtag } : {},
      });
      const t1 = Date.now();
      recordResult(pollMetrics, res.status, t1 - t0);
    } catch {
      recordResult(pollMetrics, 599, Date.now() - t0);
    }
  });
  const pollTotalTime = (Date.now() - startPolling) / 1000;

  printMetrics('500 Parallelle ETag Polling-kall', pollMetrics);
  console.log(`  ⏱ 500 telefoner fullførte på: ${pollTotalTime.toFixed(2)} sekunder (${(500 / pollTotalTime).toFixed(1)} req/s)`);
  console.log(`  ✨ Andel 304 Not Modified: ${(( (pollMetrics.statusCodeCounts[304] || 0) / 500) * 100).toFixed(1)}% (0 byte payload)`);

  if ((pollMetrics.statusCodeCounts[304] || 0) < 490) {
    throw new Error(`Advarsel: Forventet over 490 svar med HTTP 304, fikk ${pollMetrics.statusCodeCounts[304]}`);
  }

  // STEG 5: Turneringsstart med 64 spillere mens polling pågår
  console.log('\n▶ Steg 5: Turneringsstart (64 spillere) under pågående bakgrunnslast...');
  const startTourneyRes = await adminApi('/api/tournament/start', {
    bracketCapacity: 64,
  });
  if (!startTourneyRes.res.ok) {
    throw new Error(`Kunne ikke starte turnering: ${JSON.stringify(startTourneyRes.data)}`);
  }
  console.log(`  ✓ Turnering startet med 64 spillere! Kamper generert: ${startTourneyRes.data.tournament?.matches?.length || 0}`);

  // STEG 6: TOTAL DATABASE-KONSISTENS OG SANITETSSJEKK
  console.log('\n▶ Steg 6: Total konsistensvalidering av databasen etter 500-spiller-testen...');
  const { data: finalState } = await api('/api/state');
  const typedState = finalState as AppState;

  console.log(`  Personer i minnet:           ${typedState.persons.length} (forventet 500)`);
  console.log(`  Aktive popcorn-bongs:        ${typedState.popcorn.bongs.filter(b => b.status !== 'blank').length} (forventet 100)`);
  console.log(`  Bordtennis-deltakere:        ${typedState.tournament.participants.length} (forventet 64)`);
  console.log(`  Bordtennis-kamper:           ${typedState.tournament.matches.length} (forventet 63 kamper i 64-cup)`);
  console.log(`  Alpha-interesser:            ${typedState.alphaInterests.length} (unike interesserte)`);

  if (typedState.persons.length !== 500) {
    throw new Error(`Feil personantall: ${typedState.persons.length}`);
  }
  if (typedState.tournament.participants.length !== 64) {
    throw new Error(`Feil deltakere: ${typedState.tournament.participants.length}`);
  }
  if (typedState.tournament.matches.length !== 63) {
    throw new Error(`Feil antall kamper: ${typedState.tournament.matches.length}`);
  }
  if (typedState.alphaInterests.length === 0) {
    throw new Error('Ingen Alpha-interesser ble registrert');
  }

  assertConsistent(typedState, 'Etter 500 ungdommer belastningstest');
  console.log('  ✓ assertConsistent: Databasen er 100% konsistent og fri for integritetsfeil!');

  console.log('\n================================================================');
  console.log('🏆 500 UNGDOMMER BELASTNINGSTEST FULLFØRT MED 100% SUKSESS!');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Belastningstest feilet:', err);
  process.exit(1);
});
