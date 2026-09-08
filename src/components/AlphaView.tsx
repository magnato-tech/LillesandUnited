import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, Clock, MapPin, Heart, CheckCircle2, Send, MessageCircle, Utensils, ShieldCheck, UserCheck } from 'lucide-react';
import { registerAlphaInterest } from '../services/api';
import { getUserToken } from '../lib/userProfile';

interface AlphaViewProps {
  myPlayerName?: string | null;
  onSuccessRegistered?: () => void;
}

export const AlphaView: React.FC<AlphaViewProps> = ({ myPlayerName, onSuccessRegistered }) => {
  const [name, setName] = useState(myPlayerName || '');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (myPlayerName) {
      setName(myPlayerName);
    }
  }, [myPlayerName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const userToken = getUserToken();
      await registerAlphaInterest(name.trim(), phone.trim() || undefined, undefined, userToken);
      setSubmitted(true);
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

      <div className="mb-8 rounded-3xl overflow-hidden bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm">
        <div className="relative w-full aspect-video">
          <iframe
            className="absolute inset-0 w-full h-full"
            src="https://www.youtube.com/embed/aPPOuEXwZAc"
            title="Alpha Youth trailer"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
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

      {/* Registration / Interest Form */}
      <div className="rounded-3xl p-6 sm:p-8 bg-zinc-900 border-2 border-zinc-800 shadow-artistic-md">
        {submitted ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-lime-400 text-zinc-950 flex items-center justify-center mx-auto mb-4 shadow-artistic-sm -rotate-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
              Takk for interessen! 🎉
            </h3>
            <p className="text-zinc-300 text-sm max-w-md mx-auto mb-6 font-medium">
              Vi har registrert fornavnet ditt. Du vil få en hyggelig påminnelse før oppstarten fredag 25. september kl. 19:00.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="text-xs font-black uppercase tracking-wider text-lime-400 hover:underline"
            >
              Meld på en venn til?
            </button>
          </div>
        ) : (
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-2">
                Vis interesse for UngdomsAlpha
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium">
                Uforpliktende interessepåmelding. Kun fornavn er påkrevd. Du bestemmer selv om du vil legge til telefonnummer for SMS-påminnelse.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider mb-1.5">
                  Ditt fornavn <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="F.eks. Emilie"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-sky-400 text-sm font-bold shadow-artistic-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Mobilnummer for SMS-påminnelse</span>
                  <span className="text-zinc-500 text-[10px] lowercase font-normal">(valgfritt)</span>
                </label>
                <input
                  type="tel"
                  placeholder="8 siffer (valgfritt)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-sky-400 text-sm font-bold shadow-artistic-sm"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="w-full py-4 px-6 rounded-2xl bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-zinc-950 font-black text-sm uppercase tracking-wider shadow-artistic-sm flex items-center justify-center gap-2 active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                  <Send className="w-4 h-4" />
                  {loading ? 'Sender inn...' : 'Ja, jeg er interessert!'}
                </button>
              </div>

              {error && (
                <p className="text-xs text-rose-400 text-center font-bold mt-2">
                  {error}
                </p>
              )}

              <p className="text-[11px] text-zinc-500 text-center flex items-center justify-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                Personvern: Vi deler aldri opplysningene dine. Kun for oppfølging til kurset.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
