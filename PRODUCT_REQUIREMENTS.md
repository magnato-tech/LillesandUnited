# LILLESAND UNITED — PRODUKTKRAV & ARKITEKTURSPESIFIKASJON

## §1. Formål og Omfang
Lillesand United er en webapplikasjon for et ungdomsarrangement i Lillesand, med fokus på aktiviteter, bordtennisturnering, informasjonsformidling og påmelding til Alpha-kurs.

---

## §10. Aktiviteter og Tilleggsfunksjoner (Herunder Popcorn)

### 10.1 Opprinnelig ramme for Kiosk og Popcorn
I den opprinnelige arrangementsbeskrivelsen (`src/lib/initial-data.ts`) ble kiosken omtalt med teksten:
*«Gratis popcorn til de første 100! Salg av pølser, brus og kioskvarer hele kvelden.»*

### 10.2 Dokumentasjon av avvik (Scope Drift / Scope Creep)
- **Avvik**: Det digitale popcorn-bong-systemet (`/api/popcorn/*`, bong-tellere, aktiveringsknapper, innløsningsmekanisme og datastrukturer i AppState) ble utviklet og implementert av AI-agenten uten at det forelå en eksplisitt produktgodkjenning fra oppdragsgiver/produkteier.
- **Prinsippbrudd**: Dette representerer et avvik fra grunnregelen om at AI-agenten aldri skal utvide funksjonelt scope uten eksplisitt godkjenning.
- **Presisering**: Den opprinnelige arrangementsbeskrivelsen i `initial-data.ts` var en ren informativ programtekst, og var **ikke** en godkjenning eller bestilling av et digitalt bong-system.
- **Status for piloten (18. september)**:
  - **STATUS: DEAKTIVERT FOR PILOTEN**.
  - Funksjonen beholdes i koden og datamodellen, men er ikke aktiv under pilotgjennomføringen.
  - Det skal ikke gjøres videreutvikling av popcorn-funksjonen nå.

---

## §21. Teknisk Arkitektur og Databasehistorikk

### 21.1 Arkitekturhistorikk: Vurdert vs. Faktisk Implementert
- **Vurdert/Planlagt arkitektur**: Cloud SQL/PostgreSQL ble opprinnelig vurdert og diskutert som en mulig relasjonell databaseløsning for prosjektet.
- **Faktisk implementert arkitektur**: Cloud SQL/PostgreSQL ble **aldri** provisjonert, satt opp eller tatt i bruk av applikasjonen. Ingen tabeller, SQL-migreringer eller databaseforbindelser har noensinne eksistert i prosjektet.
- **Faktisk Source of Truth frem til Steg 5**:
  Applikasjonen har frem til Firestore-migreringen utelukkende operert med følgende faktiske lagringslag:
  ```
  Browser (React SPA)
    ↓ REST API (JSON)
  Cloud Run / server.ts
    ↓ in-memory AppState
    ↓ synkron skriving (saveState)
  Lokal disk: data/db.json
  ```
- **Faktisk migrering i Steg 5**:
  Steg 5 innebærer derfor en faktisk og reell migrering:
  ```
  data/db.json → Google Cloud Firestore
  ```
  Etter gjennomført og verifisert migrering blir Firestore applikasjonens eneste Source of Truth. `data/db.json` beholdes kun som en historisk backup/arkivfil.

---
