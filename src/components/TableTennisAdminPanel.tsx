import React, { useMemo, useState, useEffect } from 'react';
import { Play, RotateCcw, RefreshCw, Trophy, Check, AlertTriangle, Clock, Maximize2, Sliders, CheckCircle2 } from 'lucide-react';
import { Match, Tournament, TournamentFormatSettings, TargetPoints, WinMargin, NumberOfSets, TournamentStage } from '../types';
import {
  calculateTournamentStats,
  getCapacityInfo,
  getNextCapacityTier,
  resolveBracketCapacity,
  DEFAULT_FORMAT_SETTINGS,
  validateScore,
} from '../lib/tournament';
import { updateTournamentFormat } from '../services/api';

function RoundStructurePreview({ capacity }: { capacity: number }) {
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
  const [showFormatPanel, setShowFormatPanel] = useState(false);

  // Editable format configuration per stage
  const [formatDraft, setFormatDraft] = useState<TournamentFormatSettings>(() => ({
    regular: tournament.formatSettings?.regular || { ...DEFAULT_FORMAT_SETTINGS.regular },
    semifinal: tournament.formatSettings?.semifinal || { ...DEFAULT_FORMAT_SETTINGS.semifinal },
    final: tournament.formatSettings?.final || { ...DEFAULT_FORMAT_SETTINGS.final },
  }));

  // Editable match duration
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(
    tournament.estimatedMinutesPerMatch ?? 10
  );
  const [formatSaveLoading, setFormatSaveLoading] = useState(false);
  const [formatSaveSuccess, setFormatSaveSuccess] = useState(false);
  const [formatSaveError, setFormatSaveError] = useState<string | null>(null);

  // Keep state in sync with tournament updates
  useEffect(() => {
    if (tournament.formatSettings) {
      setFormatDraft({
        regular: { ...tournament.formatSettings.regular },
        semifinal: { ...tournament.formatSettings.semifinal },
        final: { ...tournament.formatSettings.final },
      });
    }
    if (tournament.estimatedMinutesPerMatch !== undefined) {
      setEstimatedMinutes(tournament.estimatedMinutesPerMatch);
    }
  }, [tournament.formatSettings, tournament.estimatedMinutesPerMatch]);

  const handleSaveFormat = async () => {
    setFormatSaveLoading(true);
    setFormatSaveError(null);
    try {
      await updateTournamentFormat(formatDraft, estimatedMinutes);
      setFormatSaveSuccess(true);
      setTimeout(() => setFormatSaveSuccess(false), 3000);
      onRefresh();
    } catch (err: any) {
      setFormatSaveError(err.message || 'Kunne ikke lagre format');
    } finally {
      setFormatSaveLoading(false);
    }
  };

  const handleMinutesChange = async (newMinutes: number) => {
    setEstimatedMinutes(newMinutes);
    try {
      await updateTournamentFormat(undefined, newMinutes);
      onRefresh();
    } catch {
      // silently ignored or picked up on next refresh
    }
  };

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

      {/* Flexible Kampformat & Tidsestimat Panel */}
      <div className="p-5 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-lime-400 block mb-1">
              Innstillinger
            </span>
            <h3 className="text-lg font-black text-white uppercase flex items-center gap-2">
              <Sliders className="w-4 h-4 text-lime-400" />
              Kampformat &amp; Tid
            </h3>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">
              Konfigurer sett, målpoeng og vinnemargin for cuprunder, semifinale og finale.
              Endringer gjelder umiddelbart for kamper som ikke er startet.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowFormatPanel(!showFormatPanel)}
            className="self-start px-4 py-2 rounded-2xl bg-zinc-950 border-2 border-zinc-800 hover:border-lime-400 text-zinc-200 text-xs font-black uppercase tracking-wider flex items-center gap-2"
          >
            <Sliders className="w-3.5 h-3.5 text-lime-400" />
            {showFormatPanel ? 'Skjul oppsett' : 'Endre oppsett'}
          </button>
        </div>

        {/* Quick Summary Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {(
            [
              { key: 'regular' as TournamentStage, title: 'Cuprunder' },
              { key: 'semifinal' as TournamentStage, title: 'Semifinale' },
              { key: 'final' as TournamentStage, title: 'Finale' },
            ] as const
          ).map(({ key, title }) => {
            const conf = tournament.formatSettings?.[key] || DEFAULT_FORMAT_SETTINGS[key];
            return (
              <div key={key} className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block mb-1">
                  {title}
                </span>
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span className="text-lime-400">{conf.numberOfSets} sett</span>
                  <span className="text-zinc-600">·</span>
                  <span>{conf.targetPoints}p (margin {conf.winMargin})</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Editable Match Minutes */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
          <div className="text-xs">
            <span className="font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-lime-400" />
              Estimert spilletid per kamp
            </span>
            <span className="text-[11px] text-zinc-500 font-medium block">
              Brukes til å beregne resttid (totalt ~{stats.estimatedRemainingMinutes} min gjenstår)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {[5, 8, 10, 15, 20].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => handleMinutesChange(mins)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors ${
                  estimatedMinutes === mins
                    ? 'bg-lime-400 text-zinc-950 shadow-artistic-sm'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {mins}m
              </button>
            ))}
            <div className="flex items-center gap-1 ml-1">
              <input
                type="number"
                min={3}
                max={60}
                value={estimatedMinutes}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val > 0) handleMinutesChange(val);
                }}
                className="w-14 px-2 py-1 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono font-bold text-xs text-center focus:outline-none focus:border-lime-400"
              />
              <span className="text-[11px] text-zinc-500 font-bold">min</span>
            </div>
          </div>
        </div>

        {/* Expandable Configuration Drawer */}
        {showFormatPanel && (
          <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-lime-400/30 space-y-4">
            <p className="text-xs font-bold text-zinc-300">
              Juster innstillingene for hvert trinn i turneringen:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [
                  { key: 'regular' as TournamentStage, title: 'Vanlige cuprunder' },
                  { key: 'semifinal' as TournamentStage, title: 'Semifinale' },
                  { key: 'final' as TournamentStage, title: 'Finale' },
                ] as const
              ).map(({ key, title }) => {
                const conf = formatDraft[key];
                return (
                  <div key={key} className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                    <span className="text-xs font-black text-white uppercase block border-b border-zinc-800 pb-1.5">
                      {title}
                    </span>

                    {/* Sets */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">
                        Antall sett
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([1, 3] as NumberOfSets[]).map((sets) => (
                          <button
                            key={sets}
                            type="button"
                            onClick={() =>
                              setFormatDraft((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], numberOfSets: sets },
                              }))
                            }
                            className={`py-1.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                              conf.numberOfSets === sets
                                ? 'bg-lime-400 text-zinc-950 shadow-artistic-sm'
                                : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {sets} {sets === 1 ? 'sett' : 'sett (best av 3)'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Target points */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">
                        Målpoeng
                      </label>
                      <div className="grid grid-cols-4 gap-1">
                        {([6, 7, 11, 21] as TargetPoints[]).map((pts) => (
                          <button
                            key={pts}
                            type="button"
                            onClick={() =>
                              setFormatDraft((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], targetPoints: pts },
                              }))
                            }
                            className={`py-1 rounded-lg text-xs font-black transition-colors ${
                              conf.targetPoints === pts
                                ? 'bg-lime-400 text-zinc-950 shadow-artistic-sm'
                                : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {pts}p
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Win margin */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">
                        Vinnemargin
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([1, 2] as WinMargin[]).map((margin) => (
                          <button
                            key={margin}
                            type="button"
                            onClick={() =>
                              setFormatDraft((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], winMargin: margin },
                              }))
                            }
                            className={`py-1.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                              conf.winMargin === margin
                                ? 'bg-lime-400 text-zinc-950 shadow-artistic-sm'
                                : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            Margin {margin} {margin === 2 ? '(deuce)' : '(først til mål)'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {formatSaveError && (
              <p className="text-xs text-rose-400 font-bold">{formatSaveError}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                disabled={formatSaveLoading}
                onClick={handleSaveFormat}
                className="px-5 py-2.5 rounded-2xl bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {formatSaveLoading ? 'Lagrer...' : 'Lagre formatendringer'}
              </button>

              {formatSaveSuccess && (
                <span className="text-xs font-bold text-lime-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Format lagret for alle ustartede kamper!
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowFormatPanel(false)}
                className="px-4 py-2.5 rounded-2xl bg-zinc-900 border-2 border-zinc-800 text-zinc-400 text-xs font-black uppercase tracking-wider"
              >
                Lukk
              </button>
            </div>
          </div>
        )}
      </div>

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
                  {m.sets && m.sets.length > 0 && (
                    <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      ({m.sets.map((s) => `${s.scoreA}-${s.scoreB}`).join(', ')})
                    </span>
                  )}
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
  onSubmit: (setsPayload?: { scoreA: number; scoreB: number }[]) => void;
  onConfirmCorrection: (setsPayload?: { scoreA: number; scoreB: number }[]) => void;
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
  const numberOfSets = match.numberOfSets ?? 1;
  const isBestOf3 = numberOfSets === 3;
  const targetPoints = match.targetPoints ?? 21;
  const winMargin = match.winMargin ?? 2;

  // Local state for set scores if best-of-3
  const [sets, setSets] = useState<{ scoreA: number; scoreB: number }[]>(() => {
    if (match.sets && match.sets.length > 0) {
      return match.sets.map((s) => ({ scoreA: s.scoreA, scoreB: s.scoreB }));
    }
    return [
      { scoreA: targetPoints, scoreB: Math.max(0, targetPoints - (winMargin === 2 ? 3 : 2)) },
      { scoreA: Math.max(0, targetPoints - (winMargin === 2 ? 3 : 2)), scoreB: targetPoints },
      { scoreA: targetPoints, scoreB: Math.max(0, targetPoints - (winMargin === 2 ? 3 : 2)) },
    ];
  });

  const [localValidationErr, setLocalValidationErr] = useState<string | null>(null);

  // Calculate sets won so far
  const setsWonA = useMemo(() => {
    let count = 0;
    if (sets[0] && validateScore(sets[0].scoreA, sets[0].scoreB, targetPoints, winMargin).valid) {
      if (sets[0].scoreA > sets[0].scoreB) count++;
    }
    if (sets[1] && validateScore(sets[1].scoreA, sets[1].scoreB, targetPoints, winMargin).valid) {
      if (sets[1].scoreA > sets[1].scoreB) count++;
    }
    return count;
  }, [sets, targetPoints, winMargin]);

  const setsWonB = useMemo(() => {
    let count = 0;
    if (sets[0] && validateScore(sets[0].scoreA, sets[0].scoreB, targetPoints, winMargin).valid) {
      if (sets[0].scoreB > sets[0].scoreA) count++;
    }
    if (sets[1] && validateScore(sets[1].scoreA, sets[1].scoreB, targetPoints, winMargin).valid) {
      if (sets[1].scoreB > sets[1].scoreA) count++;
    }
    return count;
  }, [sets, targetPoints, winMargin]);

  const set3Needed = setsWonA === 1 && setsWonB === 1;
  const matchDecidedIn2 = setsWonA === 2 || setsWonB === 2;

  const updateSetScore = (setIdx: number, slot: 'A' | 'B', value: number) => {
    setLocalValidationErr(null);
    setSets((prev) => {
      const next = [...prev];
      if (!next[setIdx]) next[setIdx] = { scoreA: 0, scoreB: 0 };
      next[setIdx] = {
        ...next[setIdx],
        [slot === 'A' ? 'scoreA' : 'scoreB']: value,
      };
      return next;
    });
  };

  const handleModalSubmit = () => {
    setLocalValidationErr(null);

    if (isBestOf3) {
      // Validate set 1
      const s1Val = validateScore(sets[0].scoreA, sets[0].scoreB, targetPoints, winMargin);
      if (!s1Val.valid) {
        setLocalValidationErr(`Sett 1: ${s1Val.reason || 'Ugyldig resultat'}`);
        return;
      }
      // Validate set 2
      const s2Val = validateScore(sets[1].scoreA, sets[1].scoreB, targetPoints, winMargin);
      if (!s2Val.valid) {
        setLocalValidationErr(`Sett 2: ${s2Val.reason || 'Ugyldig resultat'}`);
        return;
      }

      let payload: { scoreA: number; scoreB: number }[] = [sets[0], sets[1]];

      // If 1-1, set 3 must also be valid
      if (set3Needed) {
        const s3Val = validateScore(sets[2].scoreA, sets[2].scoreB, targetPoints, winMargin);
        if (!s3Val.valid) {
          setLocalValidationErr(`Sett 3: ${s3Val.reason || 'Ugyldig resultat for avgjørende sett'}`);
          return;
        }
        payload.push(sets[2]);
      }

      onSubmit(payload);
    } else {
      // Single set
      const v = validateScore(scoreA, scoreB, targetPoints, winMargin);
      if (!v.valid) {
        setLocalValidationErr(v.reason || 'Ugyldig resultat');
        return;
      }
      onSubmit();
    }
  };

  const handleModalConfirmCorrection = () => {
    if (isBestOf3) {
      const payload = matchDecidedIn2 ? [sets[0], sets[1]] : [sets[0], sets[1], sets[2]];
      onConfirmCorrection(payload);
    } else {
      onConfirmCorrection();
    }
  };

  // Target points quick choices
  const quickScorePairs = useMemo(() => {
    const p = targetPoints;
    const m = winMargin;
    const diff = m === 2 ? 3 : 2;
    return [
      [p, Math.max(0, p - diff)],
      [Math.max(0, p - diff), p],
      [p + (m === 2 ? 1 : 0), p + (m === 2 ? 1 : 0) - m],
    ];
  }, [targetPoints, winMargin]);

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-zinc-900 border-2 border-zinc-700 p-6 sm:p-8 shadow-artistic-md my-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-lime-400 block mb-0.5">
              {match.roundName} · {isBestOf3 ? 'Best av 3 sett' : '1 sett'} · {targetPoints}p
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {isCorrection ? 'Korriger kampresultat' : 'Registrer kampresultat'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white font-black"
          >
            ✕
          </button>
        </div>

        {/* Best of 3 multi-set inputs */}
        {isBestOf3 ? (
          <div className="space-y-4 mb-6">
            <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs font-bold">
              <span className="text-zinc-400 truncate max-w-[45%]">
                {playerLabel(match.playerA)}: <strong className="text-lime-400">{setsWonA} sett</strong>
              </span>
              <span className="text-zinc-600">VS</span>
              <span className="text-zinc-400 truncate max-w-[45%] text-right">
                {playerLabel(match.playerB)}: <strong className="text-lime-400">{setsWonB} sett</strong>
              </span>
            </div>

            {/* Set 1 */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 space-y-2">
              <span className="text-[10px] font-black uppercase text-zinc-400 block">
                Sett 1 (mål {targetPoints}p)
              </span>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                <div>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={sets[0]?.scoreA ?? 0}
                    onChange={(e) => updateSetScore(0, 'A', parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono font-black text-2xl text-center focus:outline-none focus:border-lime-400"
                  />
                </div>
                <span className="text-xs font-black text-zinc-600 uppercase">-</span>
                <div>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={sets[0]?.scoreB ?? 0}
                    onChange={(e) => updateSetScore(0, 'B', parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono font-black text-2xl text-center focus:outline-none focus:border-lime-400"
                  />
                </div>
              </div>
            </div>

            {/* Set 2 */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 space-y-2">
              <span className="text-[10px] font-black uppercase text-zinc-400 block">
                Sett 2 (mål {targetPoints}p)
              </span>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                <div>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={sets[1]?.scoreA ?? 0}
                    onChange={(e) => updateSetScore(1, 'A', parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono font-black text-2xl text-center focus:outline-none focus:border-lime-400"
                  />
                </div>
                <span className="text-xs font-black text-zinc-600 uppercase">-</span>
                <div>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={sets[1]?.scoreB ?? 0}
                    onChange={(e) => updateSetScore(1, 'B', parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono font-black text-2xl text-center focus:outline-none focus:border-lime-400"
                  />
                </div>
              </div>
            </div>

            {/* Set 3 (Conditional upon 1-1) */}
            {matchDecidedIn2 ? (
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-dashed border-zinc-800 text-center">
                <span className="text-xs font-bold text-zinc-500">
                  Sett 3 spilles ikke (avgjort {setsWonA > setsWonB ? '2–0 til ' + playerLabel(match.playerA) : '0–2 til ' + playerLabel(match.playerB)})
                </span>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-zinc-950 border-2 border-lime-400/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-lime-400 block">
                    Sett 3 (Avgjørende sett — mål {targetPoints}p)
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500">1–1 i sett</span>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                  <div>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={sets[2]?.scoreA ?? 0}
                      onChange={(e) => updateSetScore(2, 'A', parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono font-black text-2xl text-center focus:outline-none focus:border-lime-400"
                    />
                  </div>
                  <span className="text-xs font-black text-zinc-600 uppercase">-</span>
                  <div>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={sets[2]?.scoreB ?? 0}
                      onChange={(e) => updateSetScore(2, 'B', parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono font-black text-2xl text-center focus:outline-none focus:border-lime-400"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Single set layout */
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end mb-6">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 block mb-2 truncate">
                  {playerLabel(match.playerA)}
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
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
                  max={60}
                  value={scoreB}
                  onChange={(e) => onScoreBChange(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white font-mono font-black text-3xl text-center focus:outline-none focus:border-lime-400"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <span className="text-[10px] font-bold text-zinc-500 self-center uppercase">Hurtigvalg:</span>
              {quickScorePairs.map(([a, b]) => (
                <button
                  key={`${a}-${b}`}
                  type="button"
                  onClick={() => {
                    onScoreAChange(a);
                    onScoreBChange(b);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-black text-zinc-300 hover:text-white"
                >
                  {a} – {b}
                </button>
              ))}
            </div>
          </>
        )}

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
              onClick={handleModalConfirmCorrection}
              className="px-4 py-2 rounded-xl bg-rose-500 text-zinc-950 font-black uppercase text-[10px]"
            >
              Bekreft og tilbakestill senere kamper
            </button>
          </div>
        )}

        {localValidationErr && (
          <p className="text-xs text-rose-400 font-bold mb-4">{localValidationErr}</p>
        )}
        {actionError && <p className="text-xs text-rose-400 font-bold mb-4">{actionError}</p>}

        <button
          type="button"
          onClick={handleModalSubmit}
          className="w-full py-3.5 rounded-2xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5"
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
