import React, { useMemo } from 'react';
import { Calendar, MapPin, Clock, Trophy, Sparkles, ChevronRight, CheckCircle2 } from 'lucide-react';
import { AppState, Person } from '../types';
import { PopcornBongCard } from './PopcornBongCard';

interface EventHeroProps {
  state: AppState;
  onGoToTableTennis: () => void;
  onGoToAlpha: () => void;
  onClaimPopcorn?: () => void;
  myPlayerName?: string | null;
  onBongClaimed?: () => void;
  activePersonId?: string | null;
  activePerson?: Person | null;
  onCreatePerson?: (firstName: string) => Promise<Person | null>;
  onGoToProfile?: () => void;
}

export const EventHero: React.FC<EventHeroProps> = ({
  state,
  onGoToTableTennis,
  onGoToAlpha,
  onClaimPopcorn,
  myPlayerName,
  onBongClaimed,
  activePersonId = null,
  activePerson = null,
  onCreatePerson,
  onGoToProfile,
}) => {
  const popcornPercent = Math.min(
    100,
    Math.round((state.event.popcornClaimedCount / state.event.freePopcornLimit) * 100)
  );

  const isRegisteredInTournament = useMemo(() => {
    const participants = state.tournament?.participants || [];
    if (!participants.length) return false;

    // Technical person IDs
    const targetPersonId = activePersonId || activePerson?.id;
    if (targetPersonId) {
      const match = participants.some(
        (p) => (p.personId && p.personId === targetPersonId) || p.id === targetPersonId
      );
      if (match) return true;
    }

    // Display ID (e.g. Magnar_1)
    if (activePerson?.displayId) {
      const dId = activePerson.displayId.trim().toLowerCase();
      const match = participants.some(
        (p) => p.displayId && p.displayId.trim().toLowerCase() === dId
      );
      if (match) return true;
    }

    // First name
    if (activePerson?.firstName) {
      const fName = activePerson.firstName.trim().toLowerCase();
      const match = participants.some(
        (p) => p.firstName && p.firstName.trim().toLowerCase() === fName
      );
      if (match) return true;
    }

    // Player name prop
    if (myPlayerName && myPlayerName.trim()) {
      const clean = myPlayerName.trim().toLowerCase();
      const match = participants.some(
        (p) =>
          (p.firstName && p.firstName.trim().toLowerCase() === clean) ||
          (p.displayId && p.displayId.trim().toLowerCase() === clean) ||
          (clean.includes('_') && p.firstName && p.firstName.trim().toLowerCase() === clean.split('_')[0])
      );
      if (match) return true;
    }

    // Also check cached local player name if available
    try {
      if (typeof window !== 'undefined') {
        const storedName = localStorage.getItem('lillesand_my_player_name');
        if (storedName && storedName.trim()) {
          const sClean = storedName.trim().toLowerCase();
          const match = participants.some(
            (p) =>
              (p.firstName && p.firstName.trim().toLowerCase() === sClean) ||
              (p.displayId && p.displayId.trim().toLowerCase() === sClean)
          );
          if (match) return true;
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    return false;
  }, [state.tournament?.participants, activePersonId, activePerson, myPlayerName]);

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
      <div className="max-w-3xl mb-8">
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter text-white uppercase mb-3 leading-none">
          Lillesand <span className="text-lime-400 drop-shadow-[0_0_30px_rgba(163,230,53,0.45)]">United</span>
        </h1>
        <p className="text-lg sm:text-2xl font-black uppercase tracking-wide text-zinc-200">
          Et samarbeid mellom KRIK og byens menigheter
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
              17:00 – 22:00
            </strong>
          </div>
        </div>
      </div>

      {/* Free Popcorn Digital Bong Card */}
      <PopcornBongCard
        popcorn={state.popcorn}
        variant="hero"
        className="mb-8"
        userName={myPlayerName}
        onCreatePerson={onCreatePerson}
        onBongClaimed={onBongClaimed}
        activePersonId={activePersonId}
        activePerson={activePerson}
        onGoToProfile={onGoToProfile}
      />

      {/* Action CTA Buttons */}
      <div className="flex flex-wrap items-center gap-4">
        {isRegisteredInTournament ? (
          <button
            id="hero-cup-registered-btn"
            disabled
            type="button"
            className="px-7 py-4 rounded-2xl bg-zinc-950 border-2 border-lime-400 text-lime-400 font-black text-sm sm:text-base uppercase tracking-wider flex items-center gap-2.5 shadow-artistic-sm cursor-default select-none -rotate-1 opacity-100"
          >
            <CheckCircle2 className="w-5 h-5 text-lime-400 shrink-0" />
            <span>Du er påmeldt bordtenniscup</span>
          </button>
        ) : (
          <button
            id="hero-join-cup-btn"
            onClick={onGoToTableTennis}
            className="px-7 py-4 rounded-2xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-black text-sm sm:text-base uppercase tracking-wider flex items-center gap-2.5 shadow-artistic-md transition-all active:translate-x-0.5 active:translate-y-0.5 -rotate-1 hover:rotate-0"
          >
            <Trophy className="w-5 h-5" />
            Meld deg på Bordtenniscup
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <button
          id="hero-alpha-btn"
          onClick={onGoToAlpha}
          className="px-6 py-4 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-black text-sm sm:text-base uppercase tracking-wider border-2 border-zinc-700 shadow-artistic-sm flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 rotate-1 hover:rotate-0"
        >
          <Sparkles className="w-5 h-5 text-sky-400" />
          Info om UngdomsAlpha
        </button>
      </div>
    </div>
  );
};

