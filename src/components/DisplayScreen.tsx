import React, { useState, useEffect } from 'react';
import { Trophy, Zap, Clock, Tv } from 'lucide-react';
import { AppState } from '../types';
import { BracketView } from './BracketView';

interface DisplayScreenProps {
  state: AppState;
  onExit?: () => void;
}

export const DisplayScreen: React.FC<DisplayScreenProps> = ({ state, onExit }) => {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const { tournament } = state;
  const table1Match = tournament.matches.find((m) => m.tableNumber === 1 && m.status !== 'completed');
  const table2Match = tournament.matches.find((m) => m.tableNumber === 2 && m.status !== 'completed');

  // Next upcoming matches in queue
  const upcomingMatches = tournament.matches
    .filter((m) => m.status === 'ready' && !m.tableNumber && m.playerA && m.playerB)
    .sort((a, b) => (a.round !== b.round ? a.round - b.round : a.position - b.position))
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 sm:p-8 flex flex-col justify-between artistic-pattern">
      {/* Top Arena Header */}
      <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-lime-400 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 font-black text-2xl shadow-artistic-sm -rotate-2">
            LU
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight flex items-center gap-3">
              Lillesand United <span className="text-lime-400">Bordtenniscup</span>
            </h1>
            <p className="text-sm text-zinc-400 font-bold">
              Møglestuhallen • Fredag 18. september 2026 • Live Storskjerm
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-zinc-900 border-2 border-zinc-800 px-5 py-2.5 rounded-2xl font-mono text-2xl font-black text-lime-400 flex items-center gap-2 shadow-artistic-sm">
            <Clock className="w-6 h-6 text-zinc-500" />
            {timeStr}
          </div>

          {onExit && (
            <button
              onClick={onExit}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 border-2 border-zinc-800 hover:border-zinc-700 text-xs font-black uppercase tracking-wider text-zinc-300 shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              Lukk storskjerm
            </button>
          )}
        </div>
      </div>

      {/* Main Split: Tables 1 & 2 at top + upcoming queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Table 1 Showcase */}
        <div className="lg:col-span-4 rounded-3xl bg-zinc-900 border-2 border-lime-400 p-6 shadow-artistic-lime relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="flex items-center gap-2 text-xl font-black uppercase tracking-wider text-lime-400">
              <span className="w-3.5 h-3.5 rounded-full bg-lime-400 animate-ping" />
              Bord 1
            </span>
            <span className="text-xs font-black uppercase px-3 py-1 rounded-xl bg-lime-400 text-zinc-950 shadow-artistic-sm">
              {table1Match?.status === 'in_progress' ? 'Pågår nå' : table1Match ? 'Klar' : 'Ledig'}
            </span>
          </div>

          {table1Match ? (
            <div>
              <div className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-4">
                {table1Match.roundName}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-2xl border-2 border-zinc-800 shadow-artistic-sm">
                  <span className="text-2xl font-black text-white truncate max-w-[70%]">
                    {table1Match.playerA?.firstName || 'Spiller 1'}
                  </span>
                  <span className="text-4xl font-black font-mono text-lime-400">
                    {table1Match.scoreA !== null ? table1Match.scoreA : '0'}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-2xl border-2 border-zinc-800 shadow-artistic-sm">
                  <span className="text-2xl font-black text-white truncate max-w-[70%]">
                    {table1Match.playerB?.firstName || 'Spiller 2'}
                  </span>
                  <span className="text-4xl font-black font-mono text-lime-400">
                    {table1Match.scoreB !== null ? table1Match.scoreB : '0'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-500 font-bold">
              Bord 1 er ledig. Neste kamp klargjøres.
            </div>
          )}

          <div className="mt-4 pt-3 border-t-2 border-zinc-800 text-xs text-zinc-500 text-center font-bold">
            Først til 21 poeng • 5 server hver
          </div>
        </div>

        {/* Table 2 Showcase */}
        <div className="lg:col-span-4 rounded-3xl bg-zinc-900 border-2 border-orange-400 p-6 shadow-artistic-orange relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="flex items-center gap-2 text-xl font-black uppercase tracking-wider text-orange-400">
              <span className="w-3.5 h-3.5 rounded-full bg-orange-400 animate-ping" />
              Bord 2
            </span>
            <span className="text-xs font-black uppercase px-3 py-1 rounded-xl bg-orange-500 text-zinc-950 shadow-artistic-sm">
              {table2Match?.status === 'in_progress' ? 'Pågår nå' : table2Match ? 'Klar' : 'Ledig'}
            </span>
          </div>

          {table2Match ? (
            <div>
              <div className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-4">
                {table2Match.roundName}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-2xl border-2 border-zinc-800 shadow-artistic-sm">
                  <span className="text-2xl font-black text-white truncate max-w-[70%]">
                    {table2Match.playerA?.firstName || 'Spiller 1'}
                  </span>
                  <span className="text-4xl font-black font-mono text-orange-400">
                    {table2Match.scoreA !== null ? table2Match.scoreA : '0'}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-2xl border-2 border-zinc-800 shadow-artistic-sm">
                  <span className="text-2xl font-black text-white truncate max-w-[70%]">
                    {table2Match.playerB?.firstName || 'Spiller 2'}
                  </span>
                  <span className="text-4xl font-black font-mono text-orange-400">
                    {table2Match.scoreB !== null ? table2Match.scoreB : '0'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-500 font-bold">
              Bord 2 er ledig. Neste kamp klargjøres.
            </div>
          )}

          <div className="mt-4 pt-3 border-t-2 border-zinc-800 text-xs text-zinc-500 text-center font-bold">
            Først til 21 poeng • 5 server hver
          </div>
        </div>

        {/* Upcoming Queue */}
        <div className="lg:col-span-4 rounded-3xl bg-zinc-900 border-2 border-zinc-800 p-6 flex flex-col justify-between shadow-artistic-sm">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Neste kamper i køen
            </h3>

            <div className="space-y-3">
              {upcomingMatches.map((m, idx) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between shadow-artistic-sm"
                >
                  <div>
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">
                      #{idx + 1} • {m.roundName}
                    </span>
                    <strong className="text-sm font-black text-zinc-100">
                      {m.playerA?.firstName} vs {m.playerB?.firstName}
                    </strong>
                  </div>
                  <span className="text-xs font-black text-zinc-950 bg-amber-400 px-2.5 py-1 rounded-lg uppercase shadow-artistic-sm">
                    Gjør klar
                  </span>
                </div>
              ))}

              {upcomingMatches.length === 0 && (
                <div className="p-8 text-center text-xs text-zinc-500 font-bold">
                  Ingen kamper venter i køen for øyeblikket.
                </div>
              )}
            </div>
          </div>

          {/* Champion Highlight if won */}
          {tournament.winner && (
            <div className="mt-4 p-4 rounded-2xl bg-amber-400/20 border-2 border-amber-400 text-center shadow-artistic-sm">
              <span className="text-[10px] font-black uppercase text-amber-300 tracking-widest block">
                Turneringens Vinner:
              </span>
              <h2 className="text-2xl font-black text-white">
                🏆 {tournament.winner.firstName} 🏆
              </h2>
            </div>
          )}
        </div>
      </div>

      {/* Bracket Tree at bottom */}
      <div className="rounded-3xl bg-zinc-900 border-2 border-zinc-800 p-6 shadow-artistic-md">
        <h3 className="text-lg font-black uppercase tracking-tight text-white mb-4">
          Hele cup-treet
        </h3>
        <BracketView
          matches={tournament.matches}
          winner={tournament.winner}
          myPlayerName={null}
        />
      </div>
    </div>
  );
};
