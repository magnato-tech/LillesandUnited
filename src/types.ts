export interface Participant {
  id: string;
  firstName: string;
  registeredAt: string;
  userId?: string;
}

export type MatchStatus = 'not_ready' | 'ready' | 'in_progress' | 'completed' | 'walkover';

export interface Match {
  id: string;
  round: number; // 1, 2, 3 ... final
  roundName: string; // e.g. "Runde 1", "Kvartfinale", "Semifinale", "Finale"
  position: number; // 0, 1, 2...
  playerA: Participant | null;
  playerB: Participant | null;
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  tableNumber: 1 | 2 | null;
  status: MatchStatus;
  isWalkover: boolean;
  walkoverPlayerId?: string | null;
  nextMatchId: string | null;
  nextMatchSlot: 'A' | 'B' | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface Tournament {
  id: string;
  status: 'registration' | 'active' | 'completed';
  startedAt: string | null;
  completedAt: string | null;
  participants: Participant[];
  matches: Match[];
  winner: Participant | null;
  estimatedMinutesPerMatch: number; // default 10 min
}

export interface AlphaInterest {
  id: string;
  firstName: string;
  phone?: string;
  registeredAt: string;
  notes?: string;
  userId?: string;
}

export interface UserProfile {
  userId: string;
  firstName: string | null;
}

export interface UserActivityStatus {
  userId: string;
  firstName: string | null;
  tableTennis: {
    isRegistered: boolean;
    participant: Participant | null;
  };
  popcorn: {
    bong: PopcornBong | null;
  };
  alpha: {
    isInterested: boolean;
    interest: AlphaInterest | null;
  };
}

export interface Activity {
  id: string;
  name: string;
  shortDesc: string;
  fullDesc: string;
  iconName: string;
  time: string;
  location: string;
  enabled: boolean;
  badge?: string;
  highlight?: boolean;
}

export type BongStatus = 'blank' | 'activated' | 'used';

export interface PopcornBong {
  number: number;
  status: BongStatus;
  activatedAt?: string | null;
  usedAt?: string | null;
  clientToken?: string | null;
  userName?: string | null;
}

export interface PopcornData {
  totalCapacity: number;
  bongs: PopcornBong[];
}

export interface AppState {
  event: {
    name: string;
    date: string;
    time: string;
    location: string;
    organizers: string[];
    freePopcornLimit: number;
    popcornClaimedCount: number;
  };
  popcorn: PopcornData;
  activities: Activity[];
  tournament: Tournament;
  alphaInterests: AlphaInterest[];
}
