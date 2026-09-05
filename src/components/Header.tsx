import React from 'react';
import { Trophy, Sparkles, Tv, ShieldCheck, Home, Popcorn, UserCheck, User } from 'lucide-react';
import { Participant } from '../types';

interface HeaderProps {
  currentTab: 'home' | 'profile' | 'tabletennis' | 'alpha' | 'kiosk' | 'display' | 'admin';
  setCurrentTab: (tab: 'home' | 'profile' | 'tabletennis' | 'alpha' | 'kiosk' | 'display' | 'admin') => void;
  tournamentActive: boolean;
  myPlayerName: string | null;
  onSetMyPlayer: (name: string | null) => void;
  participants: Participant[];
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  tournamentActive,
  myPlayerName,
  onSetMyPlayer,
  participants,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b-2 border-zinc-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo / Brand */}
          <div 
            id="brand-logo"
            onClick={() => setCurrentTab('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-lime-400 flex items-center justify-center font-black text-zinc-950 shadow-artistic-sm -rotate-2 group-hover:rotate-0 transition-transform">
              <span className="text-xl sm:text-2xl font-black tracking-tighter">LU</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg sm:text-xl tracking-tight text-white group-hover:text-lime-400 transition-colors uppercase">
                  LILLESAND <span className="text-lime-400">UNITED</span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-orange-500 text-zinc-950 px-2 py-0.5 rounded shadow-artistic-sm rotate-1">
                  18. Sept
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-semibold hidden sm:block">
                Møglestuhallen • 17:00 – 22:45 • Gratis inngang
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <button
              id="nav-home-btn"
              onClick={() => setCurrentTab('home')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border ${
                currentTab === 'home'
                  ? 'bg-zinc-800 text-lime-400 border-zinc-700 shadow-artistic-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent hover:border-zinc-800'
              }`}
            >
              <Home className="w-4 h-4" />
              Oversikt
            </button>

            <button
              id="nav-profile-btn"
              onClick={() => setCurrentTab('profile')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border ${
                currentTab === 'profile'
                  ? 'bg-lime-400 text-zinc-950 border-lime-400 shadow-artistic-sm font-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent hover:border-zinc-800'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Min side</span>
              {myPlayerName && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-950/20 font-mono font-bold">
                  {myPlayerName}
                </span>
              )}
            </button>

            <button
              id="nav-cup-btn"
              onClick={() => setCurrentTab('tabletennis')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 relative border ${
                currentTab === 'tabletennis'
                  ? 'bg-lime-400 text-zinc-950 border-lime-400 shadow-artistic-sm font-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent hover:border-zinc-800'
              }`}
            >
              <Trophy className="w-4 h-4" />
              Bordtenniscup
              {tournamentActive && (
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-lime-400"></span>
                </span>
              )}
            </button>

            <button
              id="nav-alpha-btn"
              onClick={() => setCurrentTab('alpha')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border ${
                currentTab === 'alpha'
                  ? 'bg-sky-400 text-zinc-950 border-sky-400 shadow-artistic-sm font-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent hover:border-zinc-800'
              }`}
            >
              <Sparkles className="w-4 h-4 text-sky-400" />
              UngdomsAlpha
            </button>

            <button
              id="nav-kiosk-btn"
              onClick={() => setCurrentTab('kiosk')}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border ${
                currentTab === 'kiosk'
                  ? 'bg-orange-500 text-zinc-950 border-orange-500 shadow-artistic-sm font-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent hover:border-zinc-800'
              }`}
            >
              <Popcorn className="w-4 h-4 text-orange-400" />
              Kiosk & Popcorn
            </button>

            <button
              id="nav-display-btn"
              onClick={() => setCurrentTab('display')}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                currentTab === 'display'
                  ? 'bg-purple-500 text-white border-purple-500 shadow-artistic-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent hover:border-zinc-800'
              }`}
              title="Storskjermmodus for projektor i hallen"
            >
              <Tv className="w-4 h-4" />
              Storskjerm
            </button>

            <button
              id="nav-admin-btn"
              onClick={() => setCurrentTab('admin')}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                currentTab === 'admin'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-artistic-sm'
                  : 'text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin
            </button>
          </nav>

          {/* Right side: Player selection dropdown & mobile triggers */}
          <div className="flex items-center gap-2">
            {/* Person selector dropdown in top right */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-2.5 py-1.5 shadow-artistic-sm hover:border-lime-400/60 transition-all">
              <UserCheck className="w-4 h-4 text-lime-400 shrink-0" />
              <select
                id="header-user-select"
                value={myPlayerName || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__guest__') {
                    onSetMyPlayer(null);
                  } else if (val === '__new__') {
                    const input = window.prompt('Skriv inn fornavn for ny person:');
                    if (input && input.trim()) onSetMyPlayer(input.trim());
                  } else if (val) {
                    onSetMyPlayer(val);
                  }
                }}
                className="bg-transparent text-xs font-black uppercase tracking-wider text-white focus:outline-none cursor-pointer pr-1 max-w-[130px] truncate"
              >
                <option value="" disabled className="bg-zinc-950 text-zinc-400">
                  Velg person...
                </option>
                {Array.from(
                  new Set([
                    ...(myPlayerName ? [myPlayerName] : []),
                    'Oliver',
                    'Emma',
                    'Sander',
                    'Thea',
                    ...participants.map((p) => p.firstName),
                  ])
                ).map((name) => (
                  <option key={name} value={name} className="bg-zinc-950 text-white font-bold">
                    👤 {name} {myPlayerName && myPlayerName.toLowerCase() === name.toLowerCase() ? '✓' : ''}
                  </option>
                ))}
                <option value="__guest__" className="bg-zinc-950 text-zinc-400">
                  — Ingen / Anonym —
                </option>
                <option value="__new__" className="bg-zinc-950 text-lime-400 font-bold">
                  + Ny testbruker...
                </option>
              </select>
            </div>

            {/* Mobile Admin Icon */}
            <button
              id="mobile-admin-icon"
              onClick={() => setCurrentTab('admin')}
              className="md:hidden p-2 rounded-xl bg-zinc-900 border-2 border-zinc-800 text-zinc-400 hover:text-white shadow-artistic-sm"
              title="Admin"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Bottom Sub-navigation bar */}
        <div className="md:hidden flex items-center justify-between gap-1 py-2 border-t-2 border-zinc-900 overflow-x-auto">
          <button
            onClick={() => setCurrentTab('home')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${
              currentTab === 'home' ? 'bg-zinc-800 text-lime-400 shadow-artistic-sm' : 'text-zinc-400'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            Oversikt
          </button>
          <button
            id="mobile-nav-profile-btn"
            onClick={() => setCurrentTab('profile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${
              currentTab === 'profile' ? 'bg-lime-400 text-zinc-950 shadow-artistic-sm font-black' : 'text-zinc-400'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            {myPlayerName ? myPlayerName : 'Min side'}
          </button>
          <button
            onClick={() => setCurrentTab('tabletennis')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${
              currentTab === 'tabletennis' ? 'bg-lime-400 text-zinc-950 shadow-artistic-sm' : 'text-zinc-400'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Bordtennis
          </button>
          <button
            onClick={() => setCurrentTab('alpha')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${
              currentTab === 'alpha' ? 'bg-sky-400 text-zinc-950 shadow-artistic-sm' : 'text-zinc-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Alpha
          </button>
          <button
            onClick={() => setCurrentTab('kiosk')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${
              currentTab === 'kiosk' ? 'bg-orange-500 text-zinc-950 shadow-artistic-sm' : 'text-zinc-400'
            }`}
          >
            <Popcorn className="w-3.5 h-3.5" />
            Kiosk
          </button>
          <button
            onClick={() => setCurrentTab('display')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${
              currentTab === 'display' ? 'bg-purple-500 text-white shadow-artistic-sm' : 'text-zinc-400'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            Storskjerm
          </button>
        </div>
      </div>
    </header>
  );
};
