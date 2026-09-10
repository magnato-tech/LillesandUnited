import React, { useEffect, useState } from 'react';
import { Bell, X, ArrowRight, Swords, Sparkles, Trophy } from 'lucide-react';
import { InAppPushAlert } from '../lib/tournament-notifications';

interface InAppNotificationBannerProps {
  alert: InAppPushAlert | null;
  onDismiss: () => void;
  onGoToTournament: () => void;
  onEnableBrowserPush?: () => void;
  browserPushState?: NotificationPermission | null;
}

export const InAppNotificationBanner: React.FC<InAppNotificationBannerProps> = ({
  alert,
  onDismiss,
  onGoToTournament,
  onEnableBrowserPush,
  browserPushState,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!alert) return;

    setProgress(100);
    const duration = 16000; // 16 seconds display
    const intervalTime = 100;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [alert, onDismiss]);

  if (!alert) return null;

  const isTwoMatches = alert.stage === 'two_matches_away';
  const isOneMatch = alert.stage === 'one_match_away';
  const isNow = alert.stage === 'playing_now' || alert.stage === 'ready_table';

  return (
    <div
      id="in-app-push-banner"
      role="alert"
      className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-lg animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <div
        className={`relative overflow-hidden rounded-2xl border-2 p-4 sm:p-5 shadow-2xl backdrop-blur-xl transition-all ${
          isNow
            ? 'bg-zinc-950/95 border-lime-400 text-white shadow-lime-400/20'
            : isTwoMatches
            ? 'bg-zinc-950/95 border-amber-400 text-white shadow-amber-400/20'
            : 'bg-zinc-950/95 border-orange-500 text-white shadow-orange-500/20'
        }`}
      >
        {/* Animated Accent glow bar */}
        <div
          className={`absolute top-0 left-0 h-1 transition-all duration-100 ease-linear ${
            isNow ? 'bg-lime-400' : isTwoMatches ? 'bg-amber-400' : 'bg-orange-500'
          }`}
          style={{ width: `${progress}%` }}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 flex-1">
            {/* Pulsing Icon */}
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                isNow
                  ? 'bg-lime-400 text-zinc-950 ring-4 ring-lime-400/20 animate-pulse'
                  : isTwoMatches
                  ? 'bg-amber-400 text-zinc-950 ring-4 ring-amber-400/20'
                  : 'bg-orange-500 text-zinc-950 ring-4 ring-orange-500/20'
              }`}
            >
              <Bell className="w-5 h-5 animate-bounce" />
            </div>

            <div className="flex-1 min-w-0">
              {/* Badge */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm inline-flex items-center gap-1 ${
                    isNow
                      ? 'bg-lime-400 text-zinc-950'
                      : isTwoMatches
                      ? 'bg-amber-400 text-zinc-950'
                      : 'bg-orange-500 text-zinc-950'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  {isTwoMatches
                    ? 'Push-varsel: 2 kamper igjen!'
                    : isOneMatch
                    ? 'Push-varsel: Neste kamp!'
                    : 'Push-varsel: Kampen starter nå!'}
                </span>
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">
                  {alert.roundName}
                </span>
              </div>

              {/* Title & Body */}
              <h4 className="text-sm sm:text-base font-black text-white tracking-tight leading-snug">
                {alert.title}
              </h4>
              <p className="text-xs sm:text-sm text-zinc-300 mt-1 font-medium leading-relaxed">
                {alert.message}
              </p>

              {/* Action Buttons */}
              <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                <button
                  id="in-app-push-action-btn"
                  onClick={() => {
                    onGoToTournament();
                    onDismiss();
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm ${
                    isNow
                      ? 'bg-lime-400 text-zinc-950 hover:bg-lime-300'
                      : isTwoMatches
                      ? 'bg-amber-400 text-zinc-950 hover:bg-amber-300'
                      : 'bg-orange-500 text-zinc-950 hover:bg-orange-400'
                  }`}
                >
                  <span>Gå til bordtennis</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {onEnableBrowserPush && browserPushState === 'default' && (
                  <button
                    onClick={onEnableBrowserPush}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                  >
                    Tillat varsler på mobil
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Dismiss button */}
          <button
            id="in-app-push-dismiss-btn"
            onClick={onDismiss}
            aria-label="Lukk varsel"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
