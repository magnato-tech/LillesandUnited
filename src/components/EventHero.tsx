import React from 'react';
import { Calendar, MapPin, Clock, Trophy, Sparkles, Popcorn, Users, CheckCircle2, ChevronRight, Music, Award, Flame } from 'lucide-react';
import { AppState } from '../types';
import { PopcornBongCard } from './PopcornBongCard';

interface EventHeroProps {
  state: AppState;
  onGoToTableTennis: () => void;
  onGoToAlpha: () => void;
  onClaimPopcorn?: () => void;
  myPlayerName?: string | null;
  onSetMyPlayer?: (name: string | null) => void;
  onBongClaimed?: () => void;
}

export const EventHero: React.FC<EventHeroProps> = ({
  state,
  onGoToTableTennis,
  onGoToAlpha,
  onClaimPopcorn,
  myPlayerName,
  onSetMyPlayer,
  onBongClaimed,
}) => {
  const popcornPercent = Math.min(
    100,
    Math.round((state.event.popcornClaimedCount / state.event.freePopcornLimit) * 100)
  );

  return (
    <div className="relative overflow-hidden rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-md p-6 sm:p-10 mb-8">
      {/* Background ambient decorative shapes & artistic blobs */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-lime-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner Tag with Artistic Flair stickers */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-lime-400 text-zinc-950 text-xs sm:text-sm font-black uppercase tracking-wider shadow-artistic-sm -rotate-1">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-950 animate-ping" />
          Ungdomskveld 13–19 år (7. klasse & oppover)
        </div>

        <div className="text-xs font-black uppercase tracking-wider text-zinc-950 flex items-center gap-1.5 bg-orange-400 px-3.5 py-1.5 rounded-xl shadow-artistic-sm rotate-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gratis inngang for alle!</span>
        </div>
      </div>

      {/* Main Headline */}
      <div className="max-w-3xl">
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter text-white uppercase mb-3 leading-none">
          Lillesand <span className="text-lime-400 drop-shadow-[0_0_30px_rgba(163,230,53,0.45)]">United</span>
        </h1>
        <p className="text-lg sm:text-2xl font-black uppercase tracking-wide text-zinc-200 mb-2">
          Et samarbeid mellom byens menigheter og KRIK
        </p>
        <p className="text-sm sm:text-base text-zinc-300 max-w-2xl mb-8 leading-relaxed font-medium">
          Dørene åpner kl. 17:00! Bordtennis, fotball og gaming starter kl. 18:45. Kveldens fellesmøte kl. 21:00 med lovsang, lek, Moshpit-sanger og tale ved Eivind Galdal (SALT Bergen), semifinaler/finaler kl. 22:00 og premieutdeling kl. 22:30.
        </p>
      </div>

      {/* Key Details Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 mb-8">
        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-artistic-sm hover:border-zinc-700 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-lime-400 text-zinc-950 flex items-center justify-center shrink-0 shadow-artistic-sm font-black -rotate-2">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider block">Når:</span>
            <strong className="text-sm sm:text-base text-white font-black block">
              Fredag 18. september 2026
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-artistic-sm hover:border-zinc-700 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-sky-400 text-zinc-950 flex items-center justify-center shrink-0 shadow-artistic-sm font-black rotate-1">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider block">Hvor:</span>
            <strong className="text-sm sm:text-base text-white font-black block">
              Møglestuhallen, Lillesand
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-artistic-sm hover:border-zinc-700 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-orange-400 text-zinc-950 flex items-center justify-center shrink-0 shadow-artistic-sm font-black -rotate-1">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider block">Tid:</span>
            <strong className="text-sm sm:text-base text-white font-black block">
              17:00 – 22:45 (Start 18:45)
            </strong>
          </div>
        </div>
      </div>

      {/* Official Schedule / Kjøreplan Timeline Strip */}
      <div className="mb-8 p-5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-artistic-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b-2 border-zinc-900">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-lime-400" />
            <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
              Kveldens Kjøreplan
            </h3>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-zinc-900 text-lime-400 px-2.5 py-1 rounded-lg border border-zinc-800">
            Møglestuhallen 17:00 – 22:45
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          {/* 17:00 */}
          <div className="p-3 rounded-xl bg-zinc-900 border-2 border-zinc-800/80 shadow-artistic-sm flex flex-col justify-between">
            <div>
              <span className="inline-block px-2 py-0.5 rounded bg-zinc-950 text-lime-400 font-mono font-black text-xs mb-1.5 border border-zinc-800">
                17:00
              </span>
              <h4 className="font-black text-white uppercase text-xs">Dørene åpner</h4>
              <p className="text-zinc-400 text-[11px] mt-1 leading-snug">
                Ankomst, påmelding til aktiviteter, åpen kiosk og gratis popcorn til 100 første!
              </p>
            </div>
          </div>

          {/* 18:45 */}
          <div className="p-3 rounded-xl bg-zinc-900 border-2 border-zinc-800/80 shadow-artistic-sm flex flex-col justify-between">
            <div>
              <span className="inline-block px-2 py-0.5 rounded bg-zinc-950 text-emerald-400 font-mono font-black text-xs mb-1.5 border border-zinc-800">
                18:45
              </span>
              <h4 className="font-black text-white uppercase text-xs">Aktivitetsstart</h4>
              <p className="text-zinc-400 text-[11px] mt-1 leading-snug">
                Bordtenniscup, 5-er fotball og Mario Kart gaming starter i hallen.
              </p>
            </div>
          </div>

          {/* 21:00 */}
          <div className="p-3 rounded-xl bg-zinc-900 border-2 border-rose-500/50 shadow-artistic-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-block px-2 py-0.5 rounded bg-rose-500 text-zinc-950 font-mono font-black text-xs">
                  21:00 – 21:45
                </span>
                <Flame className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <h4 className="font-black text-white uppercase text-xs">Fellesmøte</h4>
              <p className="text-zinc-300 text-[11px] mt-1 leading-snug font-medium">
                Lovsang, lek, Moshpit-sanger & tale v/ Eivind Galdal (SALT Bergen)!
              </p>
            </div>
          </div>

          {/* 22:00 */}
          <div className="p-3 rounded-xl bg-zinc-900 border-2 border-zinc-800/80 shadow-artistic-sm flex flex-col justify-between">
            <div>
              <span className="inline-block px-2 py-0.5 rounded bg-zinc-950 text-amber-400 font-mono font-black text-xs mb-1.5 border border-zinc-800">
                22:00
              </span>
              <h4 className="font-black text-white uppercase text-xs">Sluttspill & Leking</h4>
              <p className="text-zinc-400 text-[11px] mt-1 leading-snug">
                Semifinaler og finaler i turneringene, samt fri leking og moro i hallen.
              </p>
            </div>
          </div>

          {/* 22:30 - 22:45 */}
          <div className="p-3 rounded-xl bg-zinc-900 border-2 border-amber-400/40 shadow-artistic-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-block px-2 py-0.5 rounded bg-amber-400 text-zinc-950 font-mono font-black text-xs">
                  22:30
                </span>
                <Award className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <h4 className="font-black text-white uppercase text-xs">Premieutdeling</h4>
              <p className="text-zinc-400 text-[11px] mt-1 leading-snug">
                Høytidelig premiering av vinnere! Arrangementet avsluttes kl. 22:45.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Free Popcorn Digital Bong Card */}
      <PopcornBongCard
        popcorn={state.popcorn}
        variant="hero"
        className="mb-8"
        userName={myPlayerName}
        onSelectUser={onSetMyPlayer}
        participants={state.tournament.participants}
        onBongClaimed={onBongClaimed}
      />

      {/* Action CTA Buttons */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          id="hero-join-cup-btn"
          onClick={onGoToTableTennis}
          className="px-7 py-4 rounded-2xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-black text-sm sm:text-base uppercase tracking-wider flex items-center gap-2.5 shadow-artistic-md transition-all active:translate-x-0.5 active:translate-y-0.5 -rotate-1 hover:rotate-0"
        >
          <Trophy className="w-5 h-5" />
          Meld deg på Bordtenniscup
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          id="hero-alpha-btn"
          onClick={onGoToAlpha}
          className="px-6 py-4 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-black text-sm sm:text-base uppercase tracking-wider border-2 border-zinc-700 shadow-artistic-sm flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 rotate-1 hover:rotate-0"
        >
          <Sparkles className="w-5 h-5 text-sky-400" />
          Info om UngdomsAlpha
        </button>
      </div>

      {/* Organizer churches strip */}
      <div className="mt-8 pt-6 border-t-2 border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
        <span className="font-black uppercase tracking-wider text-zinc-300">Arrangeres i fellesskap av:</span>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-bold">
          {state.event.organizers.map((org, idx) => (
            <span
              key={idx}
              className="bg-zinc-950 px-3 py-1 rounded-xl border-2 border-zinc-800 text-zinc-300 shadow-artistic-sm"
            >
              {org}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

