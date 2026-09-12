import React from 'react';
import { Utensils } from 'lucide-react';
import { AppState, Person } from '../types';
import { PopcornBongCard } from './PopcornBongCard';

interface KioskSectionProps {
  state: AppState;
  onClaimPopcorn?: () => void;
  myPlayerName?: string | null;
  onBongClaimed?: () => void;
  activePersonId?: string | null;
  activePerson?: Person | null;
  onCreatePerson?: (firstName: string) => Promise<Person | null>;
  onGoToProfile?: () => void;
}

export const KioskSection: React.FC<KioskSectionProps> = ({
  state,
  myPlayerName,
  onBongClaimed,
  activePersonId = null,
  activePerson = null,
  onCreatePerson,
  onGoToProfile,
}) => {
  const kioskItems = state.kioskItems || [];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
      {/* Popcorn Bong Card */}
      <PopcornBongCard
        popcorn={state.popcorn}
        className="mb-8"
        variant="kiosk"
        userName={myPlayerName}
        onCreatePerson={onCreatePerson}
        onBongClaimed={onBongClaimed}
        activePersonId={activePersonId}
        activePerson={activePerson}
        onGoToProfile={onGoToProfile}
      />

      {/* Kiosk Menu List */}
      <div className="rounded-3xl p-6 sm:p-8 bg-zinc-900 border-2 border-zinc-800 shadow-artistic-md mb-8">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Utensils className="w-5 h-5 text-amber-400" />
              Kioskmeny & Varmmat
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 font-medium">
              Åpen fra kl. 17:00 til 22:00 i Møglestuhallen
            </p>
          </div>
          <span className="text-xs font-black uppercase tracking-wider bg-zinc-950 text-zinc-300 px-3.5 py-1.5 rounded-xl border-2 border-zinc-800 shadow-artistic-sm">
            Vipps & Kontant
          </span>
        </div>

        {kioskItems.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-2xl bg-zinc-950 border-2 border-dashed border-zinc-800">
            <p className="text-sm font-bold text-zinc-400">Ingen varer i kioskmenyen for øyeblikket.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {kioskItems.map((item) => {
              const isAvail = item.isAvailable ?? true;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border-2 flex items-center justify-between gap-3 shadow-artistic-sm transition-all ${
                    isAvail
                      ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                      : 'bg-zinc-950/50 border-zinc-900 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{item.icon || '🛒'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-white text-sm truncate">
                          {item.name}
                        </h4>
                        {!isAvail && (
                          <span className="text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/40 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                            Utsolgt
                          </span>
                        )}
                        {item.category && (
                          <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold">
                            {item.category}
                          </span>
                        )}
                      </div>
                      {item.desc && (
                        <p className="text-xs text-zinc-400 font-medium truncate mt-0.5">
                          {item.desc}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-black text-amber-400 font-mono shrink-0">
                    {item.price}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
