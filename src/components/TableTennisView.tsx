import React, { useState } from 'react';
import { Trophy, UserPlus, Zap, Clock, Users, ChevronRight, AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';
import { AppState, Participant, Match } from '../types';
import { BracketView } from './BracketView';
import { calculateTournamentStats } from '../lib/tournament';

interface TableTennisViewProps {
  state: AppState;
  myPlayerName: string | null;
  onSetMyPlayer: (name: string | null) => void;
  onRegister: (firstName: string) => Promise<void>;
  onGoToAdmin: () => void;
}

export const TableTennisView: React.FC<TableTennisViewProps> = ({
  state,
  myPlayerName,
  onSetMyPlayer,
  onRegister,
  onGoToAdmin,
}) => {
  const [nameInput, setNameInput] = useState(myPlayerName || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    if (myPlayerName) {
      setNameInput(myPlayerName);
    }
  }, [myPlayerName]);

  const { tournament } = state;
  const isRegistrationOpen = tournament.status === 'registration';
  const isTournamentActive = tournament.status === 'active' || tournament.status === 'completed';

  const stats = calculateTournamentStats(tournament.matches, tournament.estimatedMinutesPerMatch);

  const isAlreadyRegistered = Boolean(
    myPlayerName &&
    tournament.participants.some(
      (p) => p.firstName.toLowerCase() === myPlayerName.toLowerCase()
    )
  );

  // Active matches on tables
  const table1Match = tournament.matches.find((m) => m.tableNumber === 1 && m.status !== 'completed');
  const table2Match = tournament.matches.find((m) => m.tableNumber === 2 && m.status !== 'completed');

  // Handle player registration
  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    setIsSubmitting(true);
    setFeedbackMsg(null);
    try {
      await onRegister(nameInput.trim());
      onSetMyPlayer(nameInput.trim());
      setFeedbackMsg({
        type: 'success',
        text: `Du er nå påmeldt bordtenniscupen! Følg med her for å se når du skal spille.`,
      });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Kunne ikke melde på.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine user's current status if myPlayerName is set
  const myCurrentStatus = () => {
    if (!myPlayerName) return null;
    const nameLower = myPlayerName.toLowerCase();

    // Find participant object
    const isRegistered = tournament.participants.some(
      (p) => p.firstName.toLowerCase() === nameLower
    );

    if (!isRegistered) {
      return {
        status: 'not_registered',
        title: 'Ikke funnet i deltakerlisten',
        description: 'Registrer deg nedenfor for å bli med i cupen!',
      };
    }

    if (tournament.status === 'registration') {
      return {
        status: 'registered_waiting',
        title: `Du er påmeldt som "${myPlayerName}"!`,
        description: `Trekningen skjer ved turneringsstart kl. 18:45. Gjør deg klar med racketen!`,
      };
    }

    // Check if player won the entire tournament
    if (tournament.winner && tournament.winner.firstName.toLowerCase() === nameLower) {
      return {
        status: 'champion',
        title: `🏆 GRATULERER! DU VANT BORDTENNISCUPEN! 🏆`,
        description: `Du spilte deg gjennom hele cupen og tok seieren i finalen!`,
      };
    }

    // Find player's current active or upcoming match
    const myMatches = tournament.matches.filter(
      (m) =>
        (m.playerA && m.playerA.firstName.toLowerCase() === nameLower) ||
        (m.playerB && m.playerB.firstName.toLowerCase() === nameLower)
    );

    // Look for in_progress match
    const activeMatch = myMatches.find((m) => m.status === 'in_progress');
    if (activeMatch) {
      const opponent =
        activeMatch.playerA?.firstName.toLowerCase() === nameLower
          ? activeMatch.playerB?.firstName
          : activeMatch.playerA?.firstName;

      return {
        status: 'playing_now',
        title: `🚨 DIN KAMP SPILLES NÅ!`,
        description: `Gå til BORD ${activeMatch.tableNumber || 1}! Du spiller mot ${opponent || 'motstander'}!`,
        table: activeMatch.tableNumber,
      };
    }

    // Look for ready match on table
    const readyOnTable = myMatches.find((m) => m.status === 'ready' && m.tableNumber);
    if (readyOnTable) {
      const opponent =
        readyOnTable.playerA?.firstName.toLowerCase() === nameLower
          ? readyOnTable.playerB?.firstName
          : readyOnTable.playerA?.firstName;

      return {
        status: 'ready_table',
        title: `🔔 DU ER NESTE PÅ BORD ${readyOnTable.tableNumber}!`,
        description: `Gjør deg klar ved Bord ${readyOnTable.tableNumber}. Motstander: ${opponent || 'motstander'}.`,
        table: readyOnTable.tableNumber,
      };
    }

    // Look for upcoming match waiting in queue
    const waitingMatch = myMatches.find(
      (m) => m.status === 'ready' || (m.status === 'not_ready' && !m.winnerId)
    );
    if (waitingMatch) {
      const opponent =
        waitingMatch.playerA?.firstName.toLowerCase() === nameLower
          ? waitingMatch.playerB?.firstName
          : waitingMatch.playerA?.firstName;

      return {
        status: 'in_queue',
        title: `Du er i ${waitingMatch.roundName}!`,
        description: opponent
          ? `Du skal møte ${opponent}. Venter på ledig bord.`
          : 'Venter på at motstanderens forrige kamp blir ferdig.',
      };
    }

    // Check if knocked out
    const lostMatch = myMatches.find((m) => m.winnerId && m.status === 'completed');
    if (lostMatch) {
      return {
        status: 'eliminated',
        title: 'Takk for god innsats!',
        description: `Du ble slått ut i ${lostMatch.roundName}. Nyt stemningen, hei på vennene dine og stikk innom Mario Kart loungen!`,
      };
    }

    return null;
  };

  const userStatus = myCurrentStatus();

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      {/* Title & Intro Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-lime-400 text-zinc-950 text-xs font-black uppercase tracking-wider mb-2 shadow-artistic-sm -rotate-1">
            <Trophy className="w-3.5 h-3.5" />
            Lillesand United Hovedcup
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight">
            Bordtennis<span className="text-lime-400">cup</span>
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base mt-1 font-medium">
            Kampstart kl. 18:45 • Semifinaler/finale kl. 22:00 • Premieutdeling kl. 22:30 • 2 bord • Først til 21 poeng
          </p>
        </div>

        {/* Quick actions & Admin Link */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs text-zinc-500 block font-bold uppercase tracking-wider">Status:</span>
            <span className="text-sm font-black text-lime-400 uppercase">
              {tournament.status === 'registration'
                ? '🟢 Påmelding åpen'
                : tournament.status === 'active'
                ? '⚡ Turnering pågår'
                : '🏆 Turnering fullført'}
            </span>
          </div>

          <button
            onClick={onGoToAdmin}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border-2 border-zinc-800 text-xs font-black uppercase tracking-wider text-zinc-300 hover:text-white hover:border-zinc-700 flex items-center gap-1.5 transition-colors shadow-artistic-sm"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Dommer / Admin
          </button>
        </div>
      </div>

      {/* PERSONAL LIVE NOTIFICATION BANNER ("Følg med på når det er din tur") */}
      {userStatus && (
        <div
          id="user-status-card"
          className={`mb-6 p-5 sm:p-6 rounded-3xl border-2 transition-all shadow-artistic-md ${
            userStatus.status === 'playing_now'
              ? 'bg-lime-400 text-zinc-950 border-zinc-950 shadow-artistic-md -rotate-0.5'
              : userStatus.status === 'ready_table'
              ? 'bg-gradient-to-r from-orange-500/20 via-zinc-900 to-lime-400/20 border-lime-400 text-white'
              : userStatus.status === 'champion'
              ? 'bg-gradient-to-r from-amber-400/30 to-yellow-500/30 border-amber-400 text-white'
              : 'bg-zinc-900 border-zinc-800 text-zinc-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-black shadow-artistic-sm ${
                  userStatus.status === 'playing_now'
                    ? 'bg-zinc-950 text-lime-400'
                    : 'bg-zinc-950 text-lime-400 border-2 border-zinc-800'
                }`}
              >
                {userStatus.status === 'playing_now' ? '🏓' : <Zap className="w-7 h-7" />}
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider opacity-85 block">
                  Din personlige kampstatus
                </span>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
                  {userStatus.title}
                </h3>
                <p className="text-xs sm:text-sm opacity-90 mt-0.5 font-medium">
                  {userStatus.description}
                </p>
              </div>
            </div>

            {/* Change player switcher */}
            <button
              onClick={() => onSetMyPlayer(null)}
              className="text-xs font-black uppercase tracking-wider underline self-end sm:self-center shrink-0 opacity-80 hover:opacity-100"
            >
              Bytt spiller
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE TABLES SHOWCASE (BORD 1 & BORD 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {/* BORD 1 */}
        <div
          id="table-1-card"
          className="rounded-3xl bg-zinc-900 border-2 border-zinc-800 p-6 shadow-artistic-md relative overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-lime-400 animate-ping" />
              <h3 className="font-black text-white text-xl tracking-tight uppercase">
                Bord 1
              </h3>
            </div>
            <span
              className={`text-xs font-black px-3 py-1 rounded-xl uppercase tracking-wider shadow-artistic-sm ${
                table1Match && table1Match.status === 'in_progress'
                  ? 'bg-lime-400 text-zinc-950 animate-pulse'
                  : table1Match
                  ? 'bg-orange-500 text-zinc-950'
                  : 'bg-zinc-950 text-zinc-500 border-2 border-zinc-800'
              }`}
            >
              {table1Match && table1Match.status === 'in_progress'
                ? 'Kamp pågår'
                : table1Match
                ? 'Klar for kamp'
                : 'Ledig'}
            </span>
          </div>

          {table1Match ? (
            <div className="p-5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-artistic-sm">
              <div className="text-xs text-zinc-400 mb-2 font-black uppercase tracking-wider">
                {table1Match.roundName}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-base sm:text-xl font-black text-white truncate max-w-[40%]">
                  {table1Match.playerA?.firstName || 'Spiller 1'}
                </div>
                <div className="text-xl sm:text-3xl font-black text-lime-400 font-mono px-3">
                  {table1Match.scoreA !== null ? table1Match.scoreA : '0'} :{' '}
                  {table1Match.scoreB !== null ? table1Match.scoreB : '0'}
                </div>
                <div className="text-base sm:text-xl font-black text-white truncate max-w-[40%] text-right">
                  {table1Match.playerB?.firstName || 'Spiller 2'}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs font-bold text-zinc-500 border-2 border-dashed border-zinc-800 rounded-2xl">
              Venter på neste kamp i køen...
            </div>
          )}
        </div>

        {/* BORD 2 */}
        <div
          id="table-2-card"
          className="rounded-3xl bg-zinc-900 border-2 border-zinc-800 p-6 shadow-artistic-md relative overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-400 animate-ping" />
              <h3 className="font-black text-white text-xl tracking-tight uppercase">
                Bord 2
              </h3>
            </div>
            <span
              className={`text-xs font-black px-3 py-1 rounded-xl uppercase tracking-wider shadow-artistic-sm ${
                table2Match && table2Match.status === 'in_progress'
                  ? 'bg-sky-400 text-zinc-950 animate-pulse'
                  : table2Match
                  ? 'bg-orange-500 text-zinc-950'
                  : 'bg-zinc-950 text-zinc-500 border-2 border-zinc-800'
              }`}
            >
              {table2Match && table2Match.status === 'in_progress'
                ? 'Kamp pågår'
                : table2Match
                ? 'Klar for kamp'
                : 'Ledig'}
            </span>
          </div>

          {table2Match ? (
            <div className="p-5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-artistic-sm">
              <div className="text-xs text-zinc-400 mb-2 font-black uppercase tracking-wider">
                {table2Match.roundName}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-base sm:text-xl font-black text-white truncate max-w-[40%]">
                  {table2Match.playerA?.firstName || 'Spiller 1'}
                </div>
                <div className="text-xl sm:text-3xl font-black text-sky-400 font-mono px-3">
                  {table2Match.scoreA !== null ? table2Match.scoreA : '0'} :{' '}
                  {table2Match.scoreB !== null ? table2Match.scoreB : '0'}
                </div>
                <div className="text-base sm:text-xl font-black text-white truncate max-w-[40%] text-right">
                  {table2Match.playerB?.firstName || 'Spiller 2'}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs font-bold text-zinc-500 border-2 border-dashed border-zinc-800 rounded-2xl">
              Venter på neste kamp i køen...
            </div>
          )}
        </div>
      </div>

      {/* REGISTRATION FORM SECTION (WHEN REGISTRATION IS ACTIVE) */}
      {isRegistrationOpen && (
        <div className="mb-8 p-6 sm:p-8 rounded-3xl bg-zinc-900 border-2 border-lime-400 shadow-artistic-lime">
          <div className="max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-2">
              Meld deg på turneringen ved ankomst!
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mb-5 font-medium">
              Ingen passord eller innlogging nødvendig. Skriv inn fornavnet ditt så er du med i den tilfeldige trekningen!
            </p>

            <form onSubmit={handleSubmitRegistration} className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                id="player-firstname-input"
                type="text"
                placeholder="Ditt fornavn (f.eks. Jonas)"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={30}
                required
                className="flex-1 px-4 py-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400 text-sm font-bold shadow-artistic-sm"
              />
              <button
                id="submit-registration-btn"
                type="submit"
                disabled={isSubmitting || !nameInput.trim()}
                className={`px-6 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5 shrink-0 shadow-artistic-sm ${
                  isAlreadyRegistered
                    ? 'bg-lime-400/80 text-zinc-950 border-2 border-lime-400'
                    : 'bg-lime-400 hover:bg-lime-300 text-zinc-950'
                }`}
              >
                {isAlreadyRegistered ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Påmeldt ✓</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>{isSubmitting ? 'Registrerer...' : 'Bli med!'}</span>
                  </>
                )}
              </button>
            </form>

            {feedbackMsg && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-artistic-sm ${
                  feedbackMsg.type === 'success'
                    ? 'bg-lime-400/20 text-lime-300 border-2 border-lime-400/40'
                    : 'bg-rose-500/20 text-rose-300 border-2 border-rose-500/40'
                }`}
              >
                {feedbackMsg.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-lime-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{feedbackMsg.text}</span>
              </div>
            )}
          </div>

          {/* Registered Players Pill Cloud - NON-CLICKABLE, INFORMATIONAL ONLY */}
          <div className="mt-6 pt-5 border-t-2 border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-lime-400" />
                Påmeldte spillere ({tournament.participants.length}):
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                Trekning foretas av dommer/admin
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {tournament.participants.map((p) => {
                const isMe = myPlayerName && myPlayerName.toLowerCase() === p.firstName.toLowerCase();
                return (
                  <span
                    key={p.id}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 shadow-artistic-sm select-none transition-colors ${
                      isMe
                        ? 'bg-lime-400 text-zinc-950 border-lime-400 ring-2 ring-lime-400/30'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                    }`}
                  >
                    {p.firstName}
                    {isMe && ' (Deg)'}
                  </span>
                );
              })}
              {tournament.participants.length === 0 && (
                <span className="text-xs text-zinc-500 italic">
                  Ingen deltakere registrert enda. Vær den første!
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULL BRACKET (CUP-TRE) */}
      <div className="mb-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Cup-tre & Resultater
            </h2>
            <p className="text-xs text-zinc-400 font-medium">
              Følg avansementet hele veien fra innledende runder til finalen
            </p>
          </div>

          {/* Tournament progress stats */}
          {tournament.matches.length > 0 && (
            <div className="flex items-center gap-3 text-xs bg-zinc-900 px-4 py-2 rounded-xl border-2 border-zinc-800 shadow-artistic-sm">
              <span className="text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                Ferdige kamper: <strong className="text-white">{stats.completedMatches}</strong> / {stats.totalMatches}
              </span>
              <span className="text-zinc-700">•</span>
              <span className="text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                Gjenstående: <strong className="text-lime-400">{stats.remainingMatches}</strong>
              </span>
            </div>
          )}
        </div>

        <BracketView
          matches={tournament.matches}
          winner={tournament.winner}
          myPlayerName={myPlayerName}
        />
      </div>

      {/* OFFICIAL TOURNAMENT RULES SUMMARY */}
      <div className="rounded-3xl p-6 sm:p-8 bg-zinc-900 border-2 border-zinc-800 text-xs sm:text-sm text-zinc-400 shadow-artistic-md">
        <h4 className="text-white font-black text-base uppercase tracking-tight mb-4 flex items-center gap-2">
          <span>📋</span> Offisielle regler for Lillesand United Bordtenniscup:
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-artistic-sm">
            <strong className="text-white font-black text-sm block mb-1 uppercase tracking-wide">🏓 1 Game til 21 poeng</strong>
            <span className="font-medium text-zinc-400">Hver kamp avgjøres i ett enkelt game. Første spiller til 21 poeng vinner kampen.</span>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-artistic-sm">
            <strong className="text-white font-black text-sm block mb-1 uppercase tracking-wide">🔁 5 server hver</strong>
            <span className="font-medium text-zinc-400">Spillerne bytter på å serve etter hver 5. ball.</span>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-artistic-sm">
            <strong className="text-white font-black text-sm block mb-1 uppercase tracking-wide">⚡ 2 poengs ledelse ved 20–20</strong>
            <span className="font-medium text-zinc-400">Dersom stillingen blir 20–20, spilles det videre til en spiller leder med to poeng (f.eks. 22–20, 23–21).</span>
          </div>
        </div>
      </div>
    </div>
  );
};
