import React from 'react';
import { Home, User, Trophy, Sparkles, Popcorn } from 'lucide-react';
import { Person } from '../types';

interface MobileBottomNavProps {
  currentTab: 'home' | 'profile' | 'tabletennis' | 'alpha' | 'kiosk' | 'display' | 'admin';
  onNavigate: (tab: 'home' | 'profile' | 'tabletennis' | 'alpha' | 'kiosk' | 'display' | 'admin') => void;
  tournamentActive: boolean;
  activePerson?: Person | null;
  myPlayerName?: string | null;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onNavigate,
  tournamentActive,
  activePerson,
  myPlayerName,
}) => {
  const profileName = activePerson?.firstName || myPlayerName;

  const navItems = [
    {
      id: 'home' as const,
      label: 'Oversikt',
      icon: Home,
      activeColor: 'text-lime-400',
      activeBg: 'bg-lime-400/10',
    },
    {
      id: 'profile' as const,
      label: profileName ? profileName : 'Min side',
      icon: User,
      activeColor: 'text-lime-400',
      activeBg: 'bg-lime-400/10',
    },
    {
      id: 'tabletennis' as const,
      label: 'Bordtennis',
      icon: Trophy,
      activeColor: 'text-lime-400',
      activeBg: 'bg-lime-400/10',
      hasLiveBadge: tournamentActive,
    },
    {
      id: 'alpha' as const,
      label: 'Alpha',
      icon: Sparkles,
      activeColor: 'text-sky-400',
      activeBg: 'bg-sky-400/10',
    },
    {
      id: 'kiosk' as const,
      label: 'Kiosk',
      icon: Popcorn,
      activeColor: 'text-orange-400',
      activeBg: 'bg-orange-400/10',
    },
  ];

  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Mobil navigasjon"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-lg border-t-2 border-zinc-800 px-1 py-1.5 shadow-[0_-8px_25px_rgba(0,0,0,0.5)]"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-around gap-0.5">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              id={`mobile-tab-${item.id}`}
              onClick={() => onNavigate(item.id)}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all relative ${
                isActive
                  ? `${item.activeBg} ${item.activeColor} font-black`
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110' : 'scale-100'
                  }`}
                />
                {item.hasLiveBadge && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-lime-400 border border-zinc-950"></span>
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight mt-0.5 truncate max-w-full ${
                  isActive ? 'font-black' : 'font-semibold'
                }`}
              >
                {item.label}
              </span>

              {/* Active subtle pill indicator dot */}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-current mt-0.5 animate-in fade-in" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
