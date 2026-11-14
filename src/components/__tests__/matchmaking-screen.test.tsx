// Écran « Trouver une partie » : entrée en file, recherche (attente longue),
// appariement et compte à rebours sur l'heure du serveur, départ, annulation.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { OnlineError } from '@/online';
import { joinMatchmaking, leaveMatchmaking, matchmakingHeartbeat, type MatchmakingStatus } from '@/rooms/matchmaking';
import { fetchRoom, startGame } from '@/rooms/room-service';

const mockAuth = { configured: true, loading: false, session: { user: { id: 'me' } } as unknown };
const mockChannel = {
  on() {
    return this;
  },
  subscribe() {
    return this;
  },
};
const mockClient = { channel: jest.fn(() => mockChannel), removeChannel: jest.fn() };

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('@/hooks/__test-utils__/reanimated'));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissTo: jest.fn() },
  usePathname: () => '/matchmaking',
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => mockClient }));
jest.mock('@/auth/auth-context', () => ({ useAuth: () => mockAuth }));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));
jest.mock('@/rooms/matchmaking', () => ({
  ...jest.requireActual<object>('@/rooms/matchmaking'),
  joinMatchmaking: jest.fn(),
  leaveMatchmaking: jest.fn(),
  matchmakingHeartbeat: jest.fn(),
}));
jest.mock('@/rooms/room-service', () => ({
  ...jest.requireActual<object>('@/rooms/room-service'),
  fetchRoom: jest.fn(),
  startGame: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MatchmakingScreen = require('@/app/matchmaking').default;
const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as jest.MockedFunction<T>;

const START = Date.parse('2026-11-14T12:00:00.000Z');

function searching(joinedMsAgo = 0, clockOffsetMs = 0): MatchmakingStatus {
  return {
    phase: 'searching',
    joinedAt: new Date(Date.now() + clockOffsetMs - joinedMsAgo).toISOString(),
    roomId: null,
    startsAt: null,
    players: 0,
    clockOffsetMs,
  };
}

function matched(secondsLeft: number, players = 2, clockOffsetMs = 0): MatchmakingStatus {
  return {
    phase: 'matched',
    joinedAt: null,
    roomId: 'room-1',
    startsAt: new Date(Date.now() + clockOffsetMs + secondsLeft * 1000).toISOString(),
    players,
    clockOffsetMs,
  };
}

const roomPlayers = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    seat: i,
    userId: i === 0 ? 'me' : `u${i}`,
    aiLevel: null,
    playerIndex: null,
    lastSeenAt: '',
    pseudo: i === 0 ? 'Zoé' : `Joueur${i}`,
    avatar: null,
  }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(START);
  jest.clearAllMocks();
  mocked(leaveMatchmaking).mockResolvedValue(undefined);
  mocked(fetchRoom).mockImplementation(async () => ({ room: {} as never, players: roomPlayers(2), game: null }));
});
afterEach(() => {
  jest.useRealTimers();
});

