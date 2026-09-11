import React, { useMemo, useState } from 'react';
import { Match, Participant } from '../types';
import { Trophy, CheckCircle2, Zap } from 'lucide-react';

interface BracketViewProps {
  matches: Match[];
  winner: Participant | null;
  myPlayerName: string | null;
  activePersonId?: string | null;
}

export const BracketView: React.FC<BracketViewProps> = ({
  matches,
  winner,
  myPlayerName,
  activePersonId,
}) => {
  const isLargeBracket = matches.length > 16;
  const [showFullBracket, setShowFullBracket] = useState(false);

  const rounds: number[] = useMemo(() => {
    if (matches.length === 0) return [];
    return Array.from(new Set<number>(matches.map((m) => m.round))).sort((a, b) => a - b);
  }, [matches]);

  const activeRound = useMemo(() => {
    if (rounds.length === 0) return 1;
    const incomplete = rounds.find((r) =>
      matches.some(
        (m) =>
          m.round === r &&
          m.status !== 'completed' &&
          m.status !== 'walkover'
      )
    );
    return incomplete ?? rounds[rounds.length - 1];
  }, [matches, rounds]);

  const [selectedRoundMobile, setSelectedRoundMobile] = useState<number>(activeRound);

  React.useEffect(() => {
    setSelectedRoundMobile(activeRound);
  }, [activeRound]);

  if (matches.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
        Turneringen er ikke trukket enda. Registrer deg for å bli med i trekningen!
      </div>
    );
  }

  const visibleRounds =
    isLargeBracket && !showFullBracket ? [activeRound] : rounds;

  const getRoundLabel = (r: number) => {
    const totalRounds = rounds.length;
    const diff = totalRounds - r;
    if (diff === 0) return 'Finale';
    if (diff === 1) return 'Semifinale';
    if (diff === 2) return 'Kvartfinale';
    if (diff === 3) return 'Åttedelsfinale';
    return `Runde ${r}`;
  };

  const winnerLabel = winner ? winner.displayId || winner.firstName : '';

  return (
    <div className="w-full">
      {isLargeBracket && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-zinc-400 font-medium">
            {showFullBracket
              ? 'Viser hele bracket'
              : `Viser aktiv runde: ${getRoundLabel(activeRound)}`}
          </span>
          <button
            type="button"
            onClick={() => setShowFullBracket(!showFullBracket)}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border-2 border-zinc-800 text-zinc-300 text-[10px] font-black uppercase hover:border-lime-400/50"
          >
            {showFullBracket ? 'Vis aktiv runde' : 'Vis hele bracket'}
          </button>
        </div>
      )}

      {/* Champion Banner if finished */}
      {winner && (
        <div className="mb-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-400/20 via-yellow-400/25 to-amber-500/20 border-2 border-amber-400 text-center relative overflow-hidden shadow-artistic-md">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
            <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-300">
              Vinner av Lillesand United Bordtenniscup 2026!
            </span>
            <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-white uppercase tracking-tight">
            🏆 {winnerLabel} 🏆
          </h2>
          <p className="text-xs sm:text-sm text-amber-200 mt-1 font-bold">
            Gratulerer med seieren i finalen!
          </p>
        </div>
      )}

      {/* Mobile Round Selector Tabs */}
      <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-3 mb-3">
        {visibleRounds.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRoundMobile(r)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
              selectedRoundMobile === r
                ? 'bg-lime-400 text-zinc-950 shadow-artistic-sm'
                : 'bg-zinc-900 text-zinc-400 border-2 border-zinc-800'
            }`}
          >
            {getRoundLabel(r)}
          </button>
        ))}
      </div>

      {/* Bracket Tree Container */}
      <div className="overflow-x-auto pb-4 pt-1">
        <div className="inline-flex gap-8 min-w-full items-start">
          {visibleRounds.map((roundNum) => {
            const roundMatches = matches
              .filter((m) => m.round === roundNum)
              .sort((a, b) => a.position - b.position);

            const isMobileHidden = selectedRoundMobile !== roundNum;

            return (
              <div
                key={roundNum}
                className={`flex-1 min-w-[270px] max-w-[330px] shrink-0 ${
                  isMobileHidden ? 'hidden lg:block' : 'block'
                }`}
              >
                <div className="mb-4 text-center">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-300 bg-zinc-900 border-2 border-zinc-800 px-4 py-1.5 rounded-xl inline-block shadow-artistic-sm -rotate-1">
                    {getRoundLabel(roundNum)}
                  </span>
                </div>

                <div className="flex flex-col justify-around gap-4 h-full">
                  {roundMatches.map((match) => {
                    const isPlayerMe = (player: Participant | null) => {
                      if (!player) return false;
                      if (activePersonId && player.personId === activePersonId) return true;
                      if (
                        myPlayerName &&
                        player.firstName.toLowerCase() === myPlayerName.toLowerCase()
                      )
                        return true;
                      return false;
                    };

                    const isMyMatch = isPlayerMe(match.playerA) || isPlayerMe(match.playerB);
                    const isTableActive = match.tableNumber && match.status === 'in_progress';
                    const matchSets = match.format?.sets ?? 1;
                    const isBestOf3 = matchSets === 3;
                    const targetPoints = match.format?.targetPoints ?? 21;
                    const playedSets = match.sets ?? [];
                    const showSetBreakdown =
                      isBestOf3 &&
                      playedSets.length > 0 &&
                      (match.status === 'completed' || match.status === 'walkover');

                    const renderScore = (slot: 'A' | 'B') => {
                      const setsWon = slot === 'A' ? match.scoreA : match.scoreB;
                      if (setsWon === null) return '-';
                      if (isBestOf3) {
                        return (
                          <span className="flex flex-col items-end leading-none">
                            <span>{setsWon}</span>
                            <span className="text-[8px] font-bold uppercase text-zinc-500">sett</span>
                          </span>
                        );
                      }
                      const setScore = playedSets[0];
                      const points =
                        setScore !== undefined
                          ? slot === 'A'
                            ? setScore.scoreA
                            : setScore.scoreB
                          : setsWon;
                      return points;
                    };

                    return (
                      <div
                        key={match.id}
                        id={`match-${match.id}`}
                        className={`relative rounded-2xl p-4 border-2 transition-all ${
                          isMyMatch
                            ? 'bg-lime-400/15 border-lime-400 shadow-artistic-lime ring-2 ring-lime-400/40'
                            : isTableActive
                            ? 'bg-zinc-900 border-lime-400 shadow-artistic-lime'
                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-artistic-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                              Kamp #{match.position + 1}
                            </span>
                            {match.format && (
                              <span className="text-[9px] font-bold text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                                {isBestOf3 ? 'Best av 3' : '1 sett'} · {targetPoints}p
                              </span>
                            )}
                          </div>

                          {match.tableNumber ? (
                            <span
                              className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-artistic-sm ${
                                match.status === 'in_progress'
                                  ? 'bg-lime-400 text-zinc-950 animate-pulse'
                                  : 'bg-orange-500 text-zinc-950'
                              }`}
                            >
                              <Zap className="w-3 h-3" />
                              BORD {match.tableNumber}
                              {match.status === 'in_progress' ? ' • PÅGÅR' : ' • KLAR'}
                            </span>
                          ) : match.isWalkover ? (
                            <span className="text-[10px] font-black bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-lg border border-zinc-700">
                              Walkover
                            </span>
                          ) : match.status === 'completed' ? (
                            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-lime-400" /> Ferdig
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">
                              Venter
                            </span>
                          )}
                        </div>

                        <div
                          className={`flex items-center justify-between p-2.5 rounded-xl mb-1.5 text-sm font-bold transition-colors ${
                            match.winnerId && match.playerA && match.winnerId === match.playerA.id
                              ? 'bg-lime-400/20 text-white font-black border-2 border-lime-400/40 shadow-artistic-sm'
                              : match.playerA
                              ? 'bg-zinc-950 text-zinc-200 border border-zinc-800'
                              : 'bg-zinc-950/40 text-zinc-600 border-2 border-dashed border-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {match.winnerId && match.playerA && match.winnerId === match.playerA.id && (
                              <Trophy className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                            )}
                            <span className="truncate">
                              {match.playerA
                                ? match.playerA.displayId || match.playerA.firstName
                                : 'Ikke klar'}
                            </span>
                            {isPlayerMe(match.playerA) && (
                              <span className="text-[9px] bg-lime-400 text-zinc-950 font-black px-1.5 py-0.5 rounded shadow-artistic-sm shrink-0">
                                DEG
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-black ml-2 font-mono">
                            {renderScore('A')}
                          </span>
                        </div>

                        {match.isWalkover && !match.playerB ? (
                          <div className="p-2.5 rounded-xl text-xs font-bold italic text-zinc-400 bg-zinc-950/50 border-2 border-dashed border-zinc-800 flex items-center justify-between">
                            <span>Walkover (videre)</span>
                            <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-lg font-mono font-bold">
                              WO
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`flex items-center justify-between p-2.5 rounded-xl text-sm font-bold transition-colors ${
                              match.winnerId && match.playerB && match.winnerId === match.playerB.id
                                ? 'bg-lime-400/20 text-white font-black border-2 border-lime-400/40 shadow-artistic-sm'
                                : match.playerB
                                ? 'bg-zinc-950 text-zinc-200 border border-zinc-800'
                                : 'bg-zinc-950/40 text-zinc-600 border-2 border-dashed border-zinc-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {match.winnerId && match.playerB && match.winnerId === match.playerB.id && (
                                <Trophy className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                              )}
                              <span className="truncate">
                                {match.playerB
                                  ? match.playerB.displayId || match.playerB.firstName
                                  : 'Ikke klar'}
                              </span>
                              {isPlayerMe(match.playerB) && (
                                <span className="text-[9px] bg-lime-400 text-zinc-950 font-black px-1.5 py-0.5 rounded shadow-artistic-sm shrink-0">
                                  DEG
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-black ml-2 font-mono">
                              {renderScore('B')}
                            </span>
                          </div>
                        )}

                        {showSetBreakdown && (
                          <div className="mt-2 pt-2 border-t border-zinc-800/80 space-y-1">
                            {[0, 1, 2].map((idx) => {
                              const set = playedSets[idx];
                              const isSkipped = !set && playedSets.length === 2 && idx === 2;
                              if (!set && !isSkipped) return null;
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-[10px] font-mono text-zinc-500"
                                >
                                  <span>Sett {idx + 1}</span>
                                  <span className="text-zinc-300">
                                    {set ? `${set.scoreA}–${set.scoreB}` : '—'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {!isBestOf3 &&
                          playedSets.length > 0 &&
                          (match.status === 'completed' || match.status === 'walkover') && (
                            <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                              <span>Sett:</span>
                              <span className="text-zinc-300">
                                {playedSets.map((s) => `${s.scoreA}-${s.scoreB}`).join(', ')}
                              </span>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
