import React, { useState, useEffect } from 'react';
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
  ToggleRight,
  Tv,
  Sparkles,
  Copy,
  Zap,
  Popcorn,
  Check,
  AlertCircle,
} from 'lucide-react';
import { AppState, Match, PopcornBong } from '../types';
import {
  startTournament,
  submitMatchScore,
  correctMatchScore,
  assignMatchTable,
  resetTournament,
  simulateTournament,
  registerParticipant,
  removeParticipant,
  toggleActivity,
  setAdminPin,
  redeemPopcornBong,
  addPopcornCapacity,
  resetPopcorn,
  reDrawTournament,
  resetAlpha,
  resetTestData,
} from '../services/api';
import { calculateTournamentStats } from '../lib/tournament';

interface AdminDashboardProps {
  state: AppState;
  onRefresh: () => void;
  onOpenDisplay: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  state,
  onRefresh,
  onOpenDisplay,
}) => {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(false);

  // Match score entry form state
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState<number>(21);
  const [scoreB, setScoreB] = useState<number>(18);
  const [actionError, setActionError] = useState<string | null>(null);
  const [correctionWarning, setCorrectionWarning] = useState<string | null>(null);

  // Popcorn kiosk state
  const [selectedBong, setSelectedBong] = useState<PopcornBong | null>(null);
  const [bongActionLoading, setBongActionLoading] = useState(false);
  const [bongActionError, setBongActionError] = useState<string | null>(null);

  // Manual participant add state
  const [newPlayerName, setNewPlayerName] = useState('');

  // Active section tab: Kiosk & Popcorn is prominent
  const [adminTab, setAdminTab] = useState<
    'kiosk_popcorn' | 'matches' | 'participants' | 'activities' | 'alpha' | 'test'
  >('kiosk_popcorn');

  const { tournament, activities, alphaInterests, popcorn } = state;
  const stats = calculateTournamentStats(tournament.matches, tournament.estimatedMinutesPerMatch);

  // Check existing session pin on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('lillesand_admin_pin');
    if (saved === 'united2026') {
      setIsAuthenticated(true);
      setAdminPin(saved);
    }
  }, []);

  // Admin unlock
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim();
    if (cleanPin === 'united2026' || cleanPin === 'admin' || cleanPin === '1234') {
      const activePin = cleanPin === '1234' ? 'united2026' : cleanPin;
      setAdminPin(activePin);
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleLock = () => {
    setIsAuthenticated(false);
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
    } catch (err: any) {
      setBongActionError(err.message || 'Kunne ikke levere ut popcorn');
    } finally {
      setBongActionLoading(false);
    }
  };

  const handleAddCapacity = async () => {
    const current = popcorn?.totalCapacity || 100;
    const nextTotal = current + 10;
    if (
      !confirm(
        `Vil du åpne 10 nye popcorn-bonger (#${current + 1}–#${nextTotal})?\n\nTotalt åpnet blir da ${nextTotal} bonger.`
      )
    ) {
      return;
    }
    try {
      await addPopcornCapacity(10);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetPopcorn = async () => {
    if (!confirm('Dette sletter all testdata for popcorn. Er du sikker?')) return;
    try {
      await resetPopcorn();
      setSelectedBong(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetTournamentData = async () => {
    if (
      !confirm(
        'Dette sletter alle testspillere, kamper og cup-tre for bordtennis. Er du sikker?'
      )
    ) {
      return;
    }
    try {
      await resetTournament(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReDraw = async () => {
    if (tournament.participants.length < 2) {
      alert('Minst 2 deltakere kreves for å generere ny trekning.');
      return;
    }
    if (
      !confirm(
        `Vil du generere en ny tilfeldig trekning for de ${tournament.participants.length} påmeldte spillerne?`
      )
    ) {
      return;
    }
    try {
      await reDrawTournament();
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetAlphaData = async () => {
    if (!confirm('Dette sletter all testregistrering for UngdomsAlpha. Er du sikker?')) return;
    try {
      await resetAlpha();
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetTestDataFull = async () => {
    if (
      !confirm(
        'Vil du nullstille all testdata for Popcorn, Bordtennis og Alpha i én operasjon? (Arrangementets faste info berøres ikke).'
      )
    ) {
      return;
    }
    try {
      await resetTestData();
      setSelectedBong(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Start tournament
  const handleStartTournament = async () => {
    if (tournament.participants.length < 2) {
      alert('Minst 2 deltakere kreves for å starte.');
      return;
    }
    if (
      !confirm(
        `Er du sikker på at du vil stenge påmeldingen og generere cup-tre for ${tournament.participants.length} spillere?`
      )
    ) {
      return;
    }
    try {
      await startTournament();
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit match score
  const handleSubmitScore = async (isWalkover = false, woSlot?: 'A' | 'B') => {
    if (!selectedMatchId) return;
    setActionError(null);
    setCorrectionWarning(null);

    try {
      await submitMatchScore(selectedMatchId, scoreA, scoreB, isWalkover, woSlot);
      setSelectedMatchId(null);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Kunne ikke lagre resultat.');
    }
  };

  // Correct match score
  const handleCorrectScore = async (forceConfirm = false) => {
    if (!selectedMatchId) return;
    setActionError(null);

    try {
      const res = await correctMatchScore(selectedMatchId, scoreA, scoreB, forceConfirm);
      if (res.requiresConfirmation && !forceConfirm) {
        setCorrectionWarning(res.warning || 'Advarsel om avhengigheter');
        return;
      }
      setSelectedMatchId(null);
      setCorrectionWarning(null);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Kunne ikke korrigere.');
    }
  };

  // Assign table or change status
  const handleAssignTable = async (matchId: string, tableNumber: 1 | 2 | null, status?: string) => {
    try {
      await assignMatchTable(matchId, tableNumber, status);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Reset tournament to registration (keep players)
  const handleReopenRegistration = async () => {
    if (!confirm('Tilbakestille turneringen til påmeldingsfasen (beholde deltakerne)?')) {
      return;
    }
    try {
      await resetTournament(true);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Run test simulation
  const handleSimulate = async (count: 16 | 31) => {
    if (!confirm(`Generere en test-turnering med ${count} fiktive spillere?`)) return;
    try {
      await simulateTournament(count);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Add participant
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    try {
      await registerParticipant(newPlayerName.trim());
      setNewPlayerName('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Remove participant
  const handleRemoveParticipant = async (id: string) => {
    try {
      await removeParticipant(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Toggle activity
  const handleToggleActivity = async (id: string, currentEnabled: boolean) => {
    try {
      await toggleActivity(id, !currentEnabled);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
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
    alert('Alpha-interesselisten er kopiert til utklippstavlen!');
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
              Feil kode. Standard arrangør-PIN er "united2026".
            </p>
          )}

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => {
                setPin('united2026');
                setAdminPin('united2026');
                setIsAuthenticated(true);
              }}
              className="text-xs font-bold text-zinc-500 hover:text-zinc-300 underline uppercase tracking-wider"
            >
              Hurtiginnlogging som arrangør (united2026)
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
      <div className="flex items-center gap-2 border-b-2 border-zinc-800 pb-3 mb-6 overflow-x-auto">
        <button
          onClick={() => setAdminTab('kiosk_popcorn')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 border-2 transition-all ${
            adminTab === 'kiosk_popcorn'
              ? 'bg-amber-400 text-zinc-950 border-zinc-950 shadow-artistic-sm'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
          }`}
        >
          <Popcorn className="w-4 h-4" />
          Kiosk & Popcorn ({usedBongs.length}/{totalCapacity})
        </button>

        <button
          onClick={() => setAdminTab('matches')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 border-2 transition-all ${
            adminTab === 'matches'
              ? 'bg-lime-400 text-zinc-950 border-zinc-950 shadow-artistic-sm'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Bordtennis Kamper ({tournament.matches.length})
        </button>

        <button
          onClick={() => setAdminTab('participants')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 border-2 transition-all ${
            adminTab === 'participants'
              ? 'bg-lime-400 text-zinc-950 border-zinc-950 shadow-artistic-sm'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Deltakere ({tournament.participants.length})
        </button>

        <button
          onClick={() => setAdminTab('activities')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 border-2 transition-all ${
            adminTab === 'activities'
              ? 'bg-lime-400 text-zinc-950 border-zinc-950 shadow-artistic-sm'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
          }`}
        >
          <ToggleRight className="w-4 h-4" />
          Aktiviteter
        </button>

        <button
          onClick={() => setAdminTab('alpha')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 border-2 transition-all ${
            adminTab === 'alpha'
              ? 'bg-sky-400 text-zinc-950 border-zinc-950 shadow-artistic-sm'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Alpha-interesser ({alphaInterests.length})
        </button>

        <button
          onClick={() => setAdminTab('test')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 border-2 transition-all ${
            adminTab === 'test'
              ? 'bg-rose-500 text-zinc-950 border-zinc-950 shadow-artistic-sm'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          Test & Reset
        </button>
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
                        {bong.userName ? `${bong.userName}` : statusBadge}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB: MATCHES & TABLES ---------------- */}
      {adminTab === 'matches' && (
        <div className="space-y-6">
          {/* Tournament Control Action Bar */}
          <div className="p-5 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">Status:</span>
              <strong className="text-sm font-black text-lime-400 uppercase tracking-wider">
                {tournament.status === 'registration'
                  ? 'Påmelding pågår'
                  : tournament.status === 'active'
                  ? 'Turnering pågår'
                  : 'Fullført'}
              </strong>
            </div>

            <div className="flex items-center gap-3">
              {tournament.status === 'registration' ? (
                <button
                  onClick={handleStartTournament}
                  disabled={tournament.participants.length < 2}
                  className="px-5 py-3 rounded-2xl bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-zinc-950 text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                  <Play className="w-4 h-4" />
                  Steng påmelding & Start cup
                </button>
              ) : (
                <button
                  onClick={handleReopenRegistration}
                  className="px-4 py-2.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Gjenåpne påmelding
                </button>
              )}
            </div>
          </div>

          {/* ACTIVE TABLES QUICK CONTROLS */}
          {tournament.matches.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2].map((tableNum) => {
                const match = tournament.matches.find(
                  (m) => m.tableNumber === tableNum && m.status !== 'completed'
                );
                return (
                  <div
                    key={tableNum}
                    className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-black text-white uppercase flex items-center gap-2">
                        <span
                          className={`w-3 h-3 rounded-full ${
                            tableNum === 1 ? 'bg-lime-400' : 'bg-orange-400'
                          } animate-ping`}
                        />
                        Bord {tableNum}
                      </h3>
                      {match && (
                        <span className="text-xs font-black uppercase bg-zinc-950 text-zinc-300 px-3 py-1 rounded-xl border border-zinc-800">
                          {match.status === 'in_progress' ? 'I gang' : 'Klar'}
                        </span>
                      )}
                    </div>

                    {match ? (
                      <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 mb-3 shadow-artistic-sm">
                        <span className="text-[10px] font-black uppercase tracking-wider text-lime-400 block mb-1">
                          {match.roundName}
                        </span>
                        <div className="flex items-center justify-between">
                          <strong className="text-white text-base">
                            {match.playerA?.firstName || 'TBD'} vs{' '}
                            {match.playerB?.firstName || 'TBD'}
                          </strong>
                          <button
                            onClick={() => {
                              setSelectedMatchId(match.id);
                              setScoreA(match.scoreA || 21);
                              setScoreB(match.scoreB || 18);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm"
                          >
                            Døm kamp
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 italic mb-3">Ingen aktiv kamp på dette bordet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* All Matches List */}
          <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-4">
            <h3 className="text-base font-black text-white uppercase">
              Alle Kamper ({tournament.matches.length})
            </h3>

            <div className="space-y-3">
              {tournament.matches.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-artistic-sm"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-black uppercase text-lime-400">
                        {m.roundName}
                      </span>
                      {m.tableNumber && (
                        <span className="text-[10px] font-mono bg-zinc-900 px-2 py-0.5 rounded text-zinc-300 border border-zinc-800">
                          Bord {m.tableNumber}
                        </span>
                      )}
                      {m.isWalkover && (
                        <span className="text-[10px] bg-amber-400 text-zinc-950 font-black px-2 py-0.5 rounded">
                          Walkover
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-black text-white">
                      <span className={m.winnerId === m.playerA?.id ? 'text-lime-400 font-black' : ''}>
                        {m.playerA?.firstName || 'TBD'}
                      </span>
                      <span className="text-zinc-600 mx-2">vs</span>
                      <span className={m.winnerId === m.playerB?.id ? 'text-lime-400 font-black' : ''}>
                        {m.playerB?.firstName || (m.isWalkover ? '(Walkover)' : 'TBD')}
                      </span>
                      {(m.scoreA !== null || m.scoreB !== null) && (
                        <span className="ml-3 font-mono text-xs bg-zinc-900 px-2.5 py-0.5 rounded-lg border border-zinc-800 text-lime-400 font-black">
                          {m.scoreA} - {m.scoreB}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {!m.isWalkover && m.status !== 'completed' && m.playerA && m.playerB && (
                      <>
                        <button
                          onClick={() => handleAssignTable(m.id, 1, 'in_progress')}
                          className="px-3 py-1.5 rounded-xl bg-zinc-900 border-2 border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-black uppercase tracking-wider shadow-artistic-sm"
                        >
                          Sett Bord 1
                        </button>
                        <button
                          onClick={() => handleAssignTable(m.id, 2, 'in_progress')}
                          className="px-3 py-1.5 rounded-xl bg-zinc-900 border-2 border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-black uppercase tracking-wider shadow-artistic-sm"
                        >
                          Sett Bord 2
                        </button>
                      </>
                    )}

                    {!m.isWalkover && m.playerA && m.playerB && (
                      <button
                        onClick={() => {
                          setSelectedMatchId(m.id);
                          setScoreA(m.scoreA || 21);
                          setScoreB(m.scoreB || 18);
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all ${
                          m.status === 'completed'
                            ? 'bg-zinc-800 text-amber-400 hover:bg-zinc-700'
                            : 'bg-lime-400 text-zinc-950 hover:bg-lime-300'
                        }`}
                      >
                        {m.status === 'completed' ? 'Endre resultat' : 'Sett score'}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {tournament.matches.length === 0 && (
                <div className="p-8 text-center text-xs font-bold text-zinc-500">
                  Ingen kamper generert enda. Gå til påmeldingsfasen og klikk "Start cup".
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB: PARTICIPANTS ---------------- */}
      {adminTab === 'participants' && (
        <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white uppercase">
                Påmeldte deltakere ({tournament.participants.length})
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                Legg til eller fjern deltakere manuelt før trekning
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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {tournament.participants.map((p, idx) => (
              <div
                key={p.id}
                className="p-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between shadow-artistic-sm"
              >
                <div>
                  <span className="text-[10px] font-black text-zinc-500 block uppercase">#{idx + 1}</span>
                  <strong className="text-sm font-black text-white">{p.firstName}</strong>
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
              Ingen deltakere er registrert.
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB: ACTIVITIES ---------------- */}
      {adminTab === 'activities' && (
        <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-4">
          <div>
            <h3 className="text-base font-black text-white uppercase">
              Aktiver / Deaktiver aktiviteter
            </h3>
            <p className="text-xs text-zinc-400 font-medium">
              Slå av aktiviteter dersom de er fullbooket eller avsluttet for kvelden
            </p>
          </div>

          <div className="space-y-3">
            {activities.map((act) => (
              <div
                key={act.id}
                className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between shadow-artistic-sm"
              >
                <div>
                  <h4 className="font-black text-white text-sm">{act.name}</h4>
                  <p className="text-xs text-zinc-400 font-medium">{act.time}</p>
                </div>

                <button
                  onClick={() => handleToggleActivity(act.id, act.enabled)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 ${
                    act.enabled
                      ? 'bg-lime-400 text-zinc-950'
                      : 'bg-zinc-900 text-zinc-500 border-2 border-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  {act.enabled ? 'Aktiv (Synlig)' : 'Deaktivert'}
                </button>
              </div>
            ))}
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
      {adminTab === 'test' && (
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

            {/* 2. RESET TURNERING */}
            <div className="p-5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex flex-col justify-between shadow-artistic-sm">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-lime-400 block mb-1">
                  Bordtennis
                </span>
                <h4 className="font-black text-white text-base mb-1">Reset Turnering</h4>
                <p className="text-xs text-zinc-400 mb-4 font-medium">
                  Fjerner alle testspillere, kamper og cup-tre. Setter status tilbake til påmelding.
                </p>
              </div>
              <button
                id="admin-reset-tournament-btn"
                onClick={handleResetTournamentData}
                className="w-full py-3 rounded-2xl bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                Reset Turnering
              </button>
            </div>

            {/* 3. GENERER NY TREKNING */}
            <div className="p-5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex flex-col justify-between shadow-artistic-sm">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-lime-400 block mb-1">
                  Bordtennis
                </span>
                <h4 className="font-black text-white text-base mb-1">Generer ny trekning</h4>
                <p className="text-xs text-zinc-400 mb-4 font-medium">
                  Beholder deltakerlisten, fjerner eksisterende tre/kamper og genererer nytt tilfeldig cup-tre med korrekte walkovers.
                </p>
              </div>
              <button
                id="admin-redraw-btn"
                onClick={handleReDraw}
                disabled={tournament.participants.length < 2}
                className="w-full py-3 rounded-2xl bg-zinc-900 border-2 border-lime-400/50 hover:border-lime-400 disabled:opacity-40 text-lime-300 text-xs font-black uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                Generer ny trekning
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
                  Nullstiller Popcorn, Bordtennis og Alpha i én operasjon. Rører aldri tidspunkter eller arrangementets faste program.
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

          {/* Tournament Simulations (16 or 31 players) */}
          <div className="pt-4 border-t-2 border-zinc-800">
            <h4 className="font-black text-white text-sm uppercase mb-3">
              Kjappe simuleringer for turneringsledere:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between shadow-artistic-sm">
                <div>
                  <strong className="text-white text-sm font-black block">Simuler 16 spillere</strong>
                  <span className="text-xs text-zinc-400 font-medium">Ren 16-brakett, 0 walkovers</span>
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
                  <strong className="text-white text-sm font-black block">Simuler 31 spillere</strong>
                  <span className="text-xs text-zinc-400 font-medium">32-brakett, 1 walkover</span>
                </div>
                <button
                  onClick={() => handleSimulate(31)}
                  className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm"
                >
                  Start 31
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
            {selectedBong.status === 'activated' && (
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
                  {selectedBong.userName && (
                    <span className="inline-block mt-1 px-3 py-0.5 bg-lime-400 text-zinc-950 rounded-full font-black text-xs uppercase tracking-wider">
                      Tilhører: {selectedBong.userName}
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
            )}

            {/* CASE 2: RØD BONG (FORSØK PÅ DOBBEL UTLEVERING - Section 8) */}
            {selectedBong.status === 'used' && (
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
                  {selectedBong.userName && (
                    <span className="inline-block mt-1 px-3 py-0.5 bg-rose-500/30 text-rose-300 rounded-full font-bold text-xs uppercase tracking-wider border border-rose-500/50">
                      Tilhører: {selectedBong.userName}
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
            )}

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
      {selectedMatch && (
        <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-zinc-900 border-2 border-zinc-700 p-6 sm:p-8 shadow-artistic-md">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-wider text-lime-400">
                {selectedMatch.roundName}
              </span>
              <button
                onClick={() => {
                  setSelectedMatchId(null);
                  setActionError(null);
                  setCorrectionWarning(null);
                }}
                className="text-zinc-400 hover:text-white text-xl font-black"
              >
                ✕
              </button>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-2">
              Registrer resultat
            </h2>
            <p className="text-xs text-zinc-400 mb-6 font-medium">
              Først til 21 poeng (5 server hver). Ved 20–20 må vinneren lede med 2 poeng.
            </p>

            {/* Match players and score inputs */}
            <div className="space-y-4 mb-6">
              <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between shadow-artistic-sm">
                <span className="text-base font-black text-white truncate max-w-[60%]">
                  {selectedMatch.playerA?.firstName}
                </span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={scoreA}
                  onChange={(e) => setScoreA(parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 rounded-xl bg-zinc-900 border-2 border-zinc-800 text-lime-400 font-mono font-black text-2xl text-center focus:outline-none focus:border-lime-400 shadow-artistic-sm"
                />
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between shadow-artistic-sm">
                <span className="text-base font-black text-white truncate max-w-[60%]">
                  {selectedMatch.playerB?.firstName}
                </span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={scoreB}
                  onChange={(e) => setScoreB(parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 rounded-xl bg-zinc-900 border-2 border-zinc-800 text-lime-400 font-mono font-black text-2xl text-center focus:outline-none focus:border-lime-400 shadow-artistic-sm"
                />
              </div>
            </div>

            {/* Quick Presets Buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="text-xs font-bold text-zinc-500 self-center uppercase">Hurtigvalg:</span>
              <button
                type="button"
                onClick={() => {
                  setScoreA(21);
                  setScoreB(18);
                }}
                className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-black text-zinc-300 hover:border-zinc-600 shadow-artistic-sm"
              >
                21 - 18
              </button>
              <button
                type="button"
                onClick={() => {
                  setScoreA(18);
                  setScoreB(21);
                }}
                className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-black text-zinc-300 hover:border-zinc-600 shadow-artistic-sm"
              >
                18 - 21
              </button>
              <button
                type="button"
                onClick={() => {
                  setScoreA(22);
                  setScoreB(20);
                }}
                className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-black text-zinc-300 hover:border-zinc-600 shadow-artistic-sm"
              >
                22 - 20 (Ekstra)
              </button>
            </div>

            {/* Dependency warning dialog if correcting a previously played match */}
            {correctionWarning && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-500/20 border-2 border-rose-500 text-xs text-rose-200 shadow-artistic-sm">
                <strong className="font-black uppercase tracking-wider block mb-1">
                  ⚠️ Advarsel om korrigering:
                </strong>
                <p className="mb-3 font-medium">{correctionWarning}</p>
                <button
                  type="button"
                  onClick={() => handleCorrectScore(true)}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-zinc-950 font-black uppercase tracking-wider shadow-artistic-sm"
                >
                  Bekreft og tilbakestill senere kamper
                </button>
              </div>
            )}

            {actionError && (
              <p className="text-xs text-rose-400 font-bold mb-4">{actionError}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (selectedMatch.status === 'completed') {
                    handleCorrectScore(false);
                  } else {
                    handleSubmitScore(false);
                  }
                }}
                className="flex-1 py-3.5 rounded-2xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-black text-sm uppercase tracking-wider shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                {selectedMatch.status === 'completed' ? 'Lagre korrigering' : 'Godkjenn resultat'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedMatchId(null);
                  setActionError(null);
                  setCorrectionWarning(null);
                }}
                className="px-5 py-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 hover:border-zinc-700 text-zinc-300 font-black uppercase text-xs shadow-artistic-sm"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
