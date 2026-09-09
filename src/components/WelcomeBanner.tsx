import React, { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface WelcomeBannerProps {
  onSetMyPlayer: (name: string) => void;
}

export const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
  onSetMyPlayer,
}) => {
  const [nameInput, setNameInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    onSetMyPlayer(nameInput.trim());
  };

  return (
    <div
      id="welcome-user-card"
      className="max-w-4xl mx-auto mb-8 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-2 border-lime-400 shadow-artistic-lime relative overflow-hidden"
    >
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-lime-400 text-zinc-950 text-xs font-black uppercase tracking-wider mb-3 shadow-artistic-sm -rotate-1">
          <Sparkles className="w-3.5 h-3.5" />
          Kom i gang
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight mb-2">
          👋 Velkommen til Lillesand United!
        </h2>
        <p className="text-xs sm:text-sm text-zinc-300 font-medium max-w-xl mb-6">
          Hva heter du? Skriv inn fornavnet ditt så er du automatisk klar for bordtenniscup, gratis popcorn og kvelden. Ingen passord eller innlogging trengs!
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mb-4">
          <input
            id="welcome-firstname-input"
            type="text"
            placeholder="Skriv inn fornavnet ditt..."
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            required
            maxLength={30}
            className="flex-1 px-4 py-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400 text-sm font-bold shadow-artistic-sm"
          />
          <button
            id="welcome-submit-btn"
            type="submit"
            disabled={!nameInput.trim()}
            className="px-6 py-3.5 rounded-2xl bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-zinc-950 font-black text-sm uppercase tracking-wider shadow-artistic-sm flex items-center justify-center gap-2 cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            <span>Fortsett</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t border-zinc-800/80 text-xs text-zinc-500 font-medium">
          Opprett eller endre profilen din under Min side.
        </div>
      </div>
    </div>
  );
};
