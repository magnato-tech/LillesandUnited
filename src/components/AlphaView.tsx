import React, { useState } from 'react';
import { Sparkles, Calendar, Clock, MapPin, Heart, CheckCircle2, MessageCircle, Utensils, UserCheck, AlertCircle } from 'lucide-react';
import { registerAlphaInterest } from '../services/api';
import { Person, AlphaInterest } from '../types';

interface AlphaViewProps {
  activePersonId?: string | null;
  persons?: Person[];
  alphaInterests?: AlphaInterest[];
  onSuccessRegistered?: () => void;
}

export const AlphaView: React.FC<AlphaViewProps> = ({
  activePersonId,
  persons = [],
  alphaInterests = [],
  onSuccessRegistered,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPerson = persons.find((p) => p.id === activePersonId) || null;
  const isAlreadyInterested = Boolean(
    activePersonId && alphaInterests.some((a) => a.personId === activePersonId)
  );

  const handleExpressInterest = async () => {
    if (!currentPerson) return;

    setLoading(true);
    setError(null);
    try {
      await registerAlphaInterest(currentPerson.id, currentPerson.anonymousToken, currentPerson.firstName);
      if (onSuccessRegistered) onSuccessRegistered();
    } catch (err: any) {
      setError(err.message || 'Kunne ikke registrere interesse.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
      {/* Hero Banner with Youth Alpha Theme */}
      <div className="relative rounded-3xl overflow-hidden bg-zinc-900 p-6 sm:p-10 border-2 border-sky-400 shadow-artistic-md mb-8">
        {/* Decorative graphic doodles overlay */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-sky-400 text-zinc-950 text-xs font-black uppercase tracking-wider mb-4 shadow-artistic-sm -rotate-1">
            <Sparkles className="w-3.5 h-3.5" />
            UngdomsAlpha Lillesand
          </div>

          <h1 className="text-5xl sm:text-7xl font-black text-white uppercase tracking-tight mb-3">
            Alpha <span className="text-sky-400 drop-shadow-[0_0_25px_rgba(56,189,248,0.4)]">Youth</span>
          </h1>

          <p className="text-base sm:text-xl font-black text-zinc-100 max-w-2xl mb-3">
            Et trygt og morsomt sted for å utforske livet, tro og mening – helt uten fasitsvar og press.
          </p>

          <p className="text-sm text-zinc-400 max-w-xl mb-6 font-medium leading-relaxed">
            Spis gratis digg mat, se morsomme videoer med vertene Xenia og gjengen, og diskuter hva DU tenker om de store spørsmålene i hverdagen.
          </p>

          {/* Quick Date Badge */}
          <div className="inline-flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-artistic-sm text-white">
            <div className="flex items-center gap-2 text-sm font-black text-sky-400 uppercase tracking-wide">
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>Oppstart: Fredag 25. september</span>
            </div>
            <span className="text-zinc-700 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-bold">
              <Clock className="w-4 h-4 text-orange-400" />
              <span>Kl. 19:00</span>
            </div>
            <span className="text-zinc-700 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-bold">
              <MapPin className="w-4 h-4 text-lime-400" />
              <span>Lillesand</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Pillars of Alpha Youth */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm hover:border-zinc-700 transition-colors">
          <div className="w-14 h-14 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-orange-400 flex items-center justify-center mb-4 shadow-artistic-sm -rotate-2">
            <Utensils className="w-6 h-6" />
          </div>
          <h3 className="font-black text-white text-lg uppercase tracking-tight mb-1">Gratis digg mat</h3>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-medium">
            Vi starter alltid hver samling med et deilig måltid, snacks og tid til å bare henge med venner.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm hover:border-zinc-700 transition-colors">
          <div className="w-14 h-14 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-sky-400 flex items-center justify-center mb-4 shadow-artistic-sm rotate-1">
            <MessageCircle className="w-6 h-6" />
          </div>
          <h3 className="font-black text-white text-lg uppercase tracking-tight mb-1">Gode samtaler</h3>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-medium">
            Se inspirerende filmer og si akkurat det du mener. Ingen spørsmål er for dumme eller for store.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm hover:border-zinc-700 transition-colors">
          <div className="w-14 h-14 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-rose-400 flex items-center justify-center mb-4 shadow-artistic-sm -rotate-1">
            <Heart className="w-6 h-6" />
          </div>
          <h3 className="font-black text-white text-lg uppercase tracking-tight mb-1">Null press</h3>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-medium">
            Alt er helt uforpliktende og gratis. Bli med én kveld og se om det er noe for deg!
          </p>
        </div>
      </div>

      {/* Registration / Interest Card */}
      <div className="rounded-3xl p-6 sm:p-8 bg-zinc-900 border-2 border-zinc-800 shadow-artistic-md">
        {!currentPerson ? (
          <div className="text-center py-6 max-w-md mx-auto space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-zinc-400 flex items-center justify-center mx-auto shadow-artistic-sm">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">
              Velg hvem du er
            </h3>
            <p className="text-zinc-400 text-xs sm:text-sm font-medium">
              Velg eller opprett profilen din øverst i appen for å melde din interesse for UngdomsAlpha.
            </p>
          </div>
        ) : isAlreadyInterested ? (
          <div className="text-center py-6 max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-sky-400 text-zinc-950 flex items-center justify-center mx-auto shadow-artistic-sm -rotate-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-zinc-950 border border-sky-400/40 text-sky-400 text-xs font-black">
              ✓ Du har meldt interesse
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Takk for interessen, {currentPerson.firstName}! 🎉
            </h3>
            <p className="text-zinc-300 text-sm font-medium leading-relaxed">
              Vi har registrert interessen din for profilen din (<strong className="text-white font-mono">{currentPerson.displayId}</strong>).
              Vi gleder oss til å se deg på oppstarten fredag 25. september kl. 19:00!
            </p>
          </div>
        ) : (
          <div className="max-w-xl mx-auto text-center space-y-5">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-2">
                Vis interesse for UngdomsAlpha
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium">
                Uforpliktende interessepåmelding. Du melder interesse som{' '}
                <strong className="text-white font-mono">{currentPerson.displayId}</strong>.
              </p>
            </div>

            <div>
              <button
                id="btn-alpha-interest"
                type="button"
                disabled={loading}
                onClick={handleExpressInterest}
                className="w-full py-4 px-6 rounded-2xl bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-zinc-950 font-black text-sm uppercase tracking-wider shadow-artistic-sm flex items-center justify-center gap-2 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-zinc-950" />
                {loading ? 'Registrerer...' : 'Ja, jeg er interessert!'}
              </button>
            </div>

            {error && (
              <div className="flex items-center justify-center gap-2 text-xs text-rose-400 font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