/** Laisse passer `ms` millisecondes (minuteries et promesses). */
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('recherche', () => {
  it('entre en file, affiche la recherche et sa durée, envoie des signes de vie', async () => {
    mocked(joinMatchmaking).mockResolvedValue(searching());
    mocked(matchmakingHeartbeat).mockImplementation(async () => searching(Date.now() - START));
    render(<MatchmakingScreen />);
    expect(screen.getByLabelText('Entrée dans la file…')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Recherche d’un adversaire…')).toBeTruthy());
    await advance(12_000);
    expect(screen.getByText('Recherche depuis 0:12')).toBeTruthy();
    expect(mocked(matchmakingHeartbeat).mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy();
  });

  it('après une minute : « Continuer d’attendre » ou « Annuler »', async () => {
    mocked(joinMatchmaking).mockResolvedValue(searching());
    mocked(matchmakingHeartbeat).mockImplementation(async () => searching(Date.now() - START));
    render(<MatchmakingScreen />);
    await waitFor(() => expect(screen.getByText('Recherche d’un adversaire…')).toBeTruthy());
    await advance(59_000);
    expect(screen.queryByText('Toujours personne…')).toBeNull();
    await advance(2000);
    const dialog = screen.getByLabelText('Toujours personne…', { hidden: true });
    fireEvent.press(within(dialog).getByRole('button', { name: 'Continuer d’attendre' }));
    await advance(1000);
    expect(screen.queryByRole('button', { name: 'Continuer d’attendre' })).toBeNull();
    expect(leaveMatchmaking).not.toHaveBeenCalled();
    // Une minute plus tard, la question revient.
    await advance(60_000);
    expect(screen.getByLabelText('Toujours personne…', { hidden: true })).toBeTruthy();
  });

  it('« Annuler » quitte la file et revient en arrière', async () => {
    mocked(joinMatchmaking).mockResolvedValue(searching());
    mocked(matchmakingHeartbeat).mockResolvedValue(searching());
    render(<MatchmakingScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(leaveMatchmaking).toHaveBeenCalledTimes(1);
  });

  it('quitter l’écran sans partie annule la recherche', async () => {
    mocked(joinMatchmaking).mockResolvedValue(searching());
    mocked(matchmakingHeartbeat).mockResolvedValue(searching());
    const view = render(<MatchmakingScreen />);
    await waitFor(() => expect(screen.getByText('Recherche d’un adversaire…')).toBeTruthy());
    view.unmount();
    expect(leaveMatchmaking).toHaveBeenCalledTimes(1);
  });

  it('déjà dans une room : refus clair et accès à sa room', async () => {
    mocked(joinMatchmaking).mockRejectedValue(new OnlineError('already_in_room'));
    render(<MatchmakingScreen />);
    await waitFor(() => expect(screen.getByText('Recherche impossible')).toBeTruthy());
    expect(screen.getByText(/Tu es déjà dans une room/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Voir ma room' }));
    expect(router.replace).toHaveBeenCalledWith('/online');
  });
});

describe('appariement et départ', () => {
  it('compte à rebours sur l’heure du serveur (téléphone en retard de 3 s), puis départ et ouverture de la room', async () => {
    // Le serveur a 3 s d'avance sur le téléphone : il reste 15 s à l'heure du serveur.
    mocked(joinMatchmaking).mockResolvedValue(matched(15, 2, 3000));
    mocked(matchmakingHeartbeat).mockImplementation(async () => ({ ...matched(15, 3, 3000), startsAt: new Date(START + 3000 + 15_000).toISOString() }));
    mocked(startGame).mockResolvedValue({ id: 'g1' } as never);
    render(<MatchmakingScreen />);
    await waitFor(() => expect(screen.getByText('Adversaire trouvé !')).toBeTruthy());
    expect(screen.getByLabelText('15 secondes avant le départ')).toBeTruthy();
    expect(screen.getByText('Zoé (toi)')).toBeTruthy();
    await advance(5000);
    expect(screen.getByText('La partie commence dans 10 s.')).toBeTruthy();
    // Un 3e joueur arrive (signe de vie) : la liste se met à jour.
    mocked(fetchRoom).mockImplementation(async () => ({ room: {} as never, players: roomPlayers(3), game: null }));
    await advance(4000);
    await waitFor(() => expect(screen.getByText('Joueurs · 3/6')).toBeTruthy());
    expect(startGame).not.toHaveBeenCalled();
    await advance(6500);
    await waitFor(() => expect(startGame).toHaveBeenCalledWith(mockClient, 'room-1'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/room/[id]', params: { id: 'room-1' } }));
    expect(leaveMatchmaking).not.toHaveBeenCalled();
  });

  it('départ refusé « un peu trop tôt » : redemandé peu après', async () => {
    mocked(joinMatchmaking).mockResolvedValue(matched(1));
    mocked(matchmakingHeartbeat).mockImplementation(async () => matched(0));
    mocked(startGame).mockRejectedValueOnce(new OnlineError('start_too_early')).mockResolvedValue({ id: 'g1' } as never);
    render(<MatchmakingScreen />);
    await waitFor(() => expect(screen.getByText('Adversaire trouvé !')).toBeTruthy());
    await advance(1500);
    await waitFor(() => expect(startGame).toHaveBeenCalledTimes(1));
    await advance(1200);
    await waitFor(() => expect(startGame).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/room/[id]', params: { id: 'room-1' } }));
  });

  it('partie lancée par un autre joueur : la room s’ouvre', async () => {
    mocked(joinMatchmaking).mockResolvedValue(matched(10));
    mocked(matchmakingHeartbeat).mockResolvedValue({ ...matched(0), phase: 'started' });
    render(<MatchmakingScreen />);
    await waitFor(() => expect(screen.getByText('Adversaire trouvé !')).toBeTruthy());
    await advance(4000);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/room/[id]', params: { id: 'room-1' } }));
    expect(startGame).not.toHaveBeenCalled();
  });

  it('l’autre joueur part pendant le compte à rebours : retour en recherche', async () => {
    mocked(joinMatchmaking).mockResolvedValue(matched(12));
    mocked(matchmakingHeartbeat).mockResolvedValue(searching());
    render(<MatchmakingScreen />);
    await waitFor(() => expect(screen.getByText('Adversaire trouvé !')).toBeTruthy());
    await advance(4000);
    await waitFor(() => expect(screen.getByText('Recherche d’un adversaire…')).toBeTruthy());
    expect(startGame).not.toHaveBeenCalled();
  });

  it('« Annuler » pendant le compte à rebours quitte la room', async () => {
    mocked(joinMatchmaking).mockResolvedValue(matched(12));
    mocked(matchmakingHeartbeat).mockResolvedValue(matched(12));
    render(<MatchmakingScreen />);
    await waitFor(() => expect(screen.getByText('Adversaire trouvé !')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(leaveMatchmaking).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });
});
