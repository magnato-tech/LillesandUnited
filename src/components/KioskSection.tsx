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
  const kioskItems = [
    { name: 'Nypoppet Popcorn', desc: 'Første 100 beger gratis med digital bong!', price: 'Gratis bong / 20 kr', icon: '🍿', free: true },
    { name: 'Varm Grillpølse i brød', desc: 'Serveres med ketchup og sennep', price: '25 kr', icon: '🌭' },
    { name: 'Varm Wienerpølse', desc: 'I lompe eller brød', price: '20 kr', icon: '🌭' },
    { name: 'Iskald Brus (0.5L)', desc: 'Coca-Cola, Solo, Sprite, Urge, Pepsi Max', price: '25 kr', icon: '🥤' },
    { name: 'Sjokolade & Snacks', desc: 'Melkesjokolade, Smash, Kvikklunsj', price: '20 kr', icon: '🍫' },
    { name: 'Kaffe & Te (til voksne/ledere)', desc: 'Nytraktet filterkaffe', price: '15 kr', icon: '☕' },
  ];

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
              Åpen fra kl. 17:00 til 22:45 i Møglestuhallen
            </p>
          </div>
          <span className="text-xs font-black uppercase tracking-wider bg-zinc-950 text-zinc-300 px-3.5 py-1.5 rounded-xl border-2 border-zinc-800 shadow-artistic-sm">
            Vipps & Kontant
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {kioskItems.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between gap-3 hover:border-zinc-700 shadow-artistic-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <h4 className="font-black text-white text-sm flex items-center gap-1.5">
                    {item.name}
                    {item.free && (
                      <span className="text-[10px] bg-lime-400 text-zinc-950 px-2 py-0.5 rounded-md font-black shadow-artistic-sm">
                        GRATIS BONG
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-zinc-400 font-medium">{item.desc}</p>
                </div>
              </div>
              <span className="text-sm font-black text-amber-400 font-mono shrink-0">
                {item.price}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
