import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tournament } from '../types';
import { applyFormatSettingsToPlayableMatches } from '../lib/tournament';
import {
  applySimulatedMatchToTournament,
  getNextPlayableMatch,
  isTournamentComplete,
} from '../lib/tournament-simulator';

export type SimulatorStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed';
export type SimulatorDelay = 0 | 1000 | 2000;

export function useTournamentSimulator(onRefresh: () => void | Promise<void>) {
  const [status, setStatus] = useState<SimulatorStatus>('idle');
  const [delayMs, setDelayMs] = useState<SimulatorDelay>(2000);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [matchesPlayed, setMatchesPlayed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [simTournament, setSimTournament] = useState<Tournament | null>(null);

  const statusRef = useRef(status);
  const delayRef = useRef(delayMs);
  const abortRef = useRef(false);
  const loopIdRef = useRef(0);
  const simTournamentRef = useRef<Tournament | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    delayRef.current = delayMs;
  }, [delayMs]);

  const publishClone = useCallback((clone: Tournament | null) => {
    simTournamentRef.current = clone;
    if (!clone) {
      setSimTournament(null);
      return;
    }
    setSimTournament({
      ...clone,
      matches: [...clone.matches],
      participants: [...clone.participants],
      winner: clone.winner,
    });
  }, []);

  const waitWhilePaused = useCallback(async () => {
    while (statusRef.current === 'paused' && !abortRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }, []);

  const start = useCallback(
    (source: Tournament) => {
      if (simTournamentRef.current) return;
      if (statusRef.current === 'running' || statusRef.current === 'paused') return;

      const clone = structuredClone(source);
      applyFormatSettingsToPlayableMatches(clone);
      abortRef.current = false;
      const loopId = ++loopIdRef.current;
      setError(null);
      setMatchesPlayed(0);
      setCurrentMatchId(null);
      publishClone(clone);
      setStatus('running');
      statusRef.current = 'running';

      const run = async () => {
        while (!abortRef.current && loopIdRef.current === loopId) {
          await waitWhilePaused();
          if (abortRef.current || loopIdRef.current !== loopId) break;
          if (statusRef.current !== 'running') continue;

          const current = simTournamentRef.current;
          if (!current) break;

          const next = getNextPlayableMatch(current.matches);
          if (!next) {
            setCurrentMatchId(null);
            const finalStatus = isTournamentComplete(current.matches, current.winner)
              ? 'completed'
              : 'stopped';
            setStatus(finalStatus);
            statusRef.current = finalStatus;
            break;
          }

          setCurrentMatchId(next.id);
          try {
            applySimulatedMatchToTournament(current, next.id);
            publishClone(current);
            setMatchesPlayed((n) => n + 1);
          } catch (err: any) {
            console.error('Simulering feilet for kamp:', next.id, err);
            setError(err.message || 'Kunne ikke simulere kamp');
            setStatus('stopped');
            statusRef.current = 'stopped';
            setCurrentMatchId(null);
            break;
          }

          const delay = delayRef.current;
          // Yield to browser event loop even on 0s delay to allow React rendering & prevent nested update depth exhaustion
          await new Promise((resolve) => setTimeout(resolve, delay > 0 ? delay : 20));
        }
      };

      void run();
    },
    [publishClone, waitWhilePaused]
  );

  const pause = useCallback(() => {
    if (statusRef.current === 'running') {
      setStatus('paused');
      statusRef.current = 'paused';
    }
  }, []);

  const resume = useCallback(() => {
    if (statusRef.current === 'paused' && simTournamentRef.current) {
      setStatus('running');
      statusRef.current = 'running';
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current = true;
    loopIdRef.current += 1;
    setStatus('stopped');
    statusRef.current = 'stopped';
    setCurrentMatchId(null);
  }, []);

  const exit = useCallback(() => {
    abortRef.current = true;
    loopIdRef.current += 1;
    publishClone(null);
    setStatus('idle');
    statusRef.current = 'idle';
    setCurrentMatchId(null);
    setMatchesPlayed(0);
    setError(null);
    void onRefresh();
  }, [onRefresh, publishClone]);

  return {
    status,
    delayMs,
    setDelayMs,
    currentMatchId,
    matchesPlayed,
    error,
    simTournament,
    start,
    pause,
    resume,
    stop,
    exit,
    isActive: status === 'running' || status === 'paused',
    overlayOpen: simTournament !== null,
  };
}
