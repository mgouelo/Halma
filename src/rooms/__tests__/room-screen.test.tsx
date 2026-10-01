// Écran de room avec le vrai routeur : quand l'hôte ferme la room pendant qu'on
// est dans la salle d'attente, le joueur est renvoyé à l'accueil avec un message,
// sans erreur ni écran blanc.

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { getFlashNotice, setFlashNotice } from '@/lib/flash-notice';
import { HOST_CLOSED_NOTICE } from '../room-service';

type State = { status: string; snapshot: unknown; error: string | null };
const mockStore: { state: State; listeners: Set<() => void> } = {
  state: { status: 'loading', snapshot: null, error: null },
  listeners: new Set(),
};
function setRoomState(state: State) {
  mockStore.state = state;
  mockStore.listeners.forEach((listener) => listener());
}

jest.mock('@/rooms/use-room', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useSyncExternalStore } = require('react');
  return {
    useNow: () => 0,
    useRoom: () => ({
      ...useSyncExternalStore(
        (listener: () => void) => {
          mockStore.listeners.add(listener);
          return () => mockStore.listeners.delete(listener);
        },
        () => mockStore.state,
      ),
      refresh: () => {},
      applyGame: () => {},
    }),
  };
});

jest.mock('@/auth/auth-context', () => ({
  useAuth: () => ({ configured: true, loading: false, session: { user: { id: 'me' } } }),
}));

jest.mock('@/components/online/lobby', () => ({
  Lobby: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text: T } = require('react-native');
    return <T>Salle d’attente de test</T>;
  },
}));
jest.mock('@/components/online/online-game-view', () => ({ OnlineGameView: () => null }));
jest.mock('@/hooks/use-is-client', () => ({ useIsClient: () => true }));

// Reanimated : même complément que dans local-game-screen.test.tsx.
// eslint-disable-next-line @typescript-eslint/no-require-imports
Object.assign(require('react-native-reanimated'), require('../../hooks/__test-utils__/reanimated'), { __esModule: true });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RoomScreen = require('@/app/room/[id]').default;

const waitingSnapshot = {
  room: { id: 'r1', code: 'K7QM3X', hostId: 'host', status: 'waiting', createdAt: '' },
  players: [
    { id: 'p1', userId: 'host', seat: 0 },
    { id: 'p2', userId: 'me', seat: 1 },
  ],
  game: null,
};

function Home() {
  return <Text>Accueil de test</Text>;
}

function openRoom() {
  renderRouter({ index: Home, 'room/[id]': RoomScreen }, { initialUrl: '/' });
  act(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-router').router.push('/room/r1');
  });
}

afterEach(() => {
  setFlashNotice(null);
  setRoomState({ status: 'loading', snapshot: null, error: null });
});

describe('room supprimée par l’hôte', () => {
  it('renvoie le joueur à l’accueil avec « L’hôte a fermé la room »', () => {
    openRoom();
    act(() => setRoomState({ status: 'ready', snapshot: waitingSnapshot, error: null }));
    expect(screen.getByText('Salle d’attente de test')).toBeTruthy();

    act(() => setRoomState({ status: 'missing', snapshot: waitingSnapshot, error: null }));
    expect(screen.getByText('Accueil de test')).toBeTruthy();
    expect(getFlashNotice()).toBe(HOST_CLOSED_NOTICE);
  });

  it('affiche « Room introuvable » (sans redirection) quand on ouvre une room qui n’existe pas', () => {
    openRoom();
    act(() => setRoomState({ status: 'missing', snapshot: null, error: null }));
    expect(screen.getByText('Room introuvable')).toBeTruthy();
    expect(getFlashNotice()).toBeNull();
  });
});
