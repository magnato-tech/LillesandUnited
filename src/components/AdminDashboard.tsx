import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  Play,
  RotateCcw,
  Trophy,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Edit3,
  ToggleLeft,
  Target,
  Settings,
  UserCheck,
  Tv,
  Sparkles,
  Copy,
  Zap,
  Popcorn,
  Check,
  AlertCircle,
  Database,
  RefreshCw,
  X,
  User,
  UserPlus,
  UserMinus,
  ExternalLink,
} from 'lucide-react';
import { AppState, Match, PopcornBong, Person, Tournament } from '../types';
import {
  startTournament,
  submitMatchScore,
  correctMatchScore,
  resetMatchResult as resetMatchResultApi,
  assignMatchTable,
  resetTournament,
  simulateTournament,
  registerParticipant,
  createPerson,
  deletePerson,
  removeParticipant,
  toggleActivity,
  updateEvent,
  updateActivity,
  setAdminPin,
  verifyAdminPin,
  verifyResetPin,
  redeemPopcornBong,
  activatePopcornBong,
  addPopcornCapacity,
  resetPopcorn,
  updatePerson,
  resetAlpha,
  resetTestData,
  resetAllData,
  expandTournamentCapacity,
  getFirestoreStatus,
  syncFirestore,
} from '../services/api';
import {
  calculateTournamentStats,
  canDrawCup,
  resolveDrawCapacity,
  resolveBracketCapacity,
  tournamentHasCupData,
  hasPlayedDependencies,
  resolveMatchFormat,
} from '../lib/tournament';
import { TableTennisAdminPanel, ScoreEntryModal, ResetMatchConfirmModal } from './TableTennisAdminPanel';
import { BracketView } from './BracketView';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary' | 'success';
  requiresResetPin?: boolean;
  secondaryAction?: {
    label: string;
    onClick: (resetPin: string) => Promise<void> | void;
  };
  onConfirm: (resetPin: string) => Promise<void> | void;
}

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AdminDashboardProps {
  state: AppState;
  onRefresh: () => void;
  onOpenDisplay: () => void;
  onGoToProfile?: () => void;
  onOpenPersonProfile?: (person: Person) => void;
  initialTab?:
    | 'kiosk_popcorn'
    | 'matches'
    | 'event_participants'
    | 'tabletennis_participants'
    | 'activities'
    | 'alpha'
    | 'test';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  state,
  onRefresh,
  onOpenDisplay,
  onGoToProfile,
  onOpenPersonProfile,
  initialTab = 'kiosk_popcorn',
}) => {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [testTabUnlocked, setTestTabUnlocked] = useState(false);
  const [testTabUnlockPin, setTestTabUnlockPin] = useState('');
  const [testTabUnlockError, setTestTabUnlockError] = useState(false);

  // In-app confirm dialog & toast state (replacing window.confirm and window.alert for reliable iframe behavior)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [dialogResetPin, setDialogResetPin] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ id: Date.now(), message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Match score entry form state
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [simTournament, setSimTournament] = useState<Tournament | null>(null);
  const [scoreA, setScoreA] = useState<number>(21);
  const [scoreB, setScoreB] = useState<number>(18);
  const [actionError, setActionError] = useState<string | null>(null);
  const [correctionWarning, setCorrectionWarning] = useState<string | null>(null);
  const [resetMatchTarget, setResetMatchTarget] = useState<Match | null>(null);
  const [resetWarning, setResetWarning] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Popcorn kiosk state
  const [selectedBong, setSelectedBong] = useState<PopcornBong | null>(null);
  const [bongActionLoading, setBongActionLoading] = useState(false);
  const [bongActionError, setBongActionError] = useState<string | null>(null);

  // Manual participant add state
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newEventPersonName, setNewEventPersonName] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');
  const [eventParticipantSearch, setEventParticipantSearch] = useState('');

  // Selected participant for direct viewing and editing
  const [selectedPersonForEdit, setSelectedPersonForEdit] = useState<Person | null>(null);
  const [editingPersonName, setEditingPersonName] = useState('');
  const [personEditLoading, setPersonEditLoading] = useState(false);

  // Program & activity editing
  const [eventForm, setEventForm] = useState({
    name: state.event.name,
    date: state.event.date,
    time: state.event.time,
    location: state.event.location,
    organizers: state.event.organizers.join(', '),
  });
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState({
    name: '',
    shortDesc: '',
    fullDesc: '',
    time: '',
    location: '',
    badge: '',
  });
  const [programSaving, setProgramSaving] = useState(false);
  const [activitySaving, setActivitySaving] = useState(false);

  // Active section tab: Kiosk & Popcorn is prominent
  type AdminSectionTab = NonNullable<AdminDashboardProps['initialTab']>;

  const [adminTab, setAdminTabState] = useState<AdminSectionTab>(() => {
    if (typeof window === 'undefined') return initialTab;
    const saved = sessionStorage.getItem('lillesand_admin_section');
    const valid: AdminSectionTab[] = [
      'kiosk_popcorn',
      'matches',
      'event_participants',
      'tabletennis_participants',
      'activities',
      'alpha',
      'test',
    ];
    if (saved === 'participants') return 'tabletennis_participants';
    return saved && valid.includes(saved as AdminSectionTab)
      ? (saved as AdminSectionTab)
      : initialTab;
  });

  // Firestore status state
  const [firestoreStatus, setFirestoreStatus] = useState<{
    connected: boolean;
    projectId: string | null;
    firestoreDatabaseId: string | null;
    lastSyncTime: string | null;
    error: string | null;
    mode: string;
  } | null>(null);
  const [isSyncingFirestore, setIsSyncingFirestore] = useState(false);
  const [firestoreSyncMessage, setFirestoreSyncMessage] = useState<string | null>(null);

  const setAdminTab = (tab: typeof initialTab) => {
    sessionStorage.setItem('lillesand_admin_section', tab);
    setAdminTabState(tab);
  };

  const handleAdminTabSelect = (tab: typeof initialTab) => {
    if (tab === 'test' && !testTabUnlocked) {
      setTestTabUnlockPin('');
      setTestTabUnlockError(false);
      setAdminTab('test');
      return;
    }
    setAdminTab(tab);
  };

  const handleUnlockTestTab = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanPin = testTabUnlockPin.trim();
    if (!cleanPin) {
      setTestTabUnlockError(true);
      return;
    }

    try {
      const ok = await verifyResetPin(cleanPin);
      if (ok) {
        setTestTabUnlocked(true);
        setTestTabUnlockError(false);
        setTestTabUnlockPin('');
      } else {
        setTestTabUnlockError(true);
      }
    } catch {
      setTestTabUnlockError(true);
    }
  };

  const { tournament, activities, alphaInterests, popcorn } = state;
  const eventPersons = state.persons || [];
  const tableTennisCapacity = resolveBracketCapacity(
    tournament.participants.length,
    tournament.bracketCapacity ?? 16
  );
  const stats = calculateTournamentStats(tournament.matches, tournament.estimatedMinutesPerMatch);

  const prevInitialTab = useRef(initialTab);

  // Check existing session pin on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('lillesand_admin_pin');
    if (saved) {
      setAdminPin(saved);
      setIsAuthenticated(true);
    }
  }, []);

  // Synk kun når forelderen eksplisitt bytter initialTab (f.eks. fra bordtennis → admin)
  useEffect(() => {
    if (prevInitialTab.current !== initialTab) {
      setAdminTab(initialTab);
      prevInitialTab.current = initialTab;
    }
  }, [initialTab]);

  useEffect(() => {
    setEventForm({
      name: state.event.name,
      date: state.event.date,
      time: state.event.time,
      location: state.event.location,
      organizers: state.event.organizers.join(', '),
    });
  }, [state.event]);

  // Fetch Firestore Info
  const fetchFirestoreInfo = async () => {
    try {
      const info = await getFirestoreStatus();
      setFirestoreStatus(info);
    } catch (e) {}
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchFirestoreInfo();
    }
  }, [isAuthenticated, adminTab]);

  const handleSyncFirestore = async () => {
    setIsSyncingFirestore(true);
    setFirestoreSyncMessage(null);
    try {
      const res = await syncFirestore();
      setFirestoreSyncMessage(
        `Synkronisert: ${res.itemCounts.persons} personer, ${res.itemCounts.participants} deltakere, ${res.itemCounts.activities} aktiviteter.`
      );
      await fetchFirestoreInfo();
      onRefresh();
      showToast('Databasen er synkronisert til Google Firestore!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Feil under synkronisering til Firestore', 'error');
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  // Admin unlock (validated server-side)
  const handleUnlock = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanPin = pin.trim();
    if (!cleanPin) {
      setAuthError(true);
      return;
    }

    try {
      const ok = await verifyAdminPin(cleanPin);
      if (ok) {
        setAdminPin(cleanPin);
        setIsAuthenticated(true);
        setAuthError(false);
      } else {
        setAuthError(true);
      }
    } catch {
      setAuthError(true);
    }
  };

  const handleLock = () => {
    setIsAuthenticated(false);
    setTestTabUnlocked(false);
    setTestTabUnlockPin('');
    setPin('');
    setAdminPin('');
    sessionStorage.removeItem('lillesand_admin_pin');
  };

  // Popcorn Handlers
  const handleRedeemBong = async (bongNumber: number) => {
    setBongActionLoading(true);
    setBongActionError(null);
    try {
      await redeemPopcornBong(bongNumber);
      setSelectedBong(null);
      onRefresh();
      showToast(`Popcorn-bong #${bongNumber} markert som utlevert!`, 'success');
    } catch (err: any) {
      setBongActionError(err.message || 'Kunne ikke levere ut popcorn');
    } finally {
      setBongActionLoading(false);
    }
  };

  const handleAddCapacity = () => {
    const current = popcorn?.totalCapacity || 100;
    const nextTotal = current + 10;
    setConfirmDialog({
      isOpen: true,
      title: 'Åpne flere popcorn-bonger',
      message: `Vil du åpne 10 nye popcorn-bonger (#${current + 1}–#${nextTotal})? Totalt åpnet blir da ${nextTotal} bonger.`,
      confirmLabel: 'Åpne 10 nye',
      variant: 'primary',
      onConfirm: async () => {
        try {
          await addPopcornCapacity(10);
          onRefresh();
          showToast(`Åpnet 10 nye bonger (#${current + 1}–#${nextTotal})`, 'success');
        } catch (err: any) {
          showToast(err.message || 'Kunne ikke åpne nye bonger', 'error');
        }
      },
    });
  };

  const handleResetPopcorn = () => {
    setDialogResetPin('');
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Popcorn-bonger',
      message: 'Setter alle bonger tilbake til blank/nøytral, og nullstiller aktiveringer og hentet-statuser. Neste nummer blir igjen #1.',
      confirmLabel: 'Reset Popcorn',
      variant: 'warning',
      onConfirm: async () => {
        await resetPopcorn();
        setSelectedBong(null);
        onRefresh();
        showToast('Popcorn-bonger er nullstilt. Neste nummer er nå #1.', 'success');
      },
    });
  };

  const handleResetCup = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Nullstill cup',
      message:
        'Fjerner kamper, resultater og cup-tre. Påmeldte spillere beholdes, og turneringen settes tilbake til påmelding. Du kan deretter trekke cup på nytt i Bordtennis-fanen.',
      confirmLabel: 'Nullstill cup',
      variant: 'warning',
      onConfirm: async () => {
        await resetTournament(true);
        onRefresh();
        showToast('Cup er nullstilt. Påmeldte spillere er beholdt.', 'success');
      },
    });
  };

  const handleResetTournamentClear = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Nullstill turnering',
      message:
        'Fjerner alle påmeldte spillere, kamper og cup-tre. Turneringen settes tilbake til tom påmelding.',
      confirmLabel: 'Nullstill turnering',
      variant: 'danger',
      onConfirm: async () => {
        await resetTournament(false);
        onRefresh();
        showToast('Turneringen er nullstilt og deltakerlisten er tømt.', 'success');
      },
    });
  };

  const handleResetAlphaData = () => {
    setDialogResetPin('');
    setConfirmDialog({
      isOpen: true,
      title: 'Reset UngdomsAlpha',
      message: 'Fjerner alle testregistreringer og tømmer interesselisten for UngdomsAlpha.',
      confirmLabel: 'Reset Alpha',
      variant: 'warning',
      onConfirm: async () => {
        await resetAlpha();
        onRefresh();
        showToast('Interesselisten for UngdomsAlpha er tømt.', 'success');
      },
    });
  };

  const handleResetTestDataFull = () => {
    setDialogResetPin('');
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Alt Testdata',
      message: 'Nullstiller Popcorn, Bordtennis og Alpha i én operasjon. Rører aldri tidspunkter eller arrangementets faste program. Simulerte testpersoner fjernes automatisk.',
      confirmLabel: 'Reset Alt Testdata',
      variant: 'danger',
      onConfirm: async () => {
        await resetTestData();
        setSelectedBong(null);
        onRefresh();
        showToast('All testdata er nullstilt. Arrangementets program er bevart.', 'success');
      },
    });
  };

  const handleResetDatabase = () => {
    setDialogResetPin('');
    setConfirmDialog({
      isOpen: true,
      title: 'Nullstill database',
      message:
        'Sletter ALT runtime-data og setter applikasjonen tilbake til tom tilstand: alle personer, bordtennisdeltakere, kamper, popcorn, Alpha og annen testdata. Arrangementets faste program og aktivitetsoppsett beholdes.\n\nDenne handlingen kan ikke angres.',
      confirmLabel: 'Nullstill database',
      variant: 'danger',
      requiresResetPin: true,
      onConfirm: async (resetPin) => {
        if (!resetPin.trim()) {
          showToast('Nullstillings-PIN er påkrevd.', 'error');
          throw new Error('reset pin required');
        }
        await resetAllData(resetPin.trim());
        setSelectedBong(null);
        onRefresh();
        showToast('Databasen er nullstilt. Alle personer og testdata er slettet.', 'success');
      },
    });
  };

  const handleDrawCup = () => {
    if (!canDrawCup(tournament)) {
      if (tournamentHasCupData(tournament)) {
        showToast('Cup er allerede trukket. Nullstill cup i Test-fanen før ny trekning.', 'error');
      } else if (tournament.participants.length < 2) {
        showToast('Minst 2 deltakere kreves for å trekke cup.', 'error');
      }
      return;
    }

    const capacity = resolveDrawCapacity(
      tournament.participants.length,
      tournament.bracketCapacity
    );
    const walkovers = capacity - tournament.participants.length;
    const walkoverNote =
      walkovers > 0
        ? ` Cup-størrelse ${capacity} med ${walkovers} walkover${walkovers > 1 ? 's' : ''} i runde 1.`
        : ` Cup-størrelse ${capacity}.`;

    setConfirmDialog({
      isOpen: true,
      title: 'Trekk cup',
      message: `Steng påmelding og trekk cup for ${tournament.participants.length} spillere?${walkoverNote} Kampformat fra Innstillinger brukes på alle kamper.`,
      confirmLabel: 'Trekk cup',
      variant: 'primary',
      onConfirm: async () => {
        try {
          await startTournament();
          onRefresh();
          showToast(`Cup er trukket for ${tournament.participants.length} spillere!`, 'success');
        } catch (err: any) {
          showToast(err.message || 'Kunne ikke trekke cup', 'error');
        }
      },
    });
  };

  // Submit match score
  const handleSubmitScore = async (
    isWalkover = false,
    woSlot?: 'A' | 'B',
    sets?: { scoreA: number; scoreB: number }[],
    winnerSlot?: 'A' | 'B'
  ) => {
    if (!selectedMatchId) return;
    setActionError(null);
    setCorrectionWarning(null);

    try {
      await submitMatchScore(selectedMatchId, scoreA, scoreB, isWalkover, woSlot, sets, winnerSlot);
      setSelectedMatchId(null);
      onRefresh();
      showToast('Resultat lagret!', 'success');
    } catch (err: any) {
      setActionError(err.message || 'Kunne ikke lagre resultat.');
    }
  };

  // Correct match score
  const handleCorrectScore = async (
    forceConfirm = false,
    sets?: { scoreA: number; scoreB: number }[],
    winnerSlot?: 'A' | 'B'
  ) => {
    if (!selectedMatchId) return;
    setActionError(null);

    try {
      const res = await correctMatchScore(selectedMatchId, scoreA, scoreB, forceConfirm, sets, winnerSlot);
      if (res.requiresConfirmation && !forceConfirm) {
        setCorrectionWarning(res.warning || 'Advarsel om avhengigheter');
        return;
      }
      setSelectedMatchId(null);
      setCorrectionWarning(null);
      onRefresh();
      showToast('Resultat korrigert!', 'success');
    } catch (err: any) {
      setActionError(err.message || 'Kunne ikke korrigere.');
    }
  };

  // Assign table or change status
  const handleAssignTable = async (matchId: string, tableNumber: 1 | 2 | null, status?: string) => {
    try {
      await assignMatchTable(matchId, tableNumber, status);
      onRefresh();
      showToast(tableNumber ? `Bord ${tableNumber} tildelt kampen` : 'Bordtildeling fjernet', 'info');
    } catch (err: any) {
      showToast(err.message || 'Kunne ikke tildele bord', 'error');
    }
  };

  // Run test simulation
  const handleExpandCapacity = (capacity: 32 | 64) => {
    setConfirmDialog({
      isOpen: true,
      title: `Utvid cup-oppsett til ${capacity} plasser`,
      message: `Utvide cupen til ${capacity} spillere (${capacity / 2} kamper i runde 1)?`,
      confirmLabel: `Utvid til ${capacity}`,
      variant: 'primary',
      onConfirm: async () => {
        try {
          await expandTournamentCapacity(capacity);
          onRefresh();
          showToast(`Cup-kapasiteten er utvidet til ${capacity} plasser!`, 'success');
        } catch (err: any) {
          showToast(err.message || 'Kunne ikke utvide cup-størrelse', 'error');
        }
      },
    });
  };

  const handleSimulate = (count: number) => {
    setConfirmDialog({
      isOpen: true,
      title: `Simuler ${count} spillere`,
      message: `Generere en test-turnering med ${count} fiktive spillere og starte cupen direkte?`,
      confirmLabel: `Start ${count} spillere`,
      variant: 'primary',
      onConfirm: async () => {
        try {
          await simulateTournament(count);
          onRefresh();
          showToast(`Test-turnering med ${count} spillere generert og startet!`, 'success');
        } catch (err: any) {
          showToast(err.message || 'Kunne ikke generere test-turnering', 'error');
        }
      },
    });
  };

  // Add participant (creates person profile first, then registers for cup)
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    try {
      const { person } = await createPerson(newPlayerName.trim());
      await registerParticipant(person.firstName, undefined, person.id);
      setNewPlayerName('');
      onRefresh();
      showToast(`Spiller ${person.firstName} meldt på!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Kunne ikke melde på deltaker', 'error');
    }
  };

  // Add participant to EVENT ONLY (does not register for table tennis tournament)
  const handleAddEventPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventPersonName.trim()) return;
    try {
      const { person } = await createPerson(newEventPersonName.trim());
      setNewEventPersonName('');
      onRefresh();
      showToast(`${person.displayId || person.firstName} er lagt til som deltaker på arrangementet!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Kunne ikke opprette deltaker', 'error');
    }
  };

  // Open modal to view and edit participant directly
  const handleOpenPersonModal = (person: Person) => {
    setSelectedPersonForEdit(person);
    setEditingPersonName(person.firstName);
  };

  // Save participant name updates
  const handleSavePersonName = async () => {
    if (!selectedPersonForEdit || !editingPersonName.trim()) return;
    setPersonEditLoading(true);
    try {
      const res = await updatePerson(selectedPersonForEdit.id, { firstName: editingPersonName.trim() });
      onRefresh();
      setSelectedPersonForEdit(res.person);
      showToast(`Deltakernavn oppdatert til "${res.person.displayId}"`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Kunne ikke oppdatere deltakernavn', 'error');
    } finally {
      setPersonEditLoading(false);
    }
  };

  // Toggle table tennis registration directly for participant
  const handleToggleTournamentInModal = async (person: Person, isCurrentlyRegistered: boolean, participantId?: string) => {
    setPersonEditLoading(true);
    try {
      if (isCurrentlyRegistered && participantId) {
        await removeParticipant(participantId);
        onRefresh();
        showToast(`${person.displayId || person.firstName} er meldt av bordtennisturneringen.`, 'success');
      } else {
        if (state.tournament.status !== 'registration') {
          showToast('Turneringen er allerede i gang og kan ikke endres.', 'error');
          return;
        }
        await registerParticipant(person.firstName, undefined, person.id, person.anonymousToken);
        onRefresh();
        showToast(`${person.displayId || person.firstName} er meldt på bordtennisturneringen!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Kunne ikke endre bordtennispåmelding', 'error');
    } finally {
      setPersonEditLoading(false);
    }
  };

  // Redeem popcorn bong directly for participant
  const handleRedeemBongInModal = async (bongNumber: number) => {
    setPersonEditLoading(true);
    try {
      await redeemPopcornBong(bongNumber);
      onRefresh();
      showToast(`Popcorn-bong #${bongNumber} markert som utlevert!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Kunne ikke løse inn bong', 'error');
    } finally {
      setPersonEditLoading(false);
    }
  };

  // Activate free popcorn bong directly for participant
  const handleActivateBongInModal = async (person: Person) => {
    setPersonEditLoading(true);
    try {
      await activatePopcornBong(person.anonymousToken, person.displayId, person.id);
      onRefresh();
      showToast(`Gratis popcorn-bong aktivert for ${person.displayId || person.firstName}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Kunne ikke aktivere popcorn-bong', 'error');
    } finally {
      setPersonEditLoading(false);
    }
  };

  // Open participant's personal page directly
  const handleOpenPersonProfile = (person: Person) => {
    if (onOpenPersonProfile) {
      onOpenPersonProfile(person);
    } else if (onGoToProfile) {
      onGoToProfile();
    }
    showToast(`Åpnet Min side for ${person.displayId || person.firstName}.`, 'info');
  };

  // Delete person from event
  const handleDeletePerson = (person: Person) => {
    setConfirmDialog({
      isOpen: true,
      title: `Slett ${person.displayId || person.firstName}?`,
      message: `Er du sikker på at du vil slette ${person.displayId || person.firstName} fra arrangementet? Dette fjerner personen og eventuell påmelding i bordtennisturneringen.`,
      confirmLabel: 'Slett person',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deletePerson(person.id);
          if (selectedPersonForEdit?.id === person.id) {
            setSelectedPersonForEdit(null);
          }
          onRefresh();
          showToast(`${person.displayId || person.firstName} ble slettet fra arrangementet.`, 'success');
        } catch (err: any) {
          showToast(err.message || 'Kunne ikke slette person', 'error');
        }
      },
    });
  };

  const openScoreModal = (match: Match) => {
    setSelectedMatchId(match.id);
    const resolvedFormat = resolveMatchFormat(match, tournament.formatSettings);
    const target = resolvedFormat.targetPoints ?? 21;
    const margin = resolvedFormat.winMargin ?? 2;
    setScoreA(match.scoreA ?? target);
    setScoreB(match.scoreB ?? Math.max(0, target - (margin === 2 ? 3 : 2)));
    setActionError(null);
    setCorrectionWarning(null);
  };

  const openResetMatchModal = (match: Match) => {
    setResetMatchTarget(match);
    setResetError(null);
    setResetWarning(
      hasPlayedDependencies(match.id, tournament.matches)
        ? 'Senere kamper i turneringen har allerede resultat eller pågår. Nullstilling vil også tilbakestille disse kampene.'
        : null
    );
  };

  const closeResetMatchModal = () => {
    if (resetLoading) return;
    setResetMatchTarget(null);
    setResetWarning(null);
    setResetError(null);
  };

  const handleResetMatch = async (forceConfirm = false) => {
    if (!resetMatchTarget) return;
    setResetLoading(true);
    setResetError(null);

    try {
      const res = await resetMatchResultApi(resetMatchTarget.id, forceConfirm);
      if (res.requiresConfirmation && !forceConfirm) {
        setResetWarning(res.warning || 'Senere kamper vil også bli tilbakestilt.');
        setResetLoading(false);
        return;
      }
      if (resetMatchTarget.id === selectedMatchId) {
        setSelectedMatchId(null);
      }
      setResetMatchTarget(null);
      setResetWarning(null);
      setResetError(null);
      onRefresh();
      showToast('Kampresultat nullstilt', 'info');
    } catch (err: any) {
      setResetError(err.message || 'Kunne ikke nullstille resultat.');
    } finally {
      setResetLoading(false);
    }
  };

  // Remove participant
  const handleRemoveParticipant = async (id: string) => {
    try {
      await removeParticipant(id);
      onRefresh();
      showToast('Deltaker fjernet', 'info');
    } catch (err: any) {
      showToast(err.message || 'Kunne ikke fjerne deltaker', 'error');
    }
  };

  // Toggle activity
  const handleToggleActivity = async (id: string, currentEnabled: boolean) => {
    try {
      await toggleActivity(id, !currentEnabled);
      onRefresh();
      showToast(currentEnabled ? 'Aktivitet deaktivert' : 'Aktivitet aktivert', 'info');
    } catch (err: any) {
      showToast(err.message || 'Kunne ikke oppdatere aktivitet', 'error');
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setProgramSaving(true);
    try {
      await updateEvent({
        name: eventForm.name,
        date: eventForm.date,
        time: eventForm.time,
        location: eventForm.location,
        organizers: eventForm.organizers,
      });
      onRefresh();
      showToast('Arrangementsdetaljer lagret!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Kunne ikke lagre arrangement', 'error');
    } finally {
      setProgramSaving(false);
    }
  };

  const openActivityEditor = (act: AppState['activities'][number]) => {
    setEditingActivityId(act.id);
    setActivityForm({
      name: act.name,
      shortDesc: act.shortDesc,
      fullDesc: act.fullDesc,
      time: act.time,
      location: act.location,
      badge: act.badge || '',
    });
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivityId) return;
    setActivitySaving(true);
    try {
      await updateActivity(editingActivityId, activityForm);
      setEditingActivityId(null);
      onRefresh();
      showToast('Aktivitet lagret!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Kunne ikke oppdatere aktivitet', 'error');
    } finally {
      setActivitySaving(false);
    }
  };

  // Copy Alpha list to clipboard
  const handleCopyAlphaList = () => {
    const text = alphaInterests
      .map(
        (a, i) =>
          `${i + 1}. ${a.firstName} ${a.phone ? `(tlf: ${a.phone})` : ''} - registrert: ${new Date(
            a.registeredAt
          ).toLocaleTimeString('no-NO')}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    showToast('Alpha-interesselisten er kopiert til utklippstavlen!', 'success');
  };

  // ----------------------------------------------------
  // PIN LOCK SCREEN (Level B: Admin only)
  // ----------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-3xl bg-zinc-900 border-2 border-rose-500 shadow-artistic-md">
        <div className="w-14 h-14 rounded-2xl bg-rose-500 text-zinc-950 flex items-center justify-center mx-auto mb-4 shadow-artistic-sm -rotate-2">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white text-center uppercase tracking-tight mb-2">
          Arrangør / Admin
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 text-center mb-6 font-medium">
          Beskyttet tilgang for arrangører, kioskpersonell og turneringsledere.
        </p>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider mb-1.5">
              Skriv inn admin-PIN
            </label>
            <input
              type="password"
              placeholder="PIN-kode"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 text-center text-lg tracking-widest font-mono font-black shadow-artistic-sm"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-zinc-950 font-black text-sm uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            Lås opp adminpanel
          </button>

          {authError && (
            <p className="text-xs text-rose-400 text-center font-bold">
              Feil kode. Prøv igjen eller kontakt arrangør.
            </p>
          )}

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => handleUnlock()}
              className="text-xs font-bold text-zinc-500 hover:text-zinc-300 underline uppercase tracking-wider"
            >
              Hurtiginnlogging som arrangør
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ----------------------------------------------------
  // AUTHENTICATED ADMIN DASHBOARD
  // ----------------------------------------------------
  const selectedMatch = tournament.matches.find((m) => m.id === selectedMatchId);

  // Popcorn Statistics calculations
  const totalCapacity = popcorn?.totalCapacity || 100;
  const bongsList = popcorn?.bongs || [];
  const activatedBongs = bongsList.filter(
    (b) => (b.status === 'activated' || b.status === 'used') && b.number <= totalCapacity
  );
  const usedBongs = bongsList.filter((b) => b.status === 'used' && b.number <= totalCapacity);
  const uncollectedBongs = bongsList.filter(
    (b) => b.status === 'activated' && b.number <= totalCapacity
  );
  const nextAvailableBong = bongsList
    .filter((b) => b.status === 'blank' && b.number <= totalCapacity)
    .sort((a, b) => a.number - b.number)[0];

  type AdminNavItem = {
    id: AdminSectionTab;
    shortLabel: string;
    countLabel?: string;
    tooltip: string;
    icon: React.ComponentType<{ className?: string }>;
    activeClass: string;
  };

  const adminNavItems: AdminNavItem[] = [
    {
      id: 'event_participants',
      shortLabel: 'ARR',
      countLabel: String(eventPersons.length),
      tooltip: 'Deltakere arrangement — alle som har registrert navnet sitt i appen',
      icon: Users,
      activeClass: 'bg-sky-400 text-zinc-950 border-zinc-950 shadow-artistic-sm',
    },
    {
      id: 'tabletennis_participants',
      shortLabel: 'BT',
      countLabel: `${tournament.participants.length}/${tableTennisCapacity}`,
      tooltip: 'Deltakere bordtennis — påmeldte spillere i turneringen',
      icon: UserCheck,
      activeClass: 'bg-lime-400 text-zinc-950 border-zinc-950 shadow-artistic-sm',
    },
    {
      id: 'matches',
      shortLabel: 'KAMP',
      countLabel: String(tournament.matches.length),
      tooltip:
        tournament.matches.length === 0 && tournament.status === 'registration'
          ? 'Ingen cup-tre ennå — trekkes under Innstillinger i Bordtennis-fanen'
          : 'Bordtenniskamper — totalt antall kamper i cup-tre, resultater og bordtildeling',
      icon: Trophy,
      activeClass: 'bg-lime-400 text-zinc-950 border-zinc-950 shadow-artistic-sm',
    },
    {
      id: 'activities',
      shortLabel: 'AKT',
      tooltip: 'Aktiviteter — program, aktiviteter og arrangementsdetaljer',
      icon: Target,
      activeClass: 'bg-lime-400 text-zinc-950 border-zinc-950 shadow-artistic-sm',
    },
    {
      id: 'kiosk_popcorn',
      shortLabel: 'KIOSK',
      countLabel: `${usedBongs.length}/${totalCapacity}`,
      tooltip: 'Kiosk & popcorn — bongkart, utlevering og kapasitet',
      icon: Popcorn,
      activeClass: 'bg-amber-400 text-zinc-950 border-zinc-950 shadow-artistic-sm',
    },
    {
      id: 'alpha',
      shortLabel: 'ALPHA',
      countLabel: String(alphaInterests.length),
      tooltip: 'Alpha-interesser — registrerte interesser for UngdomsAlpha',
      icon: Sparkles,
      activeClass: 'bg-sky-400 text-zinc-950 border-zinc-950 shadow-artistic-sm',
    },
    {
      id: 'test',
      shortLabel: 'TEST',
      tooltip: 'Test & Reset — testidentitet, nullstilling og simulering (krever PIN for å åpne fanen)',
      icon: Settings,
      activeClass: 'bg-rose-500 text-zinc-950 border-zinc-950 shadow-artistic-sm',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
      {/* Top Admin Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b-2 border-zinc-800 pb-5 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-500 text-zinc-950 text-xs font-black uppercase tracking-wider mb-2 shadow-artistic-sm -rotate-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Lillesand United Arrangør- & Kioskpanel
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Administrasjon
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenDisplay}
            className="px-4 py-2.5 rounded-2xl bg-purple-500 hover:bg-purple-400 text-zinc-950 text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            <Tv className="w-4 h-4" />
            Åpne Storskjerm
          </button>

          <button
            onClick={handleLock}
            className="px-4 py-2.5 rounded-2xl bg-zinc-900 border-2 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs font-black uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            Lås panel
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2 border-b-2 border-zinc-800 pb-3 mb-6">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = adminTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleAdminTabSelect(item.id)}
              title={item.tooltip}
              aria-label={item.tooltip}
              className={`px-2 sm:px-2.5 py-2.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wide flex items-center justify-center gap-1.5 border-2 transition-all min-w-0 ${
                isActive
                  ? item.activeClass
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">
                {item.shortLabel}
                {item.countLabel ? (
                  <span className="font-mono tabular-nums"> {item.countLabel}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* ==================================================== */}
      {/* 5. ADMIN: KIOSK & POPCORN (Section 5–10)               */}
      {/* ==================================================== */}
      {adminTab === 'kiosk_popcorn' && (
        <div className="space-y-6">
          {/* Popcorn Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block">
                Bonger åpnet
              </span>
              <strong className="text-2xl sm:text-3xl font-black text-white font-mono">
                {totalCapacity}
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block">
                Aktivert
              </span>
              <strong className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                {activatedBongs.length}
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block">
                Hentet
              </span>
              <strong className="text-2xl sm:text-3xl font-black text-rose-400 font-mono">
                {usedBongs.length}
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block">
                Ikke hentet
              </span>
              <strong className="text-2xl sm:text-3xl font-black text-lime-400 font-mono">
                {uncollectedBongs.length}
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm col-span-2 sm:col-span-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block">
                Neste bongnr
              </span>
              <strong className="text-2xl sm:text-3xl font-black text-sky-400 font-mono">
                {nextAvailableBong ? `#${nextAvailableBong.number}` : 'Utsolgt'}
              </strong>
            </div>
          </div>

          {/* Quick Actions & Instruction */}
          <div className="p-5 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Popcorn className="w-5 h-5 text-amber-400" />
                Bongkart Kiosk (Ingen QR – Trykk på bongnummer)
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5 font-medium">
                Ungdommen sier: «Jeg har bong nummer 47.» Trykk på nummeret under for å levere ut.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleAddCapacity}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                +10 Bonger
              </button>

              <button
                onClick={handleResetPopcorn}
                className="px-3.5 py-2.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 hover:border-rose-500 text-zinc-400 hover:text-rose-400 text-xs font-black uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
                title="Slett popcorn-testdata"
              >
                Reset Popcorn
              </button>
            </div>
          </div>

          {/* Color Legend (Section 6 requirement) */}
          <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-xs shadow-artistic-sm font-bold">
            <span className="text-zinc-400 uppercase tracking-wider text-[10px] font-black">
              Fargekoder:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-zinc-900 border border-zinc-700" />
              <span className="text-zinc-400">Blank / Nøytral: Ikke aktivert</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-lime-400 border border-lime-300" />
              <span className="text-lime-300">Grønn: Aktivert / Kan hentes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-rose-600 border border-rose-400" />
              <span className="text-rose-300">Rød: Allerede hentet</span>
            </div>
          </div>

          {/* Bongkart Grid: 5 columns x rows (Section 6 requirement) */}
          <div className="p-4 sm:p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm">
            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {bongsList
                .filter((b) => b.number <= totalCapacity)
                .sort((a, b) => a.number - b.number)
                .map((bong) => {
                  let buttonStyle =
                    'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700';
                  let statusBadge = 'Ledig';

                  if (bong.status === 'activated') {
                    buttonStyle =
                      'bg-lime-400 border-zinc-950 text-zinc-950 shadow-artistic-sm ring-2 ring-lime-400/40 hover:bg-lime-300';
                    statusBadge = 'Klar!';
                  } else if (bong.status === 'used') {
                    buttonStyle =
                      'bg-rose-600 border-zinc-950 text-white shadow-artistic-sm hover:bg-rose-500';
                    statusBadge = 'Hentet';
                  }

                  const person = bong.personId ? (state.persons || []).find((p) => p.id === bong.personId) : null;
                  const displayName = person?.displayId || bong.userName;

                  return (
                    <button
                      key={bong.number}
                      id={`admin-bong-${bong.number}`}
                      onClick={() => {
                        setSelectedBong(bong);
                        setBongActionError(null);
                      }}
                      className={`h-14 sm:h-16 rounded-2xl border-2 flex flex-col items-center justify-center p-1 transition-all active:scale-95 cursor-pointer ${buttonStyle}`}
                    >
                      <span className="text-base sm:text-xl font-black tracking-tight font-mono">
                        #{bong.number}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider truncate max-w-full px-0.5">
                        {displayName ? `${displayName}` : statusBadge}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB: BORDTENNIS CUP ADMIN ---------------- */}
      {adminTab === 'matches' && (
        <div className="space-y-6">
          <TableTennisAdminPanel
            tournament={tournament}
            persons={eventPersons}
            onRefresh={onRefresh}
            onDrawCup={handleDrawCup}
            onAssignTable={handleAssignTable}
            onOpenScoreModal={openScoreModal}
            onRequestResetMatch={openResetMatchModal}
            onExpandCapacity={handleExpandCapacity}
            onSimTournamentChange={setSimTournament}
          />

          {(simTournament ?? tournament).matches.length > 0 && (
            <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-lime-400 block">
                  Cup-tre
                </span>
                <h3 className="text-lg font-black text-white uppercase">Kampoppsett</h3>
                <p className="text-xs text-zinc-400 font-medium">
                  Vinneren i hver kamp går videre til neste runde
                </p>
              </div>
              <BracketView
                matches={(simTournament ?? tournament).matches}
                winner={(simTournament ?? tournament).winner}
                myPlayerName={null}
              />
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB: DELTAKERE ARRANGEMENT ---------------- */}
      {adminTab === 'event_participants' && (
        <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-6">
          <div>
            <h3 className="text-base font-black text-white uppercase">
              Registrerte personer på arrangementet ({eventPersons.length})
            </h3>
            <p className="text-xs text-zinc-400 font-medium">
              Alle som deltar på arrangementet. Her kan du opprette nye deltakere direkte uten bordtennis, eller åpne en deltakers side for å teste, endre eller melde av bordtennis.
            </p>
          </div>

          {/* Add person directly to event form */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
            <div className="text-xs">
              <span className="font-black text-white uppercase tracking-wider block">Legg til deltaker (Arrangement)</span>
              <span className="text-zinc-400">Registreres for arrangementet uten automatisk bordtennispåmelding.</span>
            </div>
            <form onSubmit={handleAddEventPerson} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Fornavn på ny deltaker"
                value={newEventPersonName}
                onChange={(e) => setNewEventPersonName(e.target.value)}
                className="px-3.5 py-2.5 rounded-2xl bg-zinc-900 border-2 border-zinc-800 text-white text-xs font-bold focus:outline-none focus:border-sky-400 shadow-artistic-sm min-w-[200px]"
              />
              <button
                type="submit"
                disabled={!newEventPersonName.trim()}
                className="px-4 py-2.5 rounded-2xl bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-artistic-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                <span>Legg til</span>
              </button>
            </form>
          </div>

          <input
            type="search"
            placeholder="Søk person (displayId eller navn)..."
            value={eventParticipantSearch}
            onChange={(e) => setEventParticipantSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white text-xs font-bold focus:outline-none focus:border-sky-400 shadow-artistic-sm"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 max-h-[540px] overflow-y-auto pr-1">
            {eventPersons
              .filter((p) => {
                const q = eventParticipantSearch.trim().toLowerCase();
                if (!q) return true;
                const label = (p.displayId || p.firstName).toLowerCase();
                return label.includes(q) || p.firstName.toLowerCase().includes(q);
              })
              .map((p, idx) => {
                const ttParticipant = (tournament.participants || []).find(
                  (part) => part.personId === p.id || (p.displayId && part.firstName === p.displayId)
                );
                const bong = (popcorn.claimedBongs || []).find(
                  (b) =>
                    (p.anonymousToken && b.clientToken === p.anonymousToken) ||
                    (b.userName && (b.userName === p.displayId || b.userName === p.firstName))
                );
                const alpha = (alphaInterests || []).find(
                  (a) =>
                    (p.anonymousToken && a.clientToken === p.anonymousToken) ||
                    (a.name && (a.name === p.displayId || a.name === p.firstName))
                );

                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 hover:border-zinc-700 shadow-artistic-sm flex flex-col justify-between gap-3 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-black text-zinc-500 uppercase">#{idx + 1}</span>
                        <span className="text-[10px] text-zinc-500 font-mono ml-auto">
                          {new Date(p.createdAt).toLocaleString('no-NO', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <strong className="text-base font-black text-white block truncate">
                        {p.displayId || p.firstName}
                      </strong>
                      {p.displayId && p.displayId !== p.firstName && (
                        <span className="text-xs text-zinc-400 font-medium block">{p.firstName}</span>
                      )}

                      {/* Status Badges */}
                      <div className="mt-3 pt-3 border-t border-zinc-900 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-zinc-500" /> Bordtennis:
                          </span>
                          {ttParticipant ? (
                            <span className="font-bold text-lime-400">Påmeldt (#{ttParticipant.seed})</span>
                          ) : (
                            <span className="text-zinc-500 font-medium">Ikke påmeldt</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 flex items-center gap-1">
                            <Popcorn className="w-3 h-3 text-zinc-500" /> Popcorn:
                          </span>
                          {bong ? (
                            <span className="font-bold text-amber-300">
                              Bong #{bong.bongNumber} {bong.status === 'used' ? '✓' : '(aktiv)'}
                            </span>
                          ) : (
                            <span className="text-zinc-500 font-medium">Ingen bong</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-zinc-500" /> Alpha:
                          </span>
                          {alpha ? (
                            <span className="font-bold text-purple-400">Interessert</span>
                          ) : (
                            <span className="text-zinc-500 font-medium">-</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-zinc-900 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenPersonModal(p)}
                        className="flex-1 px-3 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 border border-sky-500/30 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-artistic-sm cursor-pointer"
                        title="Se og rediger deltakerens informasjon"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Se / Rediger</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenPersonProfile(p)}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer"
                        title="Åpne Min side for denne deltakeren"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePerson(p)}
                        className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950 text-zinc-500 hover:text-rose-400 border border-zinc-800 hover:border-rose-800 transition-all cursor-pointer"
                        title="Slett person fra arrangementet"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {eventPersons.length === 0 && (
            <div className="p-8 text-center text-xs font-bold text-zinc-500">
              Ingen har registrert seg i appen ennå.
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB: DELTAKERE BORDTENNIS ---------------- */}
      {adminTab === 'tabletennis_participants' && (
        <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white uppercase">
                Påmeldte bordtennisspillere ({tournament.participants.length} / {tableTennisCapacity})
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                Legg til eller fjern spillere i bordtennisturneringen før trekning
              </p>
            </div>

            <form onSubmit={handleAddParticipant} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Fornavn på ny spiller"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                className="px-3.5 py-2.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white text-xs font-bold focus:outline-none focus:border-lime-400 shadow-artistic-sm"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-2xl bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-black uppercase tracking-wider flex items-center gap-1 shrink-0 shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5"
              >
                <Plus className="w-4 h-4" />
                Legg til
              </button>
            </form>
          </div>

          <input
            type="search"
            placeholder="Søk bordtennisspiller (displayId eller navn)..."
            value={participantSearch}
            onChange={(e) => setParticipantSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white text-xs font-bold focus:outline-none focus:border-lime-400 shadow-artistic-sm"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 max-h-[480px] overflow-y-auto pr-1">
            {tournament.participants
              .filter((p) => {
                const q = participantSearch.trim().toLowerCase();
                if (!q) return true;
                const label = (p.displayId || p.firstName).toLowerCase();
                return label.includes(q) || p.firstName.toLowerCase().includes(q);
              })
              .map((p, idx) => (
              <div
                key={p.id}
                className="p-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between shadow-artistic-sm"
              >
                <div>
                  <span className="text-[10px] font-black text-zinc-500 block uppercase">#{idx + 1}</span>
                  <strong className="text-sm font-black text-white">{p.displayId || p.firstName}</strong>
                </div>

                <button
                  onClick={() => handleRemoveParticipant(p.id)}
                  className="p-2 text-zinc-500 hover:text-rose-400 transition-colors rounded-lg"
                  title="Fjern spiller"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {tournament.participants.length === 0 && (
            <div className="p-8 text-center text-xs font-bold text-zinc-500">
              Ingen er påmeldt bordtennisturneringen.
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB: ACTIVITIES ---------------- */}
      {adminTab === 'activities' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveEvent}
            className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-4"
          >
            <div>
              <h3 className="text-base font-black text-white uppercase">Program / Arrangement</h3>
              <p className="text-xs text-zinc-400 font-medium">
                Rediger grunnleggende arrangementsinfo. Endringer lagres i databasen.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Navn</span>
                <input
                  value={eventForm.name}
                  onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border-2 border-zinc-800 text-white text-sm font-medium"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Dato</span>
                <input
                  value={eventForm.date}
                  onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border-2 border-zinc-800 text-white text-sm font-medium"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Tid</span>
                <input
                  value={eventForm.time}
                  onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border-2 border-zinc-800 text-white text-sm font-medium"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Sted</span>
                <input
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border-2 border-zinc-800 text-white text-sm font-medium"
                />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Arrangører (kommaseparert)</span>
                <input
                  value={eventForm.organizers}
                  onChange={(e) => setEventForm({ ...eventForm, organizers: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border-2 border-zinc-800 text-white text-sm font-medium"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={programSaving}
              className="px-4 py-2.5 rounded-2xl bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm"
            >
              {programSaving ? 'Lagrer...' : 'Lagre program'}
            </button>
          </form>

          <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-4">
            <div>
              <h3 className="text-base font-black text-white uppercase">
                Aktiviteter
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                Aktiver/deaktiver aktiviteter og rediger tekst, tid og sted
              </p>
            </div>

            <div className="space-y-3">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-artistic-sm space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-black text-white text-sm">{act.name}</h4>
                      <p className="text-xs text-zinc-400 font-medium">{act.time}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          editingActivityId === act.id
                            ? setEditingActivityId(null)
                            : openActivityEditor(act)
                        }
                        className="p-2 rounded-xl bg-zinc-900 border-2 border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        title="Rediger aktivitet"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActivity(act.id, act.enabled)}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 ${
                          act.enabled
                            ? 'bg-lime-400 text-zinc-950'
                            : 'bg-zinc-900 text-zinc-500 border-2 border-zinc-800 hover:text-zinc-300'
                        }`}
                      >
                        {act.enabled ? 'Aktiv' : 'Deaktivert'}
                      </button>
                    </div>
                  </div>

                  {editingActivityId === act.id && (
                    <form onSubmit={handleSaveActivity} className="space-y-3 pt-3 border-t-2 border-zinc-800">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block space-y-1 sm:col-span-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Navn</span>
                          <input
                            value={activityForm.name}
                            onChange={(e) => setActivityForm({ ...activityForm, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border-2 border-zinc-800 text-white text-sm"
                          />
                        </label>
                        <label className="block space-y-1 sm:col-span-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Kort beskrivelse</span>
                          <input
                            value={activityForm.shortDesc}
                            onChange={(e) => setActivityForm({ ...activityForm, shortDesc: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border-2 border-zinc-800 text-white text-sm"
                          />
                        </label>
                        <label className="block space-y-1 sm:col-span-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Full beskrivelse</span>
                          <textarea
                            value={activityForm.fullDesc}
                            onChange={(e) => setActivityForm({ ...activityForm, fullDesc: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border-2 border-zinc-800 text-white text-sm resize-y"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Tid</span>
                          <input
                            value={activityForm.time}
                            onChange={(e) => setActivityForm({ ...activityForm, time: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border-2 border-zinc-800 text-white text-sm"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Sted</span>
                          <input
                            value={activityForm.location}
                            onChange={(e) => setActivityForm({ ...activityForm, location: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border-2 border-zinc-800 text-white text-sm"
                          />
                        </label>
                        <label className="block space-y-1 sm:col-span-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Badge</span>
                          <input
                            value={activityForm.badge}
                            onChange={(e) => setActivityForm({ ...activityForm, badge: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border-2 border-zinc-800 text-white text-sm"
                          />
                        </label>
                      </div>
                      <button
                        type="submit"
                        disabled={activitySaving}
                        className="px-4 py-2.5 rounded-2xl bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-zinc-950 text-xs font-black uppercase tracking-wider"
                      >
                        {activitySaving ? 'Lagrer...' : 'Lagre aktivitet'}
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB: ALPHA INTERESTS ---------------- */}
      {adminTab === 'alpha' && (
        <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-white uppercase flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                Interesserte i UngdomsAlpha ({alphaInterests.length})
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                Oppstart: Fredag 25. september kl. 19:00
              </p>
            </div>

            <button
              onClick={handleCopyAlphaList}
              disabled={alphaInterests.length === 0}
              className="px-4 py-2.5 rounded-2xl bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-zinc-950 text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <Copy className="w-4 h-4" />
              Kopier liste
            </button>
          </div>

          <div className="space-y-3">
            {alphaInterests.map((item, idx) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between text-xs shadow-artistic-sm"
              >
                <div>
                  <strong className="text-white text-sm font-black block">
                    {idx + 1}. {item.firstName}
                  </strong>
                  <span className="text-zinc-400 font-medium">
                    {item.phone ? `Tlf: ${item.phone}` : 'Uten telefonnummer'}
                  </span>
                </div>
                <span className="text-zinc-500 text-[11px] font-mono">
                  {new Date(item.registeredAt).toLocaleTimeString('no-NO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}

            {alphaInterests.length === 0 && (
              <div className="p-8 text-center text-xs font-bold text-zinc-500">
                Ingen har registrert interesse for UngdomsAlpha enda.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- TAB: TEST & RESET (Section 11–15) ---------------- */}
      {adminTab === 'test' && !testTabUnlocked && (
        <div className="max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-zinc-900 border-2 border-rose-500 shadow-artistic-md">
          <div className="w-14 h-14 rounded-2xl bg-rose-500 text-zinc-950 flex items-center justify-center mx-auto mb-4 shadow-artistic-sm -rotate-2">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white text-center uppercase tracking-tight mb-2">
            Test & Reset
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 text-center mb-6 font-medium">
            Denne fanen krever nullstillings-PIN for å åpnes.
          </p>

          <form onSubmit={handleUnlockTestTab} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider mb-1.5">
                Nullstillings-PIN
              </label>
              <input
                type="password"
                placeholder="PIN-kode"
                value={testTabUnlockPin}
                onChange={(e) => setTestTabUnlockPin(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 text-center text-lg tracking-widest font-mono font-black shadow-artistic-sm"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-zinc-950 font-black text-sm uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              Lås opp Test & Reset
            </button>

            {testTabUnlockError && (
              <p className="text-xs text-rose-400 text-center font-bold">
                Feil nullstillings-PIN. Prøv igjen.
              </p>
            )}
          </form>
        </div>
      )}

      {adminTab === 'test' && testTabUnlocked && (
        <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-6">
          <div>
            <h3 className="text-base font-black text-white uppercase flex items-center gap-2">
              <Zap className="w-5 h-5 text-rose-400" />
              Test- og Reset-funksjoner (Lillesand United Pilot)
            </h3>
            <p className="text-xs text-zinc-400 font-medium mt-1">
              Test appen grundig mange ganger før arrangementet 18. september. Ingen reset-knapper rører arrangementets faste informasjon.
            </p>
          </div>

          {/* Reset Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. RESET POPCORN */}
            <div className="p-5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex flex-col justify-between shadow-artistic-sm">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block mb-1">
                  Kiosk / Popcorn
                </span>
                <h4 className="font-black text-white text-base mb-1">Reset Popcorn</h4>
                <p className="text-xs text-zinc-400 mb-4 font-medium">
                  Setter alle bonger tilbake til blank/nøytral, nullstiller aktiveringer og hentet-statuser. Neste nummer blir igjen #1.
                </p>
              </div>
              <button
                id="admin-reset-popcorn-btn"
                onClick={handleResetPopcorn}
                className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                Reset Popcorn
              </button>
            </div>

            {/* 2. NULLSTILL CUP */}
            <div className="p-5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex flex-col justify-between shadow-artistic-sm">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-lime-400 block mb-1">
                  Bordtennis
                </span>
                <h4 className="font-black text-white text-base mb-1">Nullstill cup</h4>
                <p className="text-xs text-zinc-400 mb-4 font-medium">
                  Fjerner kamper, resultater og cup-tre. Beholder påmeldte spillere slik at du kan trekke cup på nytt i Bordtennis-fanen.
                </p>
              </div>
              <button
                id="admin-reset-cup-btn"
                onClick={handleResetCup}
                className="w-full py-3 rounded-2xl bg-zinc-900 border-2 border-lime-400/50 hover:border-lime-400 text-lime-300 text-xs font-black uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                Nullstill cup
              </button>
            </div>

            {/* 3. NULLSTILL TURNERING */}
            <div className="p-5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex flex-col justify-between shadow-artistic-sm">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-lime-400 block mb-1">
                  Bordtennis
                </span>
                <h4 className="font-black text-white text-base mb-1">Nullstill turnering</h4>
                <p className="text-xs text-zinc-400 mb-4 font-medium">
                  Fjerner alle påmeldte spillere, kamper og cup-tre. Setter turneringen tilbake til tom påmelding.
                </p>
              </div>
              <button
                id="admin-reset-tournament-btn"
                onClick={handleResetTournamentClear}
                className="w-full py-3 rounded-2xl bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                Nullstill turnering
              </button>
            </div>

            {/* 4. RESET ALPHA */}
            <div className="p-5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex flex-col justify-between shadow-artistic-sm">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block mb-1">
                  UngdomsAlpha
                </span>
                <h4 className="font-black text-white text-base mb-1">Reset Alpha</h4>
                <p className="text-xs text-zinc-400 mb-4 font-medium">
                  Fjerner alle testregistreringer og tømmer interesselisten for UngdomsAlpha.
                </p>
              </div>
              <button
                id="admin-reset-alpha-btn"
                onClick={handleResetAlphaData}
                className="w-full py-3 rounded-2xl bg-sky-400 hover:bg-sky-300 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                Reset Alpha
              </button>
            </div>

            {/* 5. RESET HELE TESTDATA */}
            <div className="p-5 rounded-2xl bg-zinc-950 border-2 border-rose-500/50 flex flex-col justify-between shadow-artistic-sm col-span-1 sm:col-span-2 lg:col-span-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 block mb-1">
                  Total Nullstilling
                </span>
                <h4 className="font-black text-white text-base mb-1">Reset Testdata (Alt)</h4>
                <p className="text-xs text-zinc-400 mb-4 font-medium">
                  Nullstiller Popcorn, Bordtennis og Alpha i én operasjon. Rører aldri tidspunkter eller arrangementets faste program. Sletter ikke opprettede profiler – kun simulerte testpersoner fjernes automatisk.
                </p>
              </div>
              <button
                id="admin-reset-all-testdata-btn"
                onClick={handleResetTestDataFull}
                className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                Reset Alt Testdata
              </button>
            </div>
          </div>

          {/* Firestore Cloud Database Status & Sync */}
          <div className="pt-4 border-t-2 border-zinc-800">
            <div className="p-5 rounded-2xl bg-zinc-950 border-2 border-emerald-500/40 shadow-artistic-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-white text-base">Firestore Database</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        Aktiv
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 font-medium mt-0.5">
                      Alle endringer i turnering, popcorn, profiler og aktiviteter synkroniseres til Google Cloud Firestore.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                  <button
                    id="admin-reset-database-btn"
                    type="button"
                    onClick={handleResetDatabase}
                    className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <Database className="w-3.5 h-3.5" />
                    Nullstill database
                  </button>

                  <button
                    id="admin-sync-firestore-btn"
                    onClick={handleSyncFirestore}
                    disabled={isSyncingFirestore}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFirestore ? 'animate-spin' : ''}`} />
                    <span>{isSyncingFirestore ? 'Synkroniserer...' : 'Synkroniser nå'}</span>
                  </button>
                </div>
              </div>

              {firestoreSyncMessage && (
                <div className="mb-3 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 font-medium">
                  {firestoreSyncMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Prosjekt</span>
                  <span className="font-mono text-zinc-300 truncate block">
                    {firestoreStatus?.projectId || 'gen-lang-client-0041387233'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Database-ID</span>
                  <span className="font-mono text-zinc-300 truncate block">
                    {firestoreStatus?.firestoreDatabaseId || 'ai-studio-lillesandunited-...'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Sist synkronisert</span>
                  <span className="text-zinc-300 font-medium block">
                    {firestoreStatus?.lastSyncTime
                      ? new Date(firestoreStatus.lastSyncTime).toLocaleTimeString('nb-NO', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : 'Oppstart'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tournament Simulations */}
          <div className="pt-4 border-t-2 border-zinc-800">
            <h4 className="font-black text-white text-sm uppercase mb-3">
              Kjappe simuleringer for turneringsledere:
            </h4>
            <p className="text-xs text-zinc-500 font-medium mb-4">
              Testflyt: Velg cup-størrelse → gå til Bordtennis Kamper → tildel bord → registrer
              resultater.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between shadow-artistic-sm">
                <div>
                  <strong className="text-white text-sm font-black block">Simuler 16 spillere</strong>
                  <span className="text-xs text-zinc-400 font-medium">8 kamper runde 1 · standard</span>
                </div>
                <button
                  onClick={() => handleSimulate(16)}
                  className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm"
                >
                  Start 16
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between shadow-artistic-sm">
                <div>
                  <strong className="text-white text-sm font-black block">Simuler 32 spillere</strong>
                  <span className="text-xs text-zinc-400 font-medium">16 kamper runde 1</span>
                </div>
                <button
                  onClick={() => handleSimulate(32)}
                  className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm"
                >
                  Start 32
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-lime-400/30 flex items-center justify-between shadow-artistic-sm">
                <div>
                  <strong className="text-white text-sm font-black block">Simuler 64 spillere</strong>
                  <span className="text-xs text-zinc-400 font-medium">32 kamper runde 1 · maks</span>
                </div>
                <button
                  onClick={() => handleSimulate(64)}
                  className="px-4 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm"
                >
                  Start 64
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ==================================================== */}
      {/* POPCORN REDEMPTION / WARNING MODAL (Sections 7 & 8)  */}
      {/* ==================================================== */}
      {selectedBong && (
        <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-zinc-900 border-2 border-zinc-700 p-6 sm:p-8 shadow-artistic-md">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                Kiosk • Bongdetaljer
              </span>
              <button
                onClick={() => setSelectedBong(null)}
                className="text-zinc-400 hover:text-white text-xl font-black"
              >
                ✕
              </button>
            </div>

            {/* CASE 1: GRØNN BONG (AKTIVERT - KLAR TIL UTLEVERING) */}
            {selectedBong.status === 'activated' && (() => {
              const person = selectedBong.personId
                ? (state.persons || []).find((p) => p.id === selectedBong.personId)
                : null;
              const displayName = person?.displayId || selectedBong.userName;

              return (
                <div>
                  <div className="w-16 h-16 rounded-2xl bg-lime-400 text-zinc-950 flex items-center justify-center mx-auto mb-4 shadow-artistic-sm -rotate-2">
                    <Popcorn className="w-8 h-8" />
                  </div>

                  <div className="text-center mb-6">
                    <span className="text-xs font-black uppercase tracking-wider text-lime-400 block mb-1">
                      Klar til utlevering
                    </span>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tight font-mono">
                      BONG #{selectedBong.number}
                    </h2>
                    {displayName && (
                      <span className="inline-block mt-1 px-3 py-0.5 bg-lime-400 text-zinc-950 rounded-full font-black text-xs uppercase tracking-wider">
                        Tilhører: {displayName}
                      </span>
                    )}
                    <p className="text-xs text-zinc-300 mt-2 font-medium">
                      Ungdommen viser gyldig aktivert bong på sin mobil. Gi ut nypoppet popcornbeger nå.
                    </p>
                    {selectedBong.activatedAt && (
                      <span className="text-[11px] text-zinc-500 font-mono mt-1 block">
                        Aktivert:{' '}
                        {new Date(selectedBong.activatedAt).toLocaleTimeString('no-NO', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  {bongActionError && (
                    <p className="text-xs text-rose-400 font-bold mb-4 text-center">
                      {bongActionError}
                    </p>
                  )}

                  <div className="space-y-3">
                    <button
                      id="confirm-give-popcorn-btn"
                      onClick={() => handleRedeemBong(selectedBong.number)}
                      disabled={bongActionLoading}
                      className="w-full py-4 rounded-2xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-black text-base uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      {bongActionLoading ? 'Lagrer...' : 'GI POPCORN'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedBong(null)}
                      className="w-full py-3 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-zinc-300 text-xs font-black uppercase tracking-wider hover:border-zinc-700 shadow-artistic-sm"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* CASE 2: RØD BONG (FORSØK PÅ DOBBEL UTLEVERING - Section 8) */}
            {selectedBong.status === 'used' && (() => {
              const person = selectedBong.personId
                ? (state.persons || []).find((p) => p.id === selectedBong.personId)
                : null;
              const displayName = person?.displayId || selectedBong.userName;

              return (
                <div>
                  <div className="w-16 h-16 rounded-2xl bg-rose-500 text-zinc-950 flex items-center justify-center mx-auto mb-4 shadow-artistic-sm rotate-2">
                    <AlertTriangle className="w-8 h-8" />
                  </div>

                  <div className="text-center mb-6">
                    <div className="p-3 rounded-2xl bg-rose-500/20 border-2 border-rose-500 mb-3 text-rose-200">
                      <h3 className="font-black text-sm uppercase tracking-wider">
                        ⚠️ DENNE BONGEN ER ALLEREDE BRUKT
                      </h3>
                    </div>

                    <h2 className="text-4xl font-black text-white uppercase tracking-tight font-mono">
                      BONG #{selectedBong.number}
                    </h2>
                    {displayName && (
                      <span className="inline-block mt-1 px-3 py-0.5 bg-rose-500/30 text-rose-300 rounded-full font-bold text-xs uppercase tracking-wider border border-rose-500/50">
                        Tilhører: {displayName}
                      </span>
                    )}
                    <p className="text-xs text-zinc-300 mt-2 font-medium">
                      Popcorn er allerede levert ut for denne bongen. Det skal ikke være mulig å gi ut popcorn to ganger på samme bong.
                    </p>
                    {selectedBong.usedAt && (
                      <span className="text-xs text-rose-400 font-mono font-bold mt-2 block">
                        Levert ut kl.{' '}
                        {new Date(selectedBong.usedAt).toLocaleTimeString('no-NO', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedBong(null)}
                    className="w-full py-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white text-xs font-black uppercase tracking-wider hover:border-zinc-700 shadow-artistic-sm"
                  >
                    Lukk advarsel
                  </button>
                </div>
              );
            })()}

            {/* CASE 3: BLANK / NØYTRAL BONG (IKKE AKTIVERT ENDA) */}
            {selectedBong.status === 'blank' && (
              <div>
                <div className="w-16 h-16 rounded-2xl bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-4 shadow-artistic-sm">
                  <AlertCircle className="w-8 h-8" />
                </div>

                <div className="text-center mb-6">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-400 block mb-1">
                    Ikke aktivert
                  </span>
                  <h2 className="text-4xl font-black text-white uppercase tracking-tight font-mono">
                    BONG #{selectedBong.number}
                  </h2>
                  <p className="text-xs text-zinc-300 mt-2 font-medium">
                    Denne bongen er ikke aktivert enda. Ungdommen må først trykke «TA MOT POPCORN» på sin egen mobil.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedBong(null)}
                  className="w-full py-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white text-xs font-black uppercase tracking-wider hover:border-zinc-700 shadow-artistic-sm"
                >
                  Lukk
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- SCORE ENTRY / CORRECTION MODAL ---------------- */}
      {selectedMatch && !simTournament && (
        <ScoreEntryModal
          match={selectedMatch}
          formatSettings={tournament.formatSettings}
          scoreA={scoreA}
          scoreB={scoreB}
          actionError={actionError}
          correctionWarning={correctionWarning}
          onScoreAChange={setScoreA}
          onScoreBChange={setScoreB}
          onClose={() => {
            setSelectedMatchId(null);
            setActionError(null);
            setCorrectionWarning(null);
          }}
          onSubmit={(setsPayload, winnerSlot) => {
            if (selectedMatch.status === 'completed') {
              handleCorrectScore(false, setsPayload, winnerSlot);
            } else {
              handleSubmitScore(false, undefined, setsPayload, winnerSlot);
            }
          }}
          onConfirmCorrection={(setsPayload, winnerSlot) =>
            handleCorrectScore(true, setsPayload, winnerSlot)
          }
          onWalkover={(slot) => handleSubmitScore(true, slot)}
          onRequestReset={() => {
            if (selectedMatch) openResetMatchModal(selectedMatch);
          }}
        />
      )}

      {resetMatchTarget && (
        <ResetMatchConfirmModal
          match={resetMatchTarget}
          warning={resetWarning}
          loading={resetLoading}
          error={resetError}
          onCancel={closeResetMatchModal}
          onConfirm={() => handleResetMatch(Boolean(resetWarning))}
        />
      )}

      {/* ---------------- CUSTOM IN-APP CONFIRM DIALOG ---------------- */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-700 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : confirmDialog.variant === 'warning'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-lime-500/20 text-lime-400 border border-lime-500/30'
                }`}
              >
                {confirmDialog.variant === 'danger' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : confirmDialog.variant === 'warning' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-white">{confirmDialog.title}</h3>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed whitespace-pre-line">
                  {confirmDialog.message}
                </p>
                {confirmDialog.requiresResetPin && (
                  <div className="mt-3">
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">
                      Nullstillings-PIN
                    </label>
                    <input
                      type="password"
                      value={dialogResetPin}
                      onChange={(e) => setDialogResetPin(e.target.value)}
                      placeholder="Skriv nullstillings-PIN"
                      className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 text-sm font-mono"
                      autoComplete="off"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 space-y-2">
              {confirmDialog.secondaryAction && (
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={async () => {
                    setConfirmLoading(true);
                    try {
                      await confirmDialog.secondaryAction?.onClick(dialogResetPin);
                      setConfirmDialog(null);
                      setDialogResetPin('');
                    } catch (err: any) {
                      if (err?.message !== 'reset pin required') {
                        showToast(err?.message || 'Handlingen feilet', 'error');
                      }
                    } finally {
                      setConfirmLoading(false);
                    }
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-black uppercase tracking-wider transition-all border border-zinc-700"
                >
                  {confirmDialog.secondaryAction.label}
                </button>
              )}

              <button
                type="button"
                disabled={confirmLoading}
                onClick={async () => {
                  setConfirmLoading(true);
                  try {
                    await confirmDialog.onConfirm(dialogResetPin);
                    setConfirmDialog(null);
                    setDialogResetPin('');
                  } catch (err: any) {
                    if (err?.message !== 'reset pin required') {
                      showToast(err?.message || 'Handlingen feilet', 'error');
                    }
                  } finally {
                    setConfirmLoading(false);
                  }
                }}
                className={`w-full py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-artistic-sm flex items-center justify-center gap-2 ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-rose-500 hover:bg-rose-400 text-zinc-950'
                    : confirmDialog.variant === 'warning'
                    ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                    : 'bg-lime-400 hover:bg-lime-300 text-zinc-950'
                }`}
              >
                {confirmLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                {confirmDialog.confirmLabel || 'Bekreft'}
              </button>

              <button
                type="button"
                disabled={confirmLoading}
                onClick={() => {
                  setConfirmDialog(null);
                  setDialogResetPin('');
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-transparent hover:bg-zinc-800/60 text-zinc-400 text-xs font-bold transition-all"
              >
                {confirmDialog.cancelLabel || 'Avbryt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- DIRECT PARTICIPANT VIEW / EDIT MODAL ---------------- */}
      {selectedPersonForEdit && (() => {
        const p = selectedPersonForEdit;
        const currentPersonInState = (state.persons || []).find((pers) => pers.id === p.id) || p;
        const ttPart = (tournament.participants || []).find(
          (tp) => tp.personId === currentPersonInState.id || tp.anonymousToken === currentPersonInState.anonymousToken
        );
        const pBong = (popcorn?.bongs || []).find(
          (b) =>
            b.personId === currentPersonInState.id ||
            b.clientToken === currentPersonInState.anonymousToken ||
            b.userName === currentPersonInState.displayId ||
            b.userName === currentPersonInState.firstName
        );
        const pAlpha = (alphaInterests || []).find(
          (a) =>
            (currentPersonInState.anonymousToken && a.clientToken === currentPersonInState.anonymousToken) ||
            (a.name && (a.name === currentPersonInState.displayId || a.name === currentPersonInState.firstName))
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-zinc-900 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-wider border border-sky-500/30">
                      Deltaker
                    </span>
                    <span className="text-zinc-500 text-xs font-mono">
                      {new Date(currentPersonInState.createdAt).toLocaleString('no-NO')}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white mt-1">
                    {currentPersonInState.displayId || currentPersonInState.firstName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPersonForEdit(null)}
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Section 1: Rediger navn */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                  Rediger deltakers fornavn
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingPersonName}
                    onChange={(e) => setEditingPersonName(e.target.value)}
                    placeholder="Fornavn"
                    disabled={personEditLoading}
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    disabled={personEditLoading || !editingPersonName.trim() || editingPersonName.trim() === currentPersonInState.firstName}
                    onClick={handleSavePersonName}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-artistic-sm cursor-pointer"
                  >
                    {personEditLoading ? 'Lagrer...' : 'Lagre navn'}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Id i arrangementet: <strong className="text-zinc-300 font-mono">{currentPersonInState.displayId}</strong>
                </p>
              </div>

              {/* Section 2: Bordtennis turnering */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-300">
                    <Trophy className="w-4 h-4 text-lime-400" />
                    <span>Bordtennisturnering</span>
                  </div>
                  {ttPart ? (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-lime-500/20 text-lime-300 font-bold border border-lime-500/30">
                      Påmeldt (#{ttPart.seed})
                    </span>
                  ) : (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold">
                      Ikke påmeldt
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {ttPart ? (
                    <button
                      type="button"
                      disabled={personEditLoading}
                      onClick={() => handleToggleTournamentInModal(currentPersonInState, true, ttPart.id)}
                      className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>Meld av bordtennis</span>
                    </button>
                  ) : tournament.status === 'registration' ? (
                    <button
                      type="button"
                      disabled={personEditLoading}
                      onClick={() => handleToggleTournamentInModal(currentPersonInState, false)}
                      className="px-3 py-2 rounded-xl bg-lime-500/15 hover:bg-lime-500/25 text-lime-300 border border-lime-500/30 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Meld på bordtennis</span>
                    </button>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      Turneringen er i gang. Påmelding kan ikke endres.
                    </p>
                  )}
                </div>
              </div>

              {/* Section 3: Popcorn Kiosk */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-300">
                    <Popcorn className="w-4 h-4 text-amber-400" />
                    <span>Popcorn Kiosk</span>
                  </div>
                  {pBong ? (
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                      pBong.status === 'used'
                        ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      Bong #{pBong.bongNumber} {pBong.status === 'used' ? '(Utlevert)' : '(Aktiv)'}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold">
                      Ingen bong
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {pBong ? (
                    pBong.status !== 'used' ? (
                      <button
                        type="button"
                        disabled={personEditLoading}
                        onClick={() => handleRedeemBongInModal(pBong.bongNumber)}
                        className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Marker som utlevert i kiosk</span>
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500 font-medium">
                        Popcorn er allerede utlevert til denne deltakeren.
                      </span>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled={personEditLoading}
                      onClick={() => handleActivateBongInModal(currentPersonInState)}
                      className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Aktiver gratis popcorn-bong</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Section 4: UngdomsAlpha */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-300">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>UngdomsAlpha</span>
                  </div>
                  {pAlpha ? (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                      Interessert
                    </span>
                  ) : (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold">
                      Ikke registrert
                    </span>
                  )}
                </div>
                {pAlpha && (
                  <div className="text-xs text-zinc-400 pt-1 space-y-1">
                    {pAlpha.phone && <p>Telefon: <strong className="text-zinc-200">{pAlpha.phone}</strong></p>}
                    {pAlpha.notes && <p>Notat: <span className="text-zinc-300 italic">{pAlpha.notes}</span></p>}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="pt-2 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenPersonProfile(currentPersonInState);
                    setSelectedPersonForEdit(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 text-sky-400" />
                  <span>Åpne Min side</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleDeletePerson(currentPersonInState)}
                    className="px-3 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-950 text-rose-400 hover:text-rose-300 border border-rose-800/50 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Slett</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPersonForEdit(null)}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    Lukk
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---------------- TOAST NOTIFICATION ---------------- */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div
            className={`p-4 rounded-2xl border shadow-xl flex items-start gap-3 backdrop-blur-md ${
              toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-700 text-rose-100'
                : toast.type === 'success'
                ? 'bg-zinc-900/95 border-lime-500/50 text-white'
                : 'bg-zinc-900/95 border-zinc-700 text-white'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              ) : toast.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-lime-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-sky-400" />
              )}
            </div>
            <p className="text-xs font-semibold flex-1 leading-snug">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="text-zinc-400 hover:text-white shrink-0 p-0.5 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
