import React, { useState, useEffect, useRef } from 'react';
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
import { getActivePersonId, setActivePersonId, setActivePersonToken } from './lib/userProfile';

type AppTab = 'home' | 'profile' | 'tabletennis' | 'alpha' | 'kiosk' | 'display' | 'admin';
type AdminTab = 'kiosk_popcorn' | 'matches' | 'participants' | 'activities' | 'alpha' | 'test';

const APP_TAB_KEY = 'lillesand_current_tab';
const ADMIN_TAB_KEY = 'lillesand_admin_section';

const VALID_APP_TABS: AppTab[] = ['home', 'profile', 'tabletennis', 'alpha', 'kiosk', 'display', 'admin'];
const VALID_ADMIN_TABS: AdminTab[] = ['kiosk_popcorn', 'matches', 'participants', 'activities', 'alpha', 'test'];

function readStoredAppTab(): AppTab {
  if (typeof window === 'undefined') return 'home';
  const saved = sessionStorage.getItem(APP_TAB_KEY);
  return VALID_APP_TABS.includes(saved as AppTab) ? (saved as AppTab) : 'home';
}

function readStoredAdminTab(fallback: AdminTab): AdminTab {
  if (typeof window === 'undefined') return fallback;
  const saved = sessionStorage.getItem(ADMIN_TAB_KEY);
  return VALID_ADMIN_TABS.includes(saved as AdminTab) ? (saved as AdminTab) : fallback;
}

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [currentTab, setCurrentTabState] = useState<AppTab>(readStoredAppTab);
  const [adminInitialTab, setAdminInitialTabState] = useState<AdminTab>(() =>
    readStoredAdminTab('kiosk_popcorn')
  );
  const [activePersonId, setActivePersonIdState] = useState<string | null>(() => {
    return getActivePersonId();
  });
  const [myPlayerName, setMyPlayerName] = useState<string | null>(() => {
    return localStorage.getItem('lillesand_my_player_name');
  });

  const previousWinnerRef = useRef<string | null>(null);

  // Load state and poll periodically to keep all devices in sync
  const loadLatestState = async () => {
    try {
      const data = await fetchState();
      setState(data);

      // Sync active person name if activePersonId is set
      const currentId = getActivePersonId();
      if (currentId && data.persons && Array.isArray(data.persons)) {
        const matchingPerson = data.persons.find((p) => p.id === currentId);
        if (matchingPerson) {
          setMyPlayerName(matchingPerson.firstName);
          localStorage.setItem('lillesand_my_player_name', matchingPerson.firstName);
          localStorage.setItem('lillesand_my_player_display_id', matchingPerson.displayId);
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
      setActivePersonIdState(person.id);
      setActivePersonId(person.id);
      setActivePersonToken(person.anonymousToken);
      setMyPlayerName(person.firstName);
      localStorage.setItem('lillesand_my_player_name', person.firstName);
      localStorage.setItem('lillesand_my_player_display_id', person.displayId);
    } else {
      setActivePersonIdState(null);
      setActivePersonId(null);
      setActivePersonToken(null);
      setMyPlayerName(null);
      localStorage.removeItem('lillesand_my_player_name');
      localStorage.removeItem('lillesand_my_player_display_id');
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
    if (!name) {
      handleSelectPerson(null);
      return;
    }
    const clean = name.trim();
    const matches = (state.persons || []).filter(
      (p) => p.firstName.toLowerCase() === clean.toLowerCase()
    );
    // Kun én eksisterende profil med dette fornavnet → velg den. Ellers opprett ny (Oliver_2, Oliver_3 …).
    if (matches.length === 1) {
      handleSelectPerson(matches[0]);
      return;
    }
    await handleCreatePerson(clean);
  };

  const handleRegisterPlayer = async (name: string, personId: string) => {
    const person = (state.persons || []).find((p) => p.id === personId);
    if (!person) {
      throw new Error('Profil ikke funnet. Velg eller opprett profil i menyen øverst.');
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
          myPlayerName={myPlayerName}
          onSetMyPlayer={handleSetMyPlayer}
          participants={state.tournament.participants}
          persons={state.persons || []}
          activePersonId={activePersonId}
          onSelectPerson={handleSelectPerson}
          onCreatePerson={handleCreatePerson}
        />

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
          {currentTab === 'home' && (
            <>
              <WelcomeBanner
                myPlayerName={myPlayerName}
                onSetMyPlayer={handleSetMyPlayer}
                onGoToProfile={() => setCurrentTab('profile')}
              />
              <EventHero
                state={state}
                onGoToTableTennis={() => setCurrentTab('tabletennis')}
                onGoToAlpha={() => setCurrentTab('alpha')}
                myPlayerName={myPlayerName}
                onSetMyPlayer={handleSetMyPlayer}
                onBongClaimed={loadLatestState}
                activePersonId={activePersonId}
                persons={state.persons || []}
                onSelectPerson={handleSelectPerson}
                onCreatePerson={handleCreatePerson}
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
              myPlayerName={myPlayerName}
              onSetMyPlayer={handleSetMyPlayer}
              onGoToTab={setCurrentTab}
              onRefreshState={loadLatestState}
              activePersonId={activePersonId}
              persons={state.persons || []}
            />
          )}

          {currentTab === 'tabletennis' && (
            <TableTennisView
              state={state}
              myPlayerName={myPlayerName}
              onSetMyPlayer={handleSetMyPlayer}
              onRegister={handleRegisterPlayer}
              onGoToAdmin={() => {
                setAdminInitialTab('matches');
                setCurrentTab('admin');
              }}
              activePersonId={activePersonId}
              persons={state.persons || []}
            />
          )}

          {currentTab === 'alpha' && (
            <AlphaView
              myPlayerName={myPlayerName}
              onSuccessRegistered={() => {
                loadLatestState();
              }}
            />
          )}

          {currentTab === 'kiosk' && (
            <KioskSection
              state={state}
              myPlayerName={myPlayerName}
              onSetMyPlayer={handleSetMyPlayer}
              onBongClaimed={loadLatestState}
              activePersonId={activePersonId}
              persons={state.persons || []}
              onSelectPerson={handleSelectPerson}
              onCreatePerson={handleCreatePerson}
            />
          )}

          {currentTab === 'admin' && (
            <AdminDashboard
              state={state}
              onRefresh={loadLatestState}
              onOpenDisplay={() => setCurrentTab('display')}
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
