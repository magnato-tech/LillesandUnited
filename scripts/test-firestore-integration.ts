import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, terminate } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { api, adminApi, createPerson, registerParticipant, activatePopcorn, assertConsistent } from './lib/test-helpers';
import type { AppState } from '../src/types';

async function main() {
  console.log('====================================================');
  console.log('🔥 VERIFISERER FIRESTORE-INTEGRASJON & APP-KVALITET 🔥');
  console.log('====================================================\n');

  // 1. Les firebase config
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('firebase-applet-config.json mangler!');
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  console.log('✓ Fant firebase-applet-config.json');
  console.log(`  Project ID: ${config.projectId}`);
  console.log(`  Database ID: ${config.firestoreDatabaseId}`);

  // 2. Initialiser Firestore direkte i testen
  const app = !getApps().length ? initializeApp(config) : getApp();
  const db = getFirestore(app, config.firestoreDatabaseId);
  console.log('✓ Initialiserte Firestore SDK med database:', config.firestoreDatabaseId);

  // 3. Test direkte skriving og lesing til /test/connection
  console.log('\n[Steg 1] Tester direkte Firestore skriv/les (/test/connection)...');
  const testTime = new Date().toISOString();
  await setDoc(doc(db, 'test', 'test_ping'), {
    id: 'test_ping',
    connectedAt: testTime,
  });
  const pingSnap = await getDoc(doc(db, 'test', 'test_ping'));
  if (!pingSnap.exists() || pingSnap.data()?.connectedAt !== testTime) {
    throw new Error('Direkte skriving/lesing til Firestore feilet!');
  }
  console.log('✓ Direkte skriv og les til Firestore (/test/test_ping) OK!');

  // 4. Test serverens statusendepunkt
  console.log('\n[Steg 2] Sjekker /api/firestore/status på serveren...');
  const { res: statusRes, data: statusData } = await api('/api/firestore/status');
  if (!statusRes.ok) {
    throw new Error(`/api/firestore/status returnerte status ${statusRes.status}`);
  }
  console.log('✓ Server Firestore Status:', JSON.stringify(statusData, null, 2));
  if (!statusData.connected) {
    throw new Error('Serveren rapporterer at Firestore ikke er tilkoblet!');
  }

  // 5. Test synkronisering via admin-endepunkt
  console.log('\n[Steg 3] Tester manuell synkronisering via /api/admin/firestore/sync...');
  const { res: syncRes, data: syncData } = await adminApi('/api/admin/firestore/sync');
  if (!syncRes.ok) {
    throw new Error(`Synkronisering feilet: ${syncData.error}`);
  }
  console.log('✓ Synkronisering OK:', syncData.message);
  console.log('  Elementer synkronisert:', syncData.itemCounts);

  // 6. Verifiser at /appState/current finnes i Firestore
  console.log('\n[Steg 4] Verifiserer /appState/current direkte i Firestore...');
  const currentSnap = await getDoc(doc(db, 'appState', 'current'));
  if (!currentSnap.exists()) {
    throw new Error('Dokumentet /appState/current finnes ikke i Firestore!');
  }
  const remoteState = currentSnap.data() as AppState;
  console.log(`✓ /appState/current funnet! Oppdatert: ${(remoteState as any)?.updatedAt || 'Ukjent'}`);
  console.log(`  Personer i skyen: ${remoteState.persons?.length || 0}`);
  console.log(`  Deltakere i skyen: ${remoteState.tournament?.participants?.length || 0}`);
  console.log(`  Kamper i skyen: ${remoteState.tournament?.matches?.length || 0}`);
  assertConsistent(remoteState, 'Firestore remoteState');

  // 7. Test sanntidsflyt: Opprett person, meld på, aktiver popcorn og verifiser Firestore
  console.log('\n[Steg 5] Tester komplett hendelsesflyt mot server og Firestore...');
  const uniqueName = 'FirestoreTester';
  const person = await createPerson(uniqueName);
  console.log(`✓ Opprettet person: ${person.displayId} (ID: ${person.id})`);

  // Meld på bordtennis
  const stateAfterReg = await registerParticipant(person.id, person.firstName, person.anonymousToken);
  console.log(`✓ Registrert på bordtennis. Antall deltakere nå: ${stateAfterReg.tournament.participants.length}`);

  // Aktiver popcorn
  const stateAfterPopcorn = await activatePopcorn(person.id, person.anonymousToken, person.displayId);
  const claimedBongs = stateAfterPopcorn.popcorn.bongs.filter((b) => b.personId === person.id);
  console.log(`✓ Aktivert popcorn for ${person.displayId}. Bong #${claimedBongs[0]?.number}`);

  // Flush serverens Firestore-skriving
  await api('/api/firestore/flush', { method: 'POST' });
  await new Promise((r) => setTimeout(r, 200));

  // Les fra Firestore igjen og sjekk at endringene er reflektert
  const updatedSnap = await getDoc(doc(db, 'appState', 'current'));
  const updatedRemoteState = updatedSnap.data() as AppState;
  const foundPerson = updatedRemoteState.persons.find((p) => p.id === person.id);
  const foundParticipant = updatedRemoteState.tournament.participants.find((p) => p.personId === person.id);
  const foundBong = updatedRemoteState.popcorn.bongs.find((b) => b.personId === person.id);

  if (!foundPerson) {
    throw new Error(`Person ${person.id} ble ikke lagret i Firestore /appState/current!`);
  }
  if (!foundParticipant) {
    throw new Error(`Deltaker for ${person.id} ble ikke lagret i Firestore!`);
  }
  if (!foundBong) {
    throw new Error(`Popcorn-bong for ${person.id} ble ikke lagret i Firestore!`);
  }
  console.log('✓ Firestore inneholder nå den nye personen, påmeldingen og popcorn-bongen!');

  // 8. Sjekk også at enkeltdokument i /persons/{id} ble skrevet ved sync
  const { res: syncRes2, data: syncData2 } = await adminApi('/api/admin/firestore/sync');
  if (!syncRes2.ok) {
    throw new Error(`Sync i steg 8 feilet: ${syncData2.error || syncRes2.status}`);
  }
  const personDocSnap = await getDoc(doc(db, 'persons', person.id));
  if (!personDocSnap.exists()) {
    throw new Error(`Enkeltdokument /persons/${person.id} mangler i Firestore!`);
  }
  console.log(`✓ Enkeltdokument /persons/${person.id} verifisert i Firestore!`);

  console.log('\n====================================================');
  console.log('🎉 ALLE FIRESTORE-TESTER FULLFØRT UTEN FEIL! 🎉');
  console.log('====================================================\n');

  try {
    await terminate(db);
  } catch (e) {}
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ TEST FEIL:', err);
  process.exit(1);
});
