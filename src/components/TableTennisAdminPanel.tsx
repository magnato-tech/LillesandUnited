import React, { useMemo, useState } from 'react';
import { Play, RotateCcw, RefreshCw, Trophy, Check, AlertTriangle, Clock, Maximize2 } from 'lucide-react';
import { Match, Tournament } from '../types';
import {
  calculateTournamentStats,
  getCapacityInfo,
  getNextCapacityTier,
  resolveBracketCapacity,
} from '../lib/tournament';

function RoundStructurePreview({ capacity }: { capacity: 16 | 32 | 64 }) {
  const steps: { label: string; matches: number }[] = [];
  let matches = capacity / 2;
  let round = 1;
  const totalRounds = Math.log2(capacity);

  while (matches >= 1) {
    const diff = totalRounds - round;
    let label = `Runde ${round}`;
    if (diff === 0) label = 'Finale';
    else if (diff === 1) label = 'Semifinale';
    else if (diff === 2) label = 'Kvartfinale';
    else if (diff === 3) label = 'Åttedelsfinale';

    steps.push({ label, matches });
    matches /= 2;
    round++;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-zinc-500">
      {steps.map((step, idx) => (
        <React.Fragment key={step.label}>
          <span className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400">
            {step.label}: <strong className="text-zinc-300">{step.matches}</strong>
          </span>
          {idx < steps.length - 1 && <span className="text-zinc-600">→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function playerLabel(player: Match['playerA']): string {
  return player?.displayId || player?.firstName || 'TBD';
}

interface TableTennisAdminPanelProps {
  tournament: Tournament;
  onRefresh: () => void;
  onStartTournament: () => void;
  onReopenRegistration: () => void;
  onReDraw?: () => void;
  onAssignTable: (matchId: string, tableNumber: 1 | 2 | null, status?: string) => void;
  onOpenScoreModal: (match: Match) => void;
  onRequestResetMatch?: (match: Match) => void;
  onExpandCapacity?: (capacity: 32 | 64) => void | Promise<void>;
}

export const TableTennisAdminPanel: React.FC<TableTennisAdminPanelProps> = ({
  tournament,
  onRefresh,
  onStartTournament,
  onReopenRegistration,
  onReDraw,
  onAssignTable,
  onOpenScoreModal,
  onRequestResetMatch,
  onExpandCapacity,
}) => {
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showExpandPanel, setShowExpandPanel] = useState(false);

  const bracketCapacity = resolveBracketCapacity(
    tournament.participants.length,
    tournament.bracketCapacity ?? 16
  );
  const capacityInfo = getCapacityInfo(bracketCapacity);
  const nextCapacityTier = getNextCapacityTier(bracketCapacity);

  const stats = calculateTournamentStats(tournament.matches, tournament.estimatedMinutesPerMatch);

  const completedMatches = useMemo(
    () =>
      tournament.matches
        .filter((m) => m.status === 'completed' || m.status === 'walkover')
        .sort((a, b) => {
          if (a.round !== b.round) return a.round - b.round;
          return a.position - b.position;
        }),
    [tournament.matches]
  );

  const upcomingMatches = useMemo(
    () =>
      tournament.matches
        .filter(
          (m) =>
            m.status !== 'completed' &&
            m.status !== 'walkover' &&
            m.playerA &&
            m.playerB &&
            !m.isWalkover
        )
        .sort((a, b) => {
          if (a.round !== b.round) return a.round - b.round;
          return a.position - b.position;
        }),
    [tournament.matches]
  );

  const visibleCompleted = showAllCompleted ? completedMatches : completedMatches.slice(-10);
  const visibleUpcoming = showAllUpcoming ? upcomingMatches : upcomingMatches.slice(0, 10);

  const finalMatch = tournament.matches.find((m) => m.roundName === 'Finale') || null;
  const finalWinner = tournament.winner;

  const tableMatches = [1, 2].map((tableNum) =>
    tournament.matches.find(
      (m) => m.tableNumber === tableNum && m.status !== 'completed' && m.status !== 'walkover'
    )
  );

  const isTableOccupied = (tableNum: 1 | 2) =>
    tournament.matches.some((m) => m.tableNumber === tableNum && m.status === 'in_progress');

  return (
    <div className="space-y-6">
      {/* Operator header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-lime-400 block mb-1">
            Operatørflate
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">Admin</h2>
          <p className="text-sm text-zinc-400 font-medium mt-1 max-w-xl">
            Registrer resultater, følg med på bordene og se hvem som er klare for finale.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="self-start px-4 py-2.5 rounded-2xl bg-zinc-900 border-2 border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-artistic-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Oppdater
        </button>
      </div>

      {/* Cup capacity — standard 16, expandable to 32 / 64 */}
      {tournament.status === 'registration' && (
        <div className="p-5 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-lime-400 block mb-1">
                Cup-størrelse
              </span>
              <h3 className="text-lg font-black text-white uppercase">
                {bracketCapacity} spillere
                <span className="text-zinc-500 font-bold normal-case text-sm ml-2">
                  ({capacityInfo.round1Matches} kamper i runde 1)
                </span>
              </h3>
              <p className="text-xs text-zinc-400 font-medium mt-1">
                {tournament.participants.length} / {bracketCapacity} påmeldte
                {tournament.participants.length < bracketCapacity && (
                  <span className="text-zinc-600">
                    {' '}
                    · {bracketCapacity - tournament.participants.length} ledige plasser
                  </span>
                )}
              </p>
              <p className="text-[10px] text-zinc-500 font-medium mt-1">
                Minst {bracketCapacity / 2} spillere for å starte cupen.
              </p>
            </div>
            {nextCapacityTier && onExpandCapacity && !showExpandPanel && (
              <button
                type="button"
                onClick={() => setShowExpandPanel(true)}
                className="self-start px-4 py-2.5 rounded-2xl bg-zinc-950 border-2 border-lime-400/40 hover:border-lime-400 text-lime-300 text-xs font-black uppercase tracking-wider flex items-center gap-2"
              >
                <Maximize2 className="w-4 h-4" />
                Utvid cup
              </button>
            )}
          </div>

          <RoundStructurePreview capacity={bracketCapacity} />

          {showExpandPanel && nextCapacityTier && onExpandCapacity && (
            <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-lime-400/30 space-y-3">
              <p className="text-sm font-bold text-white">
                Utvid til <strong className="text-lime-400">{nextCapacityTier} spillere</strong>
              </p>
              <p className="text-xs text-zinc-400 font-medium">
                Runde 1 går fra {capacityInfo.round1Matches} til {nextCapacityTier / 2} kamper.
                Neste runde halveres som vanlig helt til finalen.
              </p>
              <RoundStructurePreview capacity={nextCapacityTier} />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await onExpandCapacity(nextCapacityTier);
                    setShowExpandPanel(false);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-black uppercase tracking-wider"
                >
                  Bekreft utvidelse til {nextCapacityTier}
                </button>
                <button
                  type="button"
                  onClick={() => setShowExpandPanel(false)}
                  className="px-4 py-2.5 rounded-2xl bg-zinc-900 border-2 border-zinc-800 text-zinc-400 text-xs font-black uppercase tracking-wider"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}

          {bracketCapacity === 64 && (
            <p className="text-[10px] text-zinc-500 font-medium">
              Maksimal cup-størrelse (64 spillere, 32 kamper i runde 1).
            </p>
          )}
        </div>
      )}

      {/* Tournament control */}
      <div className="p-4 rounded-2xl bg-zinc-900 border-2 border-zinc-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase text-zinc-500">Status:</span>
            <strong className="text-sm font-black text-lime-400 uppercase">
              {tournament.status === 'registration'
                ? 'Påmelding pågår'
                : tournament.status === 'active'
                ? 'Turnering pågår'
                : 'Fullført'}
            </strong>
            <span className="text-zinc-600">•</span>
          <span className="text-xs text-zinc-400 font-medium">
            {tournament.participants.length} spillere · {capacityInfo.round1Matches} kamper r1 ·{' '}
            {stats.totalMatches} kamper · {stats.completedMatches} ferdige
          </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {tournament.status === 'registration' ? (
              <button
                type="button"
                onClick={onStartTournament}
                disabled={tournament.participants.length < 2}
                className="px-5 py-2.5 rounded-2xl bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-zinc-950 text-xs font-black uppercase tracking-wider flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Steng påmelding & Start cup
              </button>
            ) : (
              <>
                {onReDraw && tournament.participants.length >= 2 && (
                  <button
                    type="button"
                    onClick={onReDraw}
                    className="px-4 py-2.5 rounded-2xl bg-zinc-950 border-2 border-lime-400/40 hover:border-lime-400 text-lime-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Ny trekning
                  </button>
                )}
                <button
                  type="button"
                  onClick={onReopenRegistration}
                  className="px-4 py-2.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-zinc-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Gjenåpne påmelding
                </button>
              </>
            )}
          </div>
        </div>

        {tournament.status !== 'registration' && stats.remainingMatches > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Estimert resttid: ~{stats.estimatedRemainingMinutes} min
            </span>
            {stats.isOverCapacity && (
              <span className="text-amber-300 flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/30 px-2.5 py-1 rounded-lg font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Over 2 timer — vurder å øke tempo eller redusere antall kamper
              </span>
            )}
          </div>
        )}
      </div>

      {/* Active tables */}
      {tournament.matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tableMatches.map((match, idx) => {
            const tableNum = (idx + 1) as 1 | 2;
            const statusLabel =
              match?.status === 'in_progress'
                ? 'I gang'
                : match?.status === 'ready'
                ? 'Klar'
                : match
                ? 'Venter'
                : null;

            return (
              <div
                key={tableNum}
                className="p-5 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        tableNum === 1 ? 'bg-lime-400' : 'bg-sky-400'
                      } ${match?.status === 'in_progress' ? 'animate-pulse' : ''}`}
                    />
                    Bord {tableNum}
                  </h3>
                  {match && statusLabel && (
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${
                        match.status === 'in_progress'
                          ? 'bg-lime-400/20 text-lime-300 border-lime-400/40'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  )}
                </div>
                {match ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800">
                      <span className="text-[10px] font-black uppercase text-lime-400 block mb-2">
                        {match.roundName}
                      </span>
                      <div className="text-sm font-black text-white">
                        {playerLabel(match.playerA)}{' '}
                        {match.scoreA !== null && match.scoreB !== null && (
                          <span className="text-lime-400 font-mono">
                            {match.scoreA}–{match.scoreB}
                          </span>
                        )}
                        <span className="text-zinc-600 mx-1">vs</span>
                        {playerLabel(match.playerB)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenScoreModal(match)}
                        className="flex-1 py-2.5 rounded-2xl bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-black uppercase tracking-wider"
                      >
                        Døm kamp
                      </button>
                      <button
                        type="button"
                        onClick={() => onAssignTable(match.id, null)}
                        className="px-3 py-2.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-zinc-400 hover:text-white text-[10px] font-black uppercase"
                        title="Frigjør bordet"
                      >
                        Frigjør
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">Ingen aktiv kamp på dette bordet.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Finale card */}
      {(finalWinner || (finalMatch && (finalMatch.status === 'completed' || finalMatch.status === 'walkover'))) && (
        <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-lime-400/40 shadow-artistic-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-400 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-zinc-950" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-lime-400 block">Finale</span>
              <h3 className="text-xl font-black text-white">
                Vinner:{' '}
                <span className="text-lime-400">
                  {finalWinner?.displayId || finalWinner?.firstName || 'Ukjent'}
                </span>
              </h3>
            </div>
          </div>

          {finalMatch && finalMatch.playerA && finalMatch.playerB && (
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
              <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-center">
                <span className="text-[10px] font-black uppercase text-zinc-500 block mb-1">Plass A</span>
                <span
                  className={`text-lg font-black ${
                    finalMatch.winnerId === finalMatch.playerA.id ? 'text-lime-400' : 'text-white'
                  }`}
                >
                  {playerLabel(finalMatch.playerA)}
                </span>
              </div>
              <span className="self-center text-xs font-black text-zinc-600 uppercase">vs</span>
              <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-center">
                <span className="text-[10px] font-black uppercase text-zinc-500 block mb-1">Plass B</span>
                <span
                  className={`text-lg font-black ${
                    finalMatch.winnerId === finalMatch.playerB.id ? 'text-lime-400' : 'text-white'
                  }`}
                >
                  {playerLabel(finalMatch.playerB)}
                </span>
                {finalMatch.winnerId === finalMatch.playerB?.id && (
                  <span className="mt-2 inline-block px-2 py-1 rounded-lg bg-lime-400 text-zinc-950 text-[10px] font-black uppercase">
                    ✓ Vinner
                  </span>
                )}
              </div>
            </div>
          )}

          {finalMatch && !finalMatch.isWalkover && finalMatch.playerA && finalMatch.playerB && (
            <button
              type="button"
              onClick={() => onOpenScoreModal(finalMatch)}
              className="w-full py-3 rounded-2xl bg-zinc-950 border-2 border-zinc-800 hover:border-lime-400/50 text-zinc-300 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Korriger finaleresultat
            </button>
          )}
        </div>
      )}

      {/* Upcoming / ready matches */}
      {upcomingMatches.length > 0 && (
        <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-white uppercase">
              Kommende kamper ({upcomingMatches.length})
            </h3>
            {upcomingMatches.length > 10 && (
              <button
                type="button"
                onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                className="text-[10px] font-black uppercase text-lime-400 hover:text-lime-300"
              >
                {showAllUpcoming ? 'Vis færre' : 'Vis alle'}
              </button>
            )}
          </div>
          {visibleUpcoming.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <span className="text-[10px] font-black uppercase text-lime-400 block mb-1">
                  {m.roundName}
                </span>
                <span className="text-sm font-black text-white">
                  {playerLabel(m.playerA)} vs {playerLabel(m.playerB)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onAssignTable(m.id, 1, 'in_progress')}
                  disabled={isTableOccupied(1)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] font-black uppercase disabled:opacity-40"
                >
                  Bord 1
                </button>
                <button
                  type="button"
                  onClick={() => onAssignTable(m.id, 2, 'in_progress')}
                  disabled={isTableOccupied(2)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] font-black uppercase disabled:opacity-40"
                >
                  Bord 2
                </button>
                <button
                  type="button"
                  onClick={() => onOpenScoreModal(m)}
                  className="px-3 py-1.5 rounded-xl bg-lime-400 text-zinc-950 text-[10px] font-black uppercase"
                >
                  Sett score
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed matches */}
      <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-lime-400 block">
              Fullførte kamper
            </span>
            <h3 className="text-xl font-black text-white">Slik ble det</h3>
          </div>
          {completedMatches.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAllCompleted(!showAllCompleted)}
              className="text-[10px] font-black uppercase text-lime-400 hover:text-lime-300"
            >
              {showAllCompleted ? 'Vis siste 10' : `Vis alle (${completedMatches.length})`}
            </button>
          )}
        </div>

        {completedMatches.length === 0 ? (
          <p className="text-xs text-zinc-500 font-medium py-4 text-center">
            Ingen fullførte kamper ennå.
          </p>
        ) : (
          <div className="space-y-2">
            {visibleCompleted.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] font-black uppercase bg-zinc-900 text-zinc-400 px-2 py-1 rounded-lg border border-zinc-800">
                    {m.roundName}
                  </span>
                  <span className="text-sm font-black text-white">
                    <span className={m.winnerId === m.playerA?.id ? 'text-lime-400' : ''}>
                      {playerLabel(m.playerA)} {m.scoreA ?? 0}
                    </span>
                    <span className="text-zinc-600 mx-2">—</span>
                    <span className={m.winnerId === m.playerB?.id ? 'text-lime-400' : ''}>
                      {playerLabel(m.playerB)} {m.scoreB ?? 0}
                    </span>
                  </span>
                  {m.isWalkover && (
                    <span className="text-[10px] bg-amber-400 text-zinc-950 font-black px-2 py-0.5 rounded">
                      Walkover
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!m.isWalkover && m.playerA && m.playerB && (
                    <button
                      type="button"
                      onClick={() => onOpenScoreModal(m)}
                      className="text-xs font-black uppercase text-zinc-400 hover:text-lime-400"
                    >
                      Korriger →
                    </button>
                  )}
                  {onRequestResetMatch && (
                    <button
                      type="button"
                      onClick={() => onRequestResetMatch(m)}
                      className="text-xs font-black uppercase text-rose-400 hover:text-rose-300"
                    >
                      Nullstill
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 border-t-2 border-zinc-800 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 rounded-xl bg-zinc-950 border-2 border-zinc-800 text-zinc-400 text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:text-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Oppdater data
          </button>
          <span className="text-xs text-zinc-500 font-medium flex items-center gap-1.5">
            <span>{tournament.participants.length} spillere</span>
            <span>•</span>
            <span>{stats.totalMatches} kamper</span>
            <span>•</span>
            <span>{stats.completedMatches} ferdige</span>
          </span>
        </div>
      </div>

      {tournament.matches.length === 0 && tournament.status === 'registration' && (
        <div className="p-8 rounded-3xl bg-zinc-900 border-2 border-dashed border-zinc-800 text-center">
          <p className="text-sm font-bold text-zinc-500">
            Ingen kamper ennå. Legg til deltakere og klikk «Steng påmelding & Start cup».
          </p>
        </div>
      )}
    </div>
  );
};

interface ScoreEntryModalProps {
  match: Match;
  scoreA: number;
  scoreB: number;
  actionError: string | null;
  correctionWarning: string | null;
  onScoreAChange: (value: number) => void;
  onScoreBChange: (value: number) => void;
  onClose: () => void;
  onSubmit: () => void;
  onConfirmCorrection: () => void;
  onWalkover?: (slot: 'A' | 'B') => void;
  onRequestReset?: () => void;
}

export const ScoreEntryModal: React.FC<ScoreEntryModalProps> = ({
  match,
  scoreA,
  scoreB,
  actionError,
  correctionWarning,
  onScoreAChange,
  onScoreBChange,
  onClose,
  onSubmit,
  onConfirmCorrection,
  onWalkover,
  onRequestReset,
}) => {
  const isCorrection = match.status === 'completed' || match.status === 'walkover';

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-zinc-900 border-2 border-zinc-700 p-6 sm:p-8 shadow-artistic-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-white">Registrer kampresultat</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white font-black"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end mb-6">
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 block mb-2 truncate">
              {playerLabel(match.playerA)}
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={scoreA}
              onChange={(e) => onScoreAChange(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white font-mono font-black text-3xl text-center focus:outline-none focus:border-lime-400"
            />
          </div>
          <span className="text-xs font-black text-zinc-600 uppercase pb-4">vs</span>
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 block mb-2 truncate text-right">
              {playerLabel(match.playerB)}
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={scoreB}
              onChange={(e) => onScoreBChange(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white font-mono font-black text-3xl text-center focus:outline-none focus:border-lime-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-[10px] font-bold text-zinc-500 self-center uppercase">Hurtigvalg:</span>
          {[
            [21, 18],
            [18, 21],
            [22, 20],
          ].map(([a, b]) => (
            <button
              key={`${a}-${b}`}
              type="button"
              onClick={() => {
                onScoreAChange(a);
                onScoreBChange(b);
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-black text-zinc-300"
            >
              {a} – {b}
            </button>
          ))}
        </div>

        {!isCorrection && onWalkover && match.playerA && match.playerB && (
          <div className="mb-6 p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 space-y-2">
            <span className="text-[10px] font-black uppercase text-zinc-500 block">Walkover</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onWalkover('A')}
                className="flex-1 py-2 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-200 text-[10px] font-black uppercase"
              >
                {playerLabel(match.playerA)} vinner WO
              </button>
              <button
                type="button"
                onClick={() => onWalkover('B')}
                className="flex-1 py-2 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-200 text-[10px] font-black uppercase"
              >
                {playerLabel(match.playerB)} vinner WO
              </button>
            </div>
          </div>
        )}

        {correctionWarning && (
          <div className="mb-4 p-4 rounded-2xl bg-rose-500/20 border-2 border-rose-500 text-xs text-rose-200">
            <strong className="font-black uppercase block mb-1">Advarsel</strong>
            <p className="mb-3">{correctionWarning}</p>
            <button
              type="button"
              onClick={onConfirmCorrection}
              className="px-4 py-2 rounded-xl bg-rose-500 text-zinc-950 font-black uppercase text-[10px]"
            >
              Bekreft og tilbakestill senere kamper
            </button>
          </div>
        )}

        {actionError && <p className="text-xs text-rose-400 font-bold mb-4">{actionError}</p>}

        <button
          type="button"
          onClick={onSubmit}
          className="w-full py-3.5 rounded-2xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2"
        >
          {isCorrection ? 'Lagre korrigering' : 'Lagre resultat'}
          <Check className="w-4 h-4" />
        </button>

        {isCorrection && onRequestReset && (
          <button
            type="button"
            onClick={onRequestReset}
            className="w-full mt-3 py-3 rounded-2xl bg-zinc-950 border-2 border-rose-500/50 text-rose-400 hover:bg-rose-500/10 font-black text-xs uppercase tracking-wider"
          >
            Nullstill resultat
          </button>
        )}
      </div>
    </div>
  );
};

interface ResetMatchConfirmModalProps {
  match: Match;
  warning?: string | null;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ResetMatchConfirmModal: React.FC<ResetMatchConfirmModalProps> = ({
  match,
  warning,
  loading = false,
  error,
  onCancel,
  onConfirm,
}) => {
  const scoreText =
    match.isWalkover || match.status === 'walkover'
      ? 'Walkover'
      : `${match.scoreA ?? 0} – ${match.scoreB ?? 0}`;

  return (
    <div className="fixed inset-0 z-[60] bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-zinc-900 border-2 border-rose-500/40 p-6 sm:p-8 shadow-artistic-md">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
              Nullstill kampresultat?
            </h2>
            <p className="text-xs text-zinc-400 font-medium mt-1">
              {match.roundName}: {playerLabel(match.playerA)} vs {playerLabel(match.playerB)}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 mb-4 text-center">
          <span className="text-[10px] font-black uppercase text-zinc-500 block mb-1">
            Nåværende resultat
          </span>
          <span className="text-2xl font-black text-white font-mono">{scoreText}</span>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed mb-4">
          Dette fjerner resultatet og setter kampen tilbake til «klar». Handlingen kan ikke angres.
        </p>

        {warning && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-xs text-amber-200">
            <strong className="font-black uppercase block mb-1">Advarsel</strong>
            {warning}
          </div>
        )}

        {error && <p className="text-xs text-rose-400 font-bold mb-4">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-zinc-300 font-black text-xs uppercase tracking-wider hover:text-white disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 text-zinc-950 font-black text-xs uppercase tracking-wider disabled:opacity-50"
          >
            {loading ? 'Nullstiller…' : 'Ja, nullstill'}
          </button>
        </div>
      </div>
    </div>
  );
};
