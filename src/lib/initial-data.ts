import { AppState, Activity, PopcornData } from '../types';

export const INITIAL_POPCORN: PopcornData = {
  totalCapacity: 100,
  bongs: Array.from({ length: 100 }, (_, i) => ({
    number: i + 1,
    status: 'blank',
    userName: null,
    clientToken: null,
  })),
};

export const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: 'act-tabletennis',
    name: 'Bordtenniscup',
    shortDesc: 'Digital påmelding ved ankomst! Single elimination cup på 2 bord. Premieutdeling kl. 22:30!',
    fullDesc: 'Klassisk bordtennisturnering med digital påmelding ved ankomst og digital turneringsflyt! Kampene starter kl. 18:45, og spilles først til 21 poeng med 5 server hver (2 poengs ledelse ved 20–20). Semifinaler og finale spilles fra kl. 22:00, og høytidelig premieutdeling skjer kl. 22:30!',
    iconName: 'Trophy',
    time: 'Digital påmelding fra 17:00 • Kampstart 18:45',
    location: 'Bordtennis-sonen (2 bord)',
    enabled: true,
    badge: 'Digital påmelding',
    highlight: true,
  },
  {
    id: 'act-football',
    name: 'Lillesand United Fotball',
    shortDesc: '5-er turnering i hallen. Fysisk organisering og lagpåmelding ved ankomst fra kl. 17:00!',
    fullDesc: 'Rå 5-er innendørs fotballturnering! Turneringen organiseres fysisk i hallen (har foreløpig ikke digital turneringsmotor). Sett sammen et lag med venner eller meld deg på et lag ved ankomst. Kampene starter kl. 18:45, semifinaler/finaler kl. 22:00 og premieutdeling kl. 22:30.',
    iconName: 'CircleDot',
    time: 'Fysisk lagpåmelding fra 17:00 • Kampstart 18:45',
    location: 'Hovedbanen, Møglestuhallen',
    enabled: true,
    badge: 'Fysisk organisering',
  },
  {
    id: 'act-gaming',
    name: 'Mario Kart & Gaming Lounge',
    shortDesc: 'Påmelding enkeltvis ved ankomst! Konkurranser, Mario Kart på storskjerm og lounge.',
    fullDesc: 'Gaming på storskjerm og dedikerte spillstasjoner! Påmelding skjer enkeltvis ved ankomst i gaming-sonen (har foreløpig ikke digital turneringsmotor). Gaming og turnering starter kl. 18:45, finaler kl. 22:00 og premieutdeling kl. 22:30.',
    iconName: 'Gamepad2',
    time: 'Påmelding fra 17:00 • Gaming starter 18:45',
    location: 'Gaming-hjørnet',
    enabled: true,
    badge: 'Påmelding ved ankomst',
  },
  {
    id: 'act-gathering',
    name: 'Kveldens fellesmøte',
    shortDesc: 'Band & tale v/ Eivind Galdal',
    fullDesc: 'Kveldens store felles samlingsstund for hele hallen! Fellesmøte med lovsang, morsomme leker, energiske Moshpit-sanger og inspirerende tale ved Eivind Galdal fra SALT Bergen. Starter kl. 21:00 og varer til ca. 21:45.',
    iconName: 'Music',
    time: 'Kl. 21:00 – ca. 21:45',
    location: 'Hovedscenen / Tribunen',
    enabled: true,
    badge: 'Kveldens fellesmøte',
  },
  {
    id: 'act-kiosk',
    name: 'Kiosk & Varmmat',
    shortDesc: 'Gratis popcorn til de første 100! Salg av pølser, brus og kioskvarer hele kvelden.',
    fullDesc: 'De første 100 som kommer inn døra fra kl. 17:00 får gratis nypoppet popcorn! I kiosken kan du kjøpe varme pølser, iskald brus, sjokolade og snacks til ungdomsvennlige priser gjennom hele kvelden helt til avslutning kl. 22:00.',
    iconName: 'Utensils',
    time: 'Kl. 17:00 – 22:00',
    location: 'Kioskområdet ved inngangen',
    enabled: true,
    badge: 'Gratis popcorn!',
  },
  {
    id: 'act-alpha',
    name: 'UngdomsAlpha',
    shortDesc: 'Starter fredag 25. september kl. 19:00. Uformelt og gøy med god mat!',
    fullDesc: 'Hva er egentlig meningen med livet? UngdomsAlpha er for deg mellom 13 og 19 år som vil henge, spise digg mat, se morsomme filmer og prate om de store spørsmålene uten fasitsvar og press. Oppstart 25. september kl 19:00!',
    iconName: 'Sparkles',
    time: 'Oppstart: Fredag 25. sept kl. 19:00',
    location: 'Lillesand',
    enabled: true,
    badge: 'Oppstart 25. sept',
  },
];

