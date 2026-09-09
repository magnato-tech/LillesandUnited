import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Header } from './components/Header';
import { EventHero } from './components/EventHero';
import { ActivityGrid } from './components/ActivityGrid';
import { TableTennisView } from './components/TableTennisView';
import { AlphaView } from './components/AlphaView';
import { KioskSection } from './components/KioskSection';
import { DisplayScreen } from './components/DisplayScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { MyProfileView } from './components/MyProfileView';
import { WelcomeBanner } from './components/WelcomeBanner';
import { AppState, Person } from './types';
import { INITIAL_STATE } from './lib/initial-data';
import { fetchState, registerParticipant, createPerson } from './services/api';
import {
  getActiveSession,
  saveActiveSession,
  clearActiveSession,
  StoredSession,
} from './lib/userProfile';

type AppTab = 'home' | 'profile' | 'tabletennis' | 'alpha' | 'kiosk' | 'display' | 'admin';
type AdminTab =
  | 'kiosk_popcorn'
  | 'matches'
  | 'event_participants'
  | 'tabletennis_participants'
  | 'activities'
  | 'alpha'
  | 'test';

const APP_TAB_KEY = 'lillesand_current_tab';
const ADMIN_TAB_KEY = 'lillesand_admin_section';

const VALID_APP_TABS: AppTab[] = ['home', 'profile', 'tabletennis', 'alpha', 'kiosk', 'display', 'admin'];
const VALID_ADMIN_TABS: AdminTab[] = [
  'kiosk_popcorn',
  'matches',
  'event_participants',
  'tabletennis_participants',
  'activities',
  'alpha',
  'test',
];

function readStoredAppTab(): AppTab {
  if (typeof window === 'undefined') return 'home';
  const saved = sessionStorage.getItem(APP_TAB_KEY);
  return VALID_APP_TABS.includes(saved as AppTab) ? (saved as AppTab) : 'home';
}

