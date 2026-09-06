/**
 * Validerer data/db.json direkte uten kjørende server.
 * Kjør: npm run validate:db
 */

import fs from 'fs';
import path from 'path';
import type { AppState } from '../src/types';
import { validateAppState, computePopcornClaimedCount } from '../src/lib/state-consistency';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

function main() {
  console.log('=== Valider db.json ===\n');

  if (!fs.existsSync(DB_FILE)) {
    console.error(`❌ Fil ikke funnet: ${DB_FILE}`);
    process.exit(1);
  }

  let state: AppState;
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    state = JSON.parse(raw) as AppState;
  } catch (err: any) {
    console.error(`❌ Kunne ikke lese/parse db.json: ${err.message}`);
    process.exit(1);
  }

  const result = validateAppState(state);

  const computedCount = computePopcornClaimedCount(state.popcorn?.bongs || []);
  const storedCount = state.event?.popcornClaimedCount ?? -1;
  if (computedCount !== storedCount) {
    result.issues.push(
      `(loadState) popcornClaimedCount i fil (${storedCount}) ≠ beregnet (${computedCount})`
    );
    result.ok = false;
  }

  if (result.ok) {
    console.log('✅ db.json er konsistent');
    console.log(`   Personer: ${state.persons?.length ?? 0}`);
    console.log(`   Deltakere: ${state.tournament?.participants?.length ?? 0}`);
    console.log(`   Kamper: ${state.tournament?.matches?.length ?? 0}`);
    console.log(`   Popcorn aktive/brukt: ${computedCount}/${state.popcorn?.totalCapacity ?? 0}`);
    process.exit(0);
  }

  console.error('❌ Konsistensfeil i db.json:\n');
  for (const issue of result.issues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

main();
