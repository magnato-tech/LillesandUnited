import React from 'react';
import { Clock, Flame, Award, Trophy } from 'lucide-react';

export const ScheduleSection: React.FC = () => {
  return (
    <section id="event-schedule-section" className="mb-8">
      <div className="p-5 sm:p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-md">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5 pb-3 border-b-2 border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-lime-400/15 border border-lime-400/30 flex items-center justify-center text-lime-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                Kveldens Kjøreplan
              </h3>
              <p className="text-[11px] text-zinc-400 font-medium">
                Tidsplan for program og aktiviteter i Møglestuhallen
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-zinc-950 text-lime-400 px-3 py-1 rounded-xl border-2 border-zinc-800 shadow-artistic-sm">
            Møglestuhallen • 17:00 – 22:00
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 17:00 */}
          <div className="p-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800/90 shadow-artistic-sm flex flex-col justify-between">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-lg bg-zinc-900 text-lime-400 font-mono font-black text-xs mb-1.5 border border-zinc-800">
                17:00
              </span>
              <h4 className="font-black text-white uppercase text-xs">Dørene åpner</h4>
              <p className="text-zinc-400 text-[11px] mt-1 leading-snug">
                Ankomst, påmelding til aktiviteter, åpen kiosk og gratis popcorn til 100 første!
              </p>
            </div>
          </div>

          {/* 18:45 - Offisielt program */}
          <div className="p-3.5 rounded-2xl bg-zinc-950 border-2 border-emerald-400/80 shadow-artistic-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-block px-2.5 py-0.5 rounded-lg bg-emerald-400 text-zinc-950 font-mono font-black text-xs">
                  18:45
                </span>
                <Trophy className="w-4 h-4 text-emerald-400" />
              </div>
              <h4 className="font-black text-white uppercase text-xs">Aktivitetsstart</h4>
              <p className="text-zinc-400 text-[11px] mt-1 leading-snug">
                Bordtenniscup, 5-er fotball og Mario Kart gaming starter i hallen.
              </p>
            </div>
          </div>

          {/* 21:00 - Offisielt program */}
          <div className="p-3.5 rounded-2xl bg-zinc-950 border-2 border-rose-500/80 shadow-artistic-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-block px-2.5 py-0.5 rounded-lg bg-rose-500 text-zinc-950 font-mono font-black text-xs">
                  21:00 – 21:45
                </span>
                <Flame className="w-4 h-4 text-rose-400" />
              </div>
              <h4 className="font-black text-white uppercase text-xs">Fellesmøte</h4>
              <p className="text-zinc-300 text-[11px] mt-1 leading-snug font-medium">
                Band & tale v/ Eivind Galdal
              </p>
            </div>
          </div>

          {/* 22:00 - Offisielt program */}
          <div className="p-3.5 rounded-2xl bg-zinc-950 border-2 border-amber-400/80 shadow-artistic-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-block px-2.5 py-0.5 rounded-lg bg-amber-400 text-zinc-950 font-mono font-black text-xs">
                  22:00
                </span>
                <Award className="w-4 h-4 text-amber-400" />
              </div>
              <h4 className="font-black text-white uppercase text-xs">Sluttspill og premieutdeling</h4>
              <p className="text-zinc-400 text-[11px] mt-1 leading-snug">
                Finaler og premiering av vinnere
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