function readStoredAdminTab(fallback: AdminTab): AdminTab {
  if (typeof window === 'undefined') return fallback;
  const saved = sessionStorage.getItem(ADMIN_TAB_KEY);
  if (saved === 'participants') return 'tabletennis_participants';
  return VALID_ADMIN_TABS.includes(saved as AdminTab) ? (saved as AdminTab) : fallback;
}

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [currentTab, setCurrentTabState] = useState<AppTab>(readStoredAppTab);
  const [adminInitialTab, setAdminInitialTabState] = useState<AdminTab>(() =>
    readStoredAdminTab('kiosk_popcorn')
  );
  const [activeSession, setActiveSessionState] = useState<StoredSession>(getActiveSession);
  const [isStateLoaded, setIsStateLoaded] = useState(false);

  // Single source of truth: find active person matching stored session
  const effectiveActivePerson = useMemo<Person | null>(() => {
    const persons = state.persons || [];
    if (activeSession.personId) {
      const match = persons.find((p) => p.id === activeSession.personId);
      if (match) return match;
    }
    if (activeSession.displayId) {
      const match = persons.find(
        (p) => p.displayId?.toLowerCase() === activeSession.displayId?.toLowerCase()
      );
      if (match) return match;
    }
    if (activeSession.firstName) {
      const match = persons.find(
        (p) => p.firstName?.toLowerCase() === activeSession.firstName?.toLowerCase()
      );
      if (match) return match;
    }
    return null;
  }, [activeSession, state.persons]);

  // hasActiveUser determines whether an active session exists
  // Single source of truth:
  // - If effectiveActivePerson is found in state.persons -> true
  // - While initial state is loading (isStateLoaded is false), if localStorage holds a session -> true (prevents flash of onboarding on refresh)
  // - Otherwise -> false
  const hasActiveUser = Boolean(
    effectiveActivePerson ||
    (!isStateLoaded && (activeSession.personId || activeSession.displayId || activeSession.firstName))
  );

  const activePersonId = effectiveActivePerson?.id || activeSession.personId;
  const currentUserName = effectiveActivePerson?.firstName || (hasActiveUser ? activeSession.firstName : null);

  const previousWinnerRef = useRef<string | null>(null);

  // Load state and poll periodically to keep all devices in sync
  const loadLatestState = async () => {
    try {
      const data = await fetchState();
      setState(data);
      setIsStateLoaded(true);

      // Verify and sync active session against the latest persons in database
      const session = getActiveSession();
      if (session.personId || session.displayId || session.firstName) {
        const persons = data.persons || [];
        const match =
          (session.personId && persons.find((p) => p.id === session.personId)) ||
          (session.displayId &&
            persons.find(
              (p) => p.displayId?.toLowerCase() === session.displayId?.toLowerCase()
            )) ||
          (session.firstName &&
            persons.find(
              (p) => p.firstName?.toLowerCase() === session.firstName?.toLowerCase()
            )) ||
          null;

        if (match) {
          saveActiveSession(match);
          setActiveSessionState({
            personId: match.id,
            token: match.anonymousToken,
            firstName: match.firstName,
            displayId: match.displayId,
          });
        } else {
          // If the person no longer exists in database (e.g. database was reset)
          clearActiveSession();
          setActiveSessionState({
            personId: null,
            token: null,
            firstName: null,
            displayId: null,
          });
        }
      }

      // Trigger confetti if winner was crowned
      if (data.tournament?.winner && data.tournament.winner.id !== previousWinnerRef.current) {
        previousWinnerRef.current = data.tournament.winner.id;
        try {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch (e) {}
      }
    } catch (err) {
      console.error('Error fetching state:', err);
    }
  };

  useEffect(() => {
    loadLatestState();
    const interval = setInterval(loadLatestState, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectPerson = (person: Person | null) => {
    if (person) {
      saveActiveSession(person);
      setActiveSessionState({
        personId: person.id,
        token: person.anonymousToken,
        firstName: person.firstName,
        displayId: person.displayId,
      });
    } else {
      clearActiveSession();
      setActiveSessionState({
        personId: null,
        token: null,
        firstName: null,
        displayId: null,
      });
    }
  };

  const handleCreatePerson = async (firstName: string): Promise<Person | null> => {
    try {
      const res = await createPerson(firstName);
      setState(res.state);
      handleSelectPerson(res.person);
      return res.person;
    } catch (err) {
      console.error('Failed to create person:', err);
      return null;
    }
  };

  const handleSetMyPlayer = async (name: string | null) => {
    if (!name || !name.trim()) {
      handleSelectPerson(null);
      return;
    }
    const clean = name.trim();
    const matches = (state.persons || []).filter(
      (p) => p.firstName.toLowerCase() === clean.toLowerCase()
    );
    if (matches.length === 1) {
      handleSelectPerson(matches[0]);
      return;
    }
    await handleCreatePerson(clean);
  };

  const handleRegisterPlayer = async (name: string, personId: string) => {
    const person =
      effectiveActivePerson?.id === personId
        ? effectiveActivePerson
        : (state.persons || []).find((p) => p.id === personId);
    if (!person) {
      throw new Error('Profil ikke funnet. Opprett eller velg profil på Min side.');
    }
    const updatedState = await registerParticipant(
      person.firstName,
      undefined,
      person.id,
      person.anonymousToken
    );
    setState(updatedState);
  };

  const handleNavigate = (tab: AppTab) => {
    if (tab === 'admin' && currentTab !== 'tabletennis') {
      setAdminInitialTabState('kiosk_popcorn');
      sessionStorage.setItem(ADMIN_TAB_KEY, 'kiosk_popcorn');
    }
    sessionStorage.setItem(APP_TAB_KEY, tab);
    setCurrentTabState(tab);
  };

  const setCurrentTab = (tab: AppTab) => {
    sessionStorage.setItem(APP_TAB_KEY, tab);
    setCurrentTabState(tab);
  };

  const setAdminInitialTab = (tab: AdminTab) => {
    sessionStorage.setItem(ADMIN_TAB_KEY, tab);
    setAdminInitialTabState(tab);
  };

  const handleSelectActivity = (id: string) => {
    if (id === 'act-tabletennis') setCurrentTab('tabletennis');
    else if (id === 'act-alpha') setCurrentTab('alpha');
    else if (id === 'act-kiosk') setCurrentTab('kiosk');
    else {
      // Jump to home and highlight
      setCurrentTab('home');
    }
  };

  // Storskjermmodus / Projector view
  if (currentTab === 'display') {
    return <DisplayScreen state={state} onExit={() => setCurrentTab('home')} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-lime-400 selection:text-zinc-950 artistic-pattern">
      <div>
        {/* Navigation Header */}
        <Header
          currentTab={currentTab}
          setCurrentTab={handleNavigate}
          tournamentActive={state.tournament.status === 'active'}
          myPlayerName={currentUserName}
          activePerson={effectiveActivePerson}
        />

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
          {currentTab === 'home' && (
            <>
              {!hasActiveUser && (
                <WelcomeBanner onSetMyPlayer={handleSetMyPlayer} />
              )}
              <EventHero
                state={state}
                onGoToTableTennis={() => setCurrentTab('tabletennis')}
                onGoToAlpha={() => setCurrentTab('alpha')}
                myPlayerName={currentUserName}
                onBongClaimed={loadLatestState}
                activePersonId={activePersonId}
                activePerson={effectiveActivePerson}
                onCreatePerson={handleCreatePerson}
                onGoToProfile={() => setCurrentTab('profile')}
              />
              <ActivityGrid
                activities={state.activities}
                onSelectActivity={handleSelectActivity}
              />
            </>
          )}

          {currentTab === 'profile' && (
            <MyProfileView
              state={state}
              myPlayerName={currentUserName}
              onSetMyPlayer={handleSetMyPlayer}
              onGoToTab={setCurrentTab}
              onRefreshState={loadLatestState}
              activePersonId={activePersonId}
              activePerson={effectiveActivePerson}
            />
          )}

          {currentTab === 'tabletennis' && (
            <TableTennisView
              state={state}
              myPlayerName={currentUserName}
              onSetMyPlayer={handleSetMyPlayer}
              onRegister={handleRegisterPlayer}
              onGoToAdmin={() => {
                setAdminInitialTab('matches');
                setCurrentTab('admin');
              }}
              activePersonId={activePersonId}
              activePerson={effectiveActivePerson}
            />
          )}

          {currentTab === 'alpha' && (
            <AlphaView
              myPlayerName={currentUserName}
              onSuccessRegistered={() => {
                loadLatestState();
              }}
            />
          )}

          {currentTab === 'kiosk' && (
            <KioskSection
              state={state}
              myPlayerName={currentUserName}
              onBongClaimed={loadLatestState}
              activePersonId={activePersonId}
              activePerson={effectiveActivePerson}
              onCreatePerson={handleCreatePerson}
              onGoToProfile={() => setCurrentTab('profile')}
            />
          )}

          {currentTab === 'admin' && (
            <AdminDashboard
              state={state}
              onRefresh={loadLatestState}
              onOpenDisplay={() => setCurrentTab('display')}
              onGoToProfile={() => setCurrentTab('profile')}
              onOpenPersonProfile={(person: Person) => {
                handleSelectPerson(person);
                handleNavigate('profile');
              }}
              initialTab={adminInitialTab}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t-2 border-zinc-800 bg-zinc-950 py-8 text-xs text-zinc-400 mt-12">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-lime-400 text-zinc-950 font-black flex items-center justify-center text-sm shadow-artistic-sm -rotate-2">
              LU
            </div>
            <div>
              <strong className="text-zinc-100 block font-black uppercase tracking-wider text-sm">
                Lillesand United 2026
              </strong>
              <span className="text-zinc-400">Møglestuhallen, Lillesand • 17:00 – 22:45</span>
            </div>
          </div>

          <div className="text-center sm:text-right text-zinc-400">
            <span className="font-semibold text-zinc-300">Et felles ungdomsarrangement av KRIK & byens menigheter</span>
            <div className="text-zinc-500 mt-0.5 font-medium">
              Gratis inngang for alle interesserte (13–19 år)
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
