import React, { useState, useEffect, useMemo } from 'react';
import { Popcorn, CheckCircle, Sparkles, AlertCircle, Loader2, User, UserPlus, ArrowRightLeft } from 'lucide-react';
import { PopcornData, PopcornBong, Participant, Person } from '../types';
import { activatePopcornBong } from '../services/api';

interface PopcornBongCardProps {
  popcorn: PopcornData;
  onBongClaimed?: (bong: PopcornBong) => void;
  className?: string;
  variant?: 'hero' | 'kiosk';
  userName?: string | null;
  onSelectUser?: (name: string | null) => void;
  onSelectPerson?: (person: Person | null) => void;
  onCreatePerson?: (firstName: string) => Promise<Person | null>;
  participants?: Participant[];
  activePersonId?: string | null;
  persons?: Person[];
}

export const PopcornBongCard: React.FC<PopcornBongCardProps> = ({
  popcorn,
  onBongClaimed,
  className = '',
  variant = 'kiosk',
  userName = null,
  onSelectUser,
  onSelectPerson,
  onCreatePerson,
  participants = [],
  activePersonId = null,
  persons = [],
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string>(() => {
    return localStorage.getItem('lillesand_popcorn_guest_id') || 'guest_1';
  });
  const [customNameInput, setCustomNameInput] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);

  // Active Person resolution
  const activePerson = useMemo(() => {
    if (!activePersonId || !Array.isArray(persons)) return null;
    return persons.find((p) => p.id === activePersonId) || null;
  }, [activePersonId, persons]);

  // Active user name normalized
  const currentUserName = activePerson?.firstName || ((userName && userName.trim()) ? userName.trim() : null);

  const displayLabel = activePerson?.displayId || currentUserName;

  // Resolve client token — kun person-token eller gjest, aldri delt fornavn-token
  const clientToken = useMemo(() => {
    if (typeof window === 'undefined') return '';
    if (activePerson?.anonymousToken) {
      return activePerson.anonymousToken;
    }
    const key = `lillesand_popcorn_token_${guestId}`;
    let tok = localStorage.getItem(key);
    if (!tok) {
      tok = `usr_${guestId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      localStorage.setItem(key, tok);
    }
    return tok;
  }, [activePerson, guestId]);

  // Find this user's active or used bong (personId er primærnøkkel)
  const userBong = useMemo(() => {
    if (!popcorn?.bongs || !Array.isArray(popcorn.bongs)) return null;

    if (activePersonId) {
      const byPersonId = popcorn.bongs.find((b) => b.personId === activePersonId);
      if (byPersonId) return byPersonId;
      return null;
    }

    if (clientToken) {
      const byToken = popcorn.bongs.find((b) => b.clientToken === clientToken);
      if (byToken) return byToken;
    }

    return null;
  }, [popcorn, activePersonId, clientToken]);

  const totalCapacity = popcorn?.totalCapacity || 100;
  const blankBongsCount =
    popcorn?.bongs?.filter((b) => b.status === 'blank' && b.number <= totalCapacity).length || 0;
  const isSoldOut = blankBongsCount === 0 && !userBong;

  const handleActivate = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      let personIdToUse = activePersonId;
      let tokenToUse = activePerson?.anonymousToken || clientToken;

      if (!personIdToUse && currentUserName && onCreatePerson) {
        const created = await onCreatePerson(currentUserName);
        if (!created) {
          throw new Error('Kunne ikke opprette profil. Prøv igjen.');
        }
        personIdToUse = created.id;
        tokenToUse = created.anonymousToken;
      }

      if (!personIdToUse) {
        throw new Error('Velg eller opprett en profil før du aktiverer popcornbong.');
      }

      const res = await activatePopcornBong(
        tokenToUse,
        activePerson?.displayId || currentUserName || undefined,
        personIdToUse
      );
      if (onBongClaimed) {
        onBongClaimed(res.bong);
      }
    } catch (err: any) {
      setError(err.message || 'Kunne ikke hente popcornbong. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewGuestSession = () => {
    const nextId = 'guest_' + (Date.now() % 100000);
    localStorage.setItem('lillesand_popcorn_guest_id', nextId);
    setGuestId(nextId);
    if (onSelectUser) {
      onSelectUser(null);
    }
  };

  const handleAddCustomUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNameInput.trim()) return;
    const name = customNameInput.trim();
    if (onCreatePerson) {
      await onCreatePerson(name);
    } else if (onSelectUser) {
      onSelectUser(name);
    }
    setCustomNameInput('');
    setShowNameModal(false);
  };

  const selectablePersons = persons.length > 0
    ? persons
    : participants
        .filter((p) => p.personId)
        .map((p) => ({
          id: p.personId!,
          firstName: p.firstName,
          displayId: p.displayId || p.firstName,
          nameNumber: 1,
          anonymousToken: p.userId || '',
          createdAt: p.registeredAt,
          updatedAt: p.registeredAt,
        }));

  // User Profile switcher component
  const renderUserSwitcher = () => {
    return (
      <div className="mb-4 pb-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-bold">
            <User className="w-3.5 h-3.5" />
          </div>
          <span className="text-zinc-400 font-medium">Aktiv bruker:</span>
          <strong className="text-white font-black bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
            {displayLabel || 'Gjest / Ikke valgt'}
          </strong>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(onSelectPerson || onSelectUser) && selectablePersons.length > 0 && (
            <div className="flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-500" />
              <select
                id={`popcorn-user-select-${variant}`}
                value={activePersonId || ''}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    if (onSelectPerson) onSelectPerson(null);
                    else if (onSelectUser) onSelectUser(null);
                    return;
                  }
                  const person = selectablePersons.find((p) => p.id === id);
                  if (person && onSelectPerson) {
                    onSelectPerson(person as Person);
                  } else if (person && onSelectUser) {
                    onSelectUser(person.firstName);
                  }
                }}
                className="bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                title="Bytt profil for å se eller hente unik popcorn-bong"
              >
                <option value="">Gjest (ikke valgt)</option>
                {selectablePersons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayId || p.firstName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowNameModal(true)}
            className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 font-bold text-xs flex items-center gap-1 transition-all"
            title="Test med et nytt navn"
          >
            <UserPlus className="w-3 h-3 text-amber-400" />
            <span>Ny testbruker</span>
          </button>

          <button
            type="button"
            onClick={handleNewGuestSession}
            className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-all"
            title="Simuler ny mobil/enhet som gjest"
          >
            Ny gjesteøkt
          </button>
        </div>

        {/* Modal for adding custom test user */}
        {showNameModal && (
          <form
            onSubmit={handleAddCustomUser}
            className="w-full mt-2 p-3 bg-zinc-950 rounded-xl border border-zinc-700 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Skriv inn fornavn (f.eks. Mia, Tobias)..."
              value={customNameInput}
              onChange={(e) => setCustomNameInput(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 px-3 py-1.5 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-400 text-zinc-950 rounded-lg font-black text-xs uppercase"
            >
              Velg
            </button>
            <button
              type="button"
              onClick={() => setShowNameModal(false)}
              className="px-2 py-1.5 text-zinc-400 hover:text-white text-xs"
            >
              Avbryt
            </button>
          </form>
        )}
      </div>
    );
  };

  // 1. User has already retrieved the popcorn (USED)
  if (userBong && userBong.status === 'used') {
    return (
      <div
        id={`popcorn-card-used-${variant}`}
        className={`bg-zinc-900 border-2 border-zinc-800 rounded-2xl p-6 relative overflow-hidden shadow-artistic-md ${className}`}
      >
        {renderUserSwitcher()}

        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <CheckCircle className="w-4 h-4 text-lime-400" />
            Bong #{userBong.number} løst inn
          </div>
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 border border-zinc-700">
            <Popcorn className="w-8 h-8 text-amber-400" />
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight uppercase">
            🍿 POPCORN HENTET ✓
          </h3>
          <p className="text-zinc-400 text-sm mt-2 max-w-md mx-auto">
            {displayLabel ? (
              <>
                <strong className="text-white">{displayLabel}</strong> har hentet gratis popcorn med{' '}
                <span className="font-bold text-white">bong #{userBong.number}</span>.
              </>
            ) : (
              <>
                Du har hentet ditt gratis popcorn med{' '}
                <span className="font-bold text-white">bong #{userBong.number}</span>.
              </>
            )}{' '}
            Kos deg med nypoppet popcorn og arrangementet!
          </p>
        </div>
      </div>
    );
  }

  // 2. User has an active bong ready to be picked up
  if (userBong && userBong.status === 'activated') {
    return (
      <div
        id={`popcorn-card-active-${variant}`}
        className={`bg-gradient-to-b from-amber-950/40 via-zinc-900 to-zinc-950 border-2 border-amber-500/80 rounded-2xl p-6 relative overflow-hidden shadow-artistic-lg ${className}`}
      >
        {renderUserSwitcher()}

        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-full text-xs font-bold uppercase tracking-wider mb-3 animate-pulse">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Klar til henting i kiosken
          </div>

          <h4 className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
            🍿 DIN POPCORN-BONG
            {activePerson?.displayId ? (
              <span className="text-zinc-300 block text-xs font-bold mt-0.5">
                (Tilhører: {activePerson.displayId})
              </span>
            ) : userBong.userName ? (
              <span className="text-zinc-300 block text-xs font-bold mt-0.5">
                (Tilhører: {userBong.userName})
              </span>
            ) : null}
          </h4>

          <div className="my-4">
            <div className="inline-block px-8 py-3 bg-amber-500 text-zinc-950 rounded-2xl shadow-artistic-md">
              <span className="text-5xl sm:text-6xl font-black tracking-tighter">
                #{userBong.number}
              </span>
            </div>
          </div>

          <p className="text-base sm:text-lg font-bold text-white max-w-sm mx-auto">
            Vis nummer <span className="text-amber-300 font-extrabold">#{userBong.number}</span> til personalet når du henter popcorn.
          </p>

          <p className="text-xs text-zinc-400 mt-2">
            Bongen er reservert for deg. Du trenger ikke skynde deg – personalet sjekker nummeret ditt i kiosken.
          </p>
        </div>
      </div>
    );
  }

  // 3. Sold out view
  if (isSoldOut) {
    return (
      <div
        id={`popcorn-card-soldout-${variant}`}
        className={`bg-zinc-900 border-2 border-zinc-800 rounded-2xl p-6 relative shadow-artistic-md ${className}`}
      >
        {renderUserSwitcher()}

        <div className="text-center">
          <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 text-zinc-500">
            <Popcorn className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">
            🍿 GRATIS POPCORN
          </h3>
          <p className="text-amber-400 font-bold text-base mt-2">
            Alle de {totalCapacity} popcornbongene er delt ut.
          </p>
          <p className="text-zinc-400 text-sm mt-1">
            Kiosken har fortsatt masse annet digg til salgs hele kvelden (pølser, brus, sjokolade og snacks)!
          </p>
        </div>
      </div>
    );
  }

  // 4. Default: User has NOT claimed a bong yet and must activate it
  return (
    <div
      id={`popcorn-card-claim-${variant}`}
      className={`bg-zinc-900 border-2 border-amber-500/50 rounded-2xl p-6 sm:p-7 relative overflow-hidden shadow-artistic-md ${className}`}
    >
      {renderUserSwitcher()}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
            <Popcorn className="w-3.5 h-3.5" />
            Gratis velkomstgave
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
            🍿 GRATIS POPCORN TIL DE FØRSTE {totalCapacity}!
          </h3>
        </div>
        <div className="hidden sm:block text-right">
          <span className="text-xs text-zinc-400 uppercase tracking-widest font-semibold block">
            Gjenværende
          </span>
          <span className="text-xl font-black text-amber-400">
            {blankBongsCount} av {totalCapacity}
          </span>
        </div>
      </div>

      <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-3">
        {currentUserName ? (
          <>
            Har du lyst på gratis popcorn, <strong className="text-amber-400">{displayLabel || currentUserName}</strong>? Trykk{' '}
            <strong className="text-white">"TA MOT POPCORN"</strong> for å hente din personlige popcornbong.
          </>
        ) : (
          <>
            Har du lyst på gratis popcorn? Trykk <strong className="text-white">"TA MOT POPCORN"</strong> for å få din popcornbong.
          </>
        )}
      </p>

      <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-5">
        Hver enkelt bruker må aktivere popcorn-bong for å få sitt unike nummer i rekkefølge (1–{totalCapacity}). Du trenger ikke aktivere hvis du ikke ønsker popcorn.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          id={`btn-claim-popcorn-${variant}`}
          onClick={handleActivate}
          disabled={loading}
          className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-base uppercase tracking-wider rounded-xl shadow-artistic-md transition-all active:translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Tildeler nummer...
            </>
          ) : (
            <>
              <Popcorn className="w-5 h-5 text-zinc-950" />
              {displayLabel ? `TA MOT POPCORN (${displayLabel})` : 'TA MOT POPCORN'}
            </>
          )}
        </button>

        <span className="text-xs text-zinc-400 text-center sm:text-left">
          {blankBongsCount} ledige bonger igjen (fås i rekkefølge 1–{totalCapacity})
        </span>
      </div>
    </div>
  );
};