export const INITIAL_STATE: AppState = {
  event: {
    name: 'Lillesand United',
    date: 'Fredag 18. september 2026',
    time: '17:00 – 22:00 (Aktiviteter fra 18:45)',
    location: 'Møglestuhallen, Lillesand',
    organizers: ['KRIK', 'Den Norske Kirke', 'Filadelfia', 'Misjonskirken', 'Baptistkirken'],
    freePopcornLimit: 100,
    popcornClaimedCount: 0,
  },
  popcorn: INITIAL_POPCORN,
  activities: INITIAL_ACTIVITIES,
  tournament: {
    id: 'tour-lillesand-2026',
    status: 'registration',
    startedAt: null,
    completedAt: null,
    participants: [
      { id: 'p1', firstName: 'Oliver', registeredAt: '2026-09-18T17:02:00Z' },
      { id: 'p2', firstName: 'Emma', registeredAt: '2026-09-18T17:04:15Z' },
      { id: 'p3', firstName: 'Sander', registeredAt: '2026-09-18T17:05:30Z' },
      { id: 'p4', firstName: 'Thea', registeredAt: '2026-09-18T17:07:00Z' },
      { id: 'p5', firstName: 'Lukas', registeredAt: '2026-09-18T17:09:40Z' },
      { id: 'p6', firstName: 'Mathias', registeredAt: '2026-09-18T17:11:10Z' },
      { id: 'p7', firstName: 'Nora', registeredAt: '2026-09-18T17:12:50Z' },
      { id: 'p8', firstName: 'Jakob', registeredAt: '2026-09-18T17:14:20Z' },
    ],
    matches: [],
    winner: null,
    estimatedMinutesPerMatch: 10,
    bracketCapacity: 16,
  },
  alphaInterests: [
    { id: 'a1', firstName: 'Sofie', phone: '91234567', registeredAt: '2026-09-18T17:10:00Z' },
    { id: 'a2', firstName: 'Noah', registeredAt: '2026-09-18T17:15:30Z' },
    { id: 'a3', firstName: 'Amalie', phone: '48011223', registeredAt: '2026-09-18T17:18:00Z' },
  ],
  persons: [],
};

/** Tom runtime-tilstand for full database-nullstilling (beholder fast program/aktiviteter). */
export function createEmptyAppState(): AppState {
  return {
    event: {
      ...INITIAL_STATE.event,
      freePopcornLimit: INITIAL_POPCORN.totalCapacity,
      popcornClaimedCount: 0,
    },
    popcorn: JSON.parse(JSON.stringify(INITIAL_POPCORN)),
    activities: JSON.parse(JSON.stringify(INITIAL_ACTIVITIES)),
    tournament: {
      id: 'tour-lillesand-2026',
      status: 'registration',
      startedAt: null,
      completedAt: null,
      participants: [],
      matches: [],
      winner: null,
      estimatedMinutesPerMatch: 10,
      bracketCapacity: TOURNAMENT_DEFAULT_CAPACITY,
    },
    alphaInterests: [],
    persons: [],
  };
}

export const SIMULATION_NAMES_16 = [
  'Oliver', 'Emma', 'Sander', 'Thea', 'Lukas', 'Mathias', 'Nora', 'Jakob',
  'Leah', 'William', 'Sara', 'Filip', 'Emilie', 'Henrik', 'Maja', 'Aksel'
];

export const SIMULATION_NAMES_64 = [
  'Oliver', 'Emma', 'Sander', 'Thea', 'Lukas', 'Mathias', 'Nora', 'Jakob',
  'Leah', 'William', 'Sara', 'Filip', 'Emilie', 'Henrik', 'Maja', 'Aksel',
  'Ingrid', 'Tobias', 'Frida', 'Magnus', 'Hedda', 'Elias', 'Tuva', 'Sondre',
  'Aurora', 'Mikkel', 'Selma', 'Kasper', 'Mia', 'Oskar', 'Astrid', 'Jonas',
  'Ella', 'Noah', 'Sofie', 'Isak', 'Tiril', 'Adrian', 'Oda', 'Theodor',
  'Vilde', 'Johannes', 'Live', 'Herman', 'Linnea', 'Gustav', 'Amalie', 'Leo',
  'Julie', 'Felix', 'Signe', 'Victor', 'Helene', 'Sindre', 'Maria', 'Liam',
  'Klara', 'Vetle', 'Victoria', 'Jens', 'Sigrid', 'Benjamin', 'Anna', 'Markus'
];

export const SIMULATION_NAMES_31 = SIMULATION_NAMES_64.slice(0, 31);

/** Standard og maks cup-størrelser: 8, 16, 32, 64. */
export const TOURNAMENT_DEFAULT_CAPACITY = 16;
export const TOURNAMENT_CAPACITY_TIERS = [8, 16, 32, 64] as const;
export type BracketCapacity = (typeof TOURNAMENT_CAPACITY_TIERS)[number];
export const DRAW_BRACKET_SIZES = [4, 8, 16, 32, 64] as const;
export type DrawBracketCapacity = (typeof DRAW_BRACKET_SIZES)[number];
export const TOURNAMENT_MAX_PARTICIPANTS = 64;

/** Generer unike testnavn for simulering (2–64 spillere). */
export function generateSimulationNames(count: number): string[] {
  const n = Math.min(Math.max(Math.floor(count), 2), TOURNAMENT_MAX_PARTICIPANTS);
  const names: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i < SIMULATION_NAMES_64.length) {
      names.push(SIMULATION_NAMES_64[i]);
    } else {
      names.push(`Spiller ${i + 1}`);
    }
  }
  return names;
}
