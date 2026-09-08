import React, { useState, useMemo } from 'react';
import {
  User,
  UserCheck,
  UserPlus,
  ArrowRightLeft,
  RotateCcw,
  Trophy,
  Popcorn,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Edit2,
  ChevronRight,
} from 'lucide-react';
import { AppState, PopcornBong, Person, Participant } from '../types';
import { getUserToken, saveUserTokenForName, startNewGuestSession } from '../lib/userProfile';
import { activatePopcornBong, registerParticipant, registerAlphaInterest, renameUser } from '../services/api';

interface MyProfileViewProps {
  state: AppState;
  myPlayerName: string | null;
  onSetMyPlayer: (name: string | null) => void;
  onRefreshState: () => void;
  onGoToTab: (tab: 'home' | 'tabletennis' | 'alpha' | 'kiosk') => void;
  activePersonId?: string | null;
  activePerson?: Person | null;
}

export const MyProfileView: React.FC<MyProfileViewProps> = ({
  state,
  myPlayerName,
  onSetMyPlayer,
  onRefreshState,
  onGoToTab,
  activePersonId = null,
  activePerson: activePersonProp = null,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [customUserInput, setCustomUserInput] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const activePerson = activePersonProp;

  const currentUserName = activePerson?.firstName || ((myPlayerName && myPlayerName.trim()) ? myPlayerName.trim() : null);
  const userToken = useMemo(() => {
    if (activePerson?.anonymousToken) return activePerson.anonymousToken;
    return getUserToken(currentUserName);
  }, [activePerson, currentUserName]);

  // Find user's popcorn bong
  const userBong = useMemo((): PopcornBong | null => {
    if (!state.popcorn?.bongs) return null;
    if (activePersonId) {
      return state.popcorn.bongs.find((b) => b.personId === activePersonId) || null;
    }
    if (userToken) {
      return state.popcorn.bongs.find((b) => b.clientToken === userToken) || null;
    }
    return null;
  }, [state.popcorn, activePersonId, userToken]);

  // Find user's table tennis registration
  const participant = useMemo(() => {
    if (activePersonId) {
      const byPerson = state.tournament?.participants.find((p) => p.personId === activePersonId);
      if (byPerson) return byPerson;
    }
    if (!currentUserName) return null;
    return state.tournament?.participants.find(
      (p) =>
        (p.userId && p.userId === userToken) ||
        p.firstName.toLowerCase() === currentUserName.toLowerCase()
    ) || null;
  }, [state.tournament, activePersonId, currentUserName, userToken]);

  // Find user's Alpha interest
  const alphaInterest = useMemo(() => {
    if (!currentUserName) return null;
    return state.alphaInterests?.find(
      (a) =>
        (a.userId && a.userId === userToken) ||
        a.firstName.toLowerCase() === currentUserName.toLowerCase()
    ) || null;
  }, [state.alphaInterests, currentUserName, userToken]);

  // Table tennis match / turn details
  const tableTennisStatus = useMemo(() => {
    if (!participant || !state.tournament) return null;
    const tour = state.tournament;
    const participantId = participant.id;

    if (tour.status === 'registration') {
      return {
        stage: 'waiting_bracket',
        title: 'Påmeldt – venter på trekning',
        details: 'Trekningen skjer ved turneringsstart kl. 18:45.',
      };
    }

    if (tour.winner && tour.winner.id === participantId) {
      return {
        stage: 'champion',
        title: '🏆 TURNERINGSVINNER!',
        details: 'Gratulerer, du vant bordtenniscupen i kveld!',
      };
    }

    const myMatches = tour.matches.filter(
      (m) =>
        (m.playerA && m.playerA.id === participantId) ||
        (m.playerB && m.playerB.id === participantId)
    );

    const opponentLabel = (p: Participant | null | undefined) =>
      p?.displayId || p?.firstName || 'motstander';

    const playingNow = myMatches.find((m) => m.status === 'in_progress');
    if (playingNow) {
      const opponent =
        playingNow.playerA?.id === participantId ? playingNow.playerB : playingNow.playerA;
      return {
        stage: 'playing_now',
        title: `🚨 SPILLES NÅ: BORD ${playingNow.tableNumber || 1}!`,
        details: `Motstander: ${opponentLabel(opponent)}. Gå til bordet!`,
      };
    }

    const readyTable = myMatches.find((m) => m.status === 'ready' && m.tableNumber);
    if (readyTable) {
      const opponent =
        readyTable.playerA?.id === participantId ? readyTable.playerB : readyTable.playerA;
      return {
        stage: 'ready_table',
        title: `🔔 NESTE KAMP PÅ BORD ${readyTable.tableNumber}!`,
        details: `Gjør deg klar. Motstander: ${opponentLabel(opponent)}.`,
      };
    }

    const waitingMatch = myMatches.find(
      (m) => m.status === 'ready' || (m.status === 'not_ready' && !m.winnerId)
    );
    if (waitingMatch) {
      const opponent =
        waitingMatch.playerA?.id === participantId
          ? waitingMatch.playerB
          : waitingMatch.playerA;
      return {
        stage: 'in_queue',
        title: `I turneringskø (${waitingMatch.roundName})`,
        details: opponent ? `Møter ${opponentLabel(opponent)}` : 'Venter på avklaring av motstander.',
      };
    }

    // Check if player was eliminated
    const finishedLoss = myMatches.find(
      (m) => m.status === 'completed' && m.winnerId && m.winnerId !== participant.id
    );
    if (finishedLoss) {
      return {
        stage: 'eliminated',
        title: 'Utslått fra turneringen',
        details: 'Bra innsats! Du kan heie på vennene dine videre.',
      };
    }

    return {
      stage: 'active',
      title: 'Aktiv i turneringen',
      details: 'Følg med på storskjerm og oversikten.',
    };
  }, [participant, state.tournament]);

  // Actions
  const handleClaimPopcorn = async () => {
    setLoadingAction('popcorn');
    setActionError(null);
    try {
      await activatePopcornBong(
        userToken,
        activePerson?.displayId || currentUserName || undefined,
        activePersonId || undefined
      );
      onRefreshState();
    } catch (err: any) {
      setActionError(err.message || 'Kunne ikke aktivere popcornbong.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRegisterTableTennis = async () => {
    if (!activePerson) {
      setActionError('Du må velge eller opprette en profil før du melder deg på bordtennis.');
      setEditingName(true);
      return;
    }
    setLoadingAction('tabletennis');
    setActionError(null);
    try {
      await registerParticipant(
        activePerson.firstName,
        undefined,
        activePerson.id,
        activePerson.anonymousToken
      );
      onRefreshState();
    } catch (err: any) {
      setActionError(err.message || 'Kunne ikke melde på til bordtennis.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRegisterAlpha = async () => {
    if (!currentUserName) {
      setEditingName(true);
      return;
    }
    setLoadingAction('alpha');
    setActionError(null);
    try {
      await registerAlphaInterest(currentUserName, undefined, undefined, userToken);
      onRefreshState();
    } catch (err: any) {
      setActionError(err.message || 'Kunne ikke melde interesse for Alpha.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNameInput.trim()) return;
    const cleanNew = newNameInput.trim();
    setLoadingAction('rename');
    setActionError(null);
    try {
      await renameUser(userToken, cleanNew, currentUserName || undefined);
      saveUserTokenForName(cleanNew, userToken);
      onSetMyPlayer(cleanNew);
      setEditingName(false);
      setNewNameInput('');
      onRefreshState();
    } catch (err: any) {
      setActionError(err.message || 'Kunne ikke endre navn.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCreateNewTestUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUserInput.trim()) return;
    const clean = customUserInput.trim();
    onSetMyPlayer(clean);
    setCustomUserInput('');
    setShowNewUserModal(false);
  };

  const handleGuestSession = () => {
    startNewGuestSession();
    onSetMyPlayer(null);
    onRefreshState();
  };

  return (
    <div id="my-profile-view" className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
      {/* Top Profile Header Card */}
      <div className="bg-zinc-900 border-2 border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-artistic-md mb-8 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-lime-400 text-zinc-950 flex items-center justify-center font-black shadow-artistic-sm -rotate-1">
              <User className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-lime-400 uppercase tracking-wider">
                  Min arrangementsprofil
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold border border-zinc-700">
                  Lillesand United
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase mt-0.5 flex items-center gap-3">
                👤 {currentUserName || 'Gjest (ikke navngitt)'}
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Felles profil for bordtenniscup, gratis popcorn og UngdomsAlpha.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              id="btn-rename-user"
              type="button"
              onClick={() => {
                setNewNameInput(currentUserName || '');
                setEditingName(true);
              }}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-artistic-sm"
              title="Endre fornavn på samme profil"
            >
              <Edit2 className="w-3.5 h-3.5 text-lime-400" />
              <span>Bytt navn</span>
            </button>
          </div>
        </div>

        {/* Rename Input Form */}
        {editingName && (
          <form
            onSubmit={handleRename}
            className="mt-5 p-4 bg-zinc-950 rounded-2xl border-2 border-lime-400/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <div className="flex-1">
              <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                Skriv inn nytt fornavn (beholder samme bruker-ID, popcornbong og aktiviteter):
              </label>
              <input
                type="text"
                value={newNameInput}
                onChange={(e) => setNewNameInput(e.target.value)}
                placeholder="F.eks. Sander"
                autoFocus
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-white font-bold focus:outline-none focus:border-lime-400"
              />
            </div>
            <div className="flex items-center gap-2 pt-2 sm:pt-4">
              <button
                type="submit"
                disabled={loadingAction === 'rename' || !newNameInput.trim()}
                className="px-4 py-2 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-artistic-sm disabled:opacity-50"
              >
                {loadingAction === 'rename' ? 'Oppdaterer...' : 'Lagre navn'}
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="px-3 py-2 text-zinc-400 hover:text-white text-xs font-bold"
              >
                Avbryt
              </button>
            </div>
          </form>
        )}

        {/* Test Profile Toolbar (Section 11 & 12 & 16) */}
        <div className="mt-5 pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-400 font-bold flex items-center gap-1">
              <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-500" />
              Bytt testbruker:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {['Oliver', 'Emma', 'Sander', 'Thea'].map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onSetMyPlayer(name)}
                  className={`px-2.5 py-1 rounded-lg font-black text-xs transition-all border ${
                    currentUserName?.toLowerCase() === name.toLowerCase()
                      ? 'bg-lime-400 text-zinc-950 border-lime-400 shadow-artistic-sm'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewUserModal(true)}
              className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>Ny testbruker</span>
            </button>

            <button
              type="button"
              onClick={handleGuestSession}
              className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-bold flex items-center gap-1 transition-all"
              title="Nullstiller gjesteøkt for å simulere en helt ny mobil"
            >
              <RotateCcw className="w-3 h-3 text-zinc-400" />
              <span>Ny gjesteøkt</span>
            </button>
          </div>
        </div>

        {/* Modal for adding custom test user */}
        {showNewUserModal && (
          <form
            onSubmit={handleCreateNewTestUser}
            className="w-full mt-4 p-3 bg-zinc-950 rounded-xl border border-zinc-700 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Skriv inn fornavn (f.eks. Mia, Tobias)..."
              value={customUserInput}
              onChange={(e) => setCustomUserInput(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 px-3 py-1.5 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400"
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-lime-400 text-zinc-950 rounded-lg font-black text-xs uppercase"
            >
              Velg
            </button>
            <button
              type="button"
              onClick={() => setShowNewUserModal(false)}
              className="px-2 py-1.5 text-zinc-400 hover:text-white text-xs"
            >
              Avbryt
            </button>
          </form>
        )}
      </div>

      {actionError && (
        <div className="mb-6 p-4 bg-rose-950/60 border-2 border-rose-800 rounded-2xl text-rose-200 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* 3 Main Activity Status Modules */}
      <div className="space-y-6">
        {/* 1. BORDTENNISCUP */}
        <div
          id="profile-tabletennis-card"
          className="bg-zinc-900 border-2 border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-artistic-md relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-lime-400/20 border border-lime-400/40 text-lime-400 flex items-center justify-center font-black">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-lime-400 block">
                  Aktivitet 1
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                  🏓 Bordtenniscup
                </h3>
              </div>
            </div>

            <div>
              {participant ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-400 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-artistic-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Registrert ✓
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 font-bold text-xs uppercase tracking-wider border border-zinc-700">
                  Ikke registrert
                </span>
              )}
            </div>
          </div>

          <div className="mt-4">
            {participant ? (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
                  <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-1">
                    Spillerstatus
                  </div>
                  <div className="text-lg font-black text-white">
                    {tableTennisStatus?.title || 'Påmeldt som ' + participant.firstName}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {tableTennisStatus?.details || 'Gjør deg klar for kamp!'}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onGoToTab('tabletennis')}
                    className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                  >
                    <span>Åpne Bordtenniscup & Kamper</span>
                    <ChevronRight className="w-4 h-4 text-lime-400" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <p className="text-sm text-zinc-300 max-w-md">
                  Bli med i den store turneringen! 2 bord, 21 poeng, walkovers og kåring av Lillesands råeste bordtennisspiller.
                </p>
                <button
                  id="btn-profile-register-tabletennis"
                  type="button"
                  disabled={loadingAction === 'tabletennis' || state.tournament?.status === 'completed'}
                  onClick={handleRegisterTableTennis}
                  className="px-5 py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-artistic-sm flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
                >
                  {loadingAction === 'tabletennis' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Melder på...
                    </>
                  ) : (
                    <>
                      <Trophy className="w-4 h-4 text-zinc-950" />
                      Meld meg på
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. POPCORN DIGITAL BONG */}
        <div
          id="profile-popcorn-card"
          className="bg-zinc-900 border-2 border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-artistic-md relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black">
                <Popcorn className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 block">
                  Aktivitet 2
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                  🍿 Gratis Popcorn
                </h3>
              </div>
            </div>

            <div>
              {userBong?.status === 'used' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 font-bold text-xs uppercase tracking-wider border border-zinc-700">
                  <CheckCircle2 className="w-4 h-4 text-lime-400" />
                  Bong #{userBong.number} – Hentet ✓
                </span>
              ) : userBong?.status === 'activated' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-artistic-sm animate-pulse">
                  <Sparkles className="w-4 h-4" />
                  Bong #{userBong.number} – Klar til henting
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 font-bold text-xs uppercase tracking-wider border border-zinc-700">
                  Ingen bong
                </span>
              )}
            </div>
          </div>

          <div className="mt-4">
            {userBong ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-4">
                  <div className="px-5 py-2.5 bg-amber-500 text-zinc-950 rounded-xl font-black text-2xl font-mono shadow-artistic-sm">
                    #{userBong.number}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">
                      {userBong.status === 'used' ? 'Popcorn hentet ut' : 'Klar for henting i kiosken'}
                    </h4>
                    <p className="text-xs text-zinc-400">
                      {userBong.status === 'used'
                        ? `Bong #${userBong.number} er allerede levert ut til deg.`
                        : `Vis nummer #${userBong.number} til personalet i kiosken for å få ditt beger.`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onGoToTab('kiosk')}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Vis i kiosken
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <p className="text-sm text-zinc-300 max-w-md">
                  De første 100 som trykker får gratis nypoppet popcorn i kiosken. Bong tildeles i sekvensiell rekkefølge.
                </p>
                <button
                  id="btn-profile-claim-popcorn"
                  type="button"
                  disabled={loadingAction === 'popcorn'}
                  onClick={handleClaimPopcorn}
                  className="px-5 py-3 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-artistic-sm flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
                >
                  {loadingAction === 'popcorn' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Henter bong...
                    </>
                  ) : (
                    <>
                      <Popcorn className="w-4 h-4 text-zinc-950" />
                      Ta mot popcorn
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3. UNGDOMSALPHA */}
        <div
          id="profile-alpha-card"
          className="bg-zinc-900 border-2 border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-artistic-md relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-400/20 border border-sky-400/40 text-sky-400 flex items-center justify-center font-black">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-sky-400 block">
                  Aktivitet 3
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                  ❤️ UngdomsAlpha
                </h3>
              </div>
            </div>

            <div>
              {alphaInterest ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-400 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-artistic-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Jeg er interessert ✓
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 font-bold text-xs uppercase tracking-wider border border-zinc-700">
                  Ikke registrert interesse
                </span>
              )}
            </div>
          </div>

          <div className="mt-4">
            {alphaInterest ? (
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-1">
                    Status
                  </div>
                  <h4 className="text-base font-black text-white">
                    Takk for interessen, {alphaInterest.firstName}!
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Oppstart: Fredag 25. september kl. 19:00 i Lillesand. Gratis mat, filmer og gode samtaler helt uten press.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToTab('alpha')}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                >
                  Les mer om kurset
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <p className="text-sm text-zinc-300 max-w-md">
                  Et trygt og morsomt sted for å utforske livet, tro og mening over gratis god mat og filmklipp. Helt uforpliktende!
                </p>
                <button
                  id="btn-profile-interest-alpha"
                  type="button"
                  disabled={loadingAction === 'alpha'}
                  onClick={handleRegisterAlpha}
                  className="px-5 py-3 bg-sky-400 hover:bg-sky-300 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-artistic-sm flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
                >
                  {loadingAction === 'alpha' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registrerer...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-zinc-950" />
                      Jeg er interessert
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
