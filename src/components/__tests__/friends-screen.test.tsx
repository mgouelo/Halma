// Écran « Amis » : invité (aucune requête), liste triée par points, boîte aux
// lettres, ajout par pseudo, retrait avec confirmation, Realtime.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import {
  fetchFriendRequests,
  fetchFriends,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  type Friend,
  type FriendRequest,
} from '@/friends/friends-service';

const mockAuth = {
  configured: true,
  loading: false,
  session: { user: { id: 'me' } } as unknown,
  isGuest: false,
  profile: null,
};
const mockChannel = {
  handlers: [] as { table: string; filter: string; callback: () => void }[],
  on(_type: string, options: { table: string; filter: string }, callback: () => void) {
    this.handlers.push({ table: options.table, filter: options.filter, callback });
    return this;
  },
  subscribe() {
    return this;
  },
};
const mockClient = { channel: jest.fn(() => mockChannel), removeChannel: jest.fn() };

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('@/hooks/__test-utils__/reanimated'));
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
    usePathname: () => '/friends',
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});
jest.mock('@/lib/supabase', () => ({ getSupabase: () => mockClient }));
jest.mock('@/auth/auth-context', () => ({ useAuth: () => mockAuth }));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));
jest.mock('@/friends/friends-service', () => ({
  ...jest.requireActual<object>('@/friends/friends-service'),
  fetchFriends: jest.fn(),
  fetchFriendRequests: jest.fn(),
  sendFriendRequest: jest.fn(),
  respondFriendRequest: jest.fn(),
  removeFriend: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FriendsScreen = require('@/app/(main)/friends').default;
const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as jest.MockedFunction<T>;

const FRIENDS: Friend[] = [
  { friendshipId: 'f1', pseudo: 'Zoé', avatar: 'z', points: 120, rank: 3 },
  { friendshipId: 'f2', pseudo: 'Basile', avatar: 'b', points: -15, rank: 40 },
  { friendshipId: 'f3', pseudo: 'Chloé', avatar: 'c', points: 0, rank: null },
];
const REQUESTS: FriendRequest[] = [
  { id: 'r1', pseudo: 'Noé', avatar: 'n', createdAt: new Date().toISOString() },
  { id: 'r2', pseudo: 'Iris', avatar: 'i', createdAt: '2026-01-01T00:00:00Z' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockChannel.handlers = [];
  mockAuth.session = { user: { id: 'me' } };
  mockAuth.isGuest = false;
  mocked(fetchFriends).mockResolvedValue(FRIENDS);
  mocked(fetchFriendRequests).mockResolvedValue(REQUESTS);
});

describe('invité et non connecté', () => {
  it('invité : invitation à créer son compte, aucune requête d’amis', () => {
    mockAuth.isGuest = true;
    render(<FriendsScreen />);
    expect(screen.getByText('Tes amis t’attendent')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(router.push).toHaveBeenCalledWith('/upgrade');
    expect(fetchFriends).not.toHaveBeenCalled();
    expect(fetchFriendRequests).not.toHaveBeenCalled();
    expect(mockClient.channel).not.toHaveBeenCalled();
  });

  it('non connecté : connexion, aucune requête', () => {
    mockAuth.session = null;
    render(<FriendsScreen />);
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy();
    expect(fetchFriends).not.toHaveBeenCalled();
  });
});

describe('liste d’amis', () => {
  it('triée par points, avec le rang (ou un tiret)', async () => {
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByText('Zoé')).toBeTruthy());
    const labels = screen.getAllByLabelText(/points?, /).map((node) => node.props.accessibilityLabel);
    expect(labels).toEqual([
      'Zoé, 120 points, 3e au classement',
      'Chloé, 0 point, pas encore de rang',
      'Basile, -15 points, 40e au classement',
    ]);
    expect(screen.getByText('Rang —')).toBeTruthy();
    expect(screen.getByText('-15')).toBeTruthy();
    expect(screen.getByText('Mes amis (3)')).toBeTruthy();
  });

  it('chargement puis erreur, avec « Réessayer »', async () => {
    mocked(fetchFriends).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<FriendsScreen />);
    expect(screen.getByLabelText('Chargement de tes amis…')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Amis indisponibles')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByText('Zoé')).toBeTruthy());
  });

  it('liste vide', async () => {
    mocked(fetchFriends).mockResolvedValue([]);
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByText('Pas encore d’amis')).toBeTruthy());
  });

  it('retirer un ami demande confirmation (ConfirmDialog)', async () => {
    mocked(removeFriend).mockResolvedValue(undefined);
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByText('Zoé')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Retirer Basile de tes amis' }));
    const dialog = screen.getByLabelText('Retirer Basile de tes amis ?', { hidden: true });
    fireEvent.press(within(dialog).getByRole('button', { name: 'Garder' }));
    expect(removeFriend).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Retirer Basile de tes amis' }));
    fireEvent.press(within(screen.getByLabelText('Retirer Basile de tes amis ?', { hidden: true })).getByRole('button', { name: 'Retirer' }));
    await waitFor(() => expect(removeFriend).toHaveBeenCalledWith(mockClient, 'f2'));
  });
});

describe('ajouter un ami', () => {
  it('envoie la demande et le confirme', async () => {
    mocked(sendFriendRequest).mockResolvedValue('sent');
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByText('Zoé')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Ajouter un ami'), 'elodie');
    fireEvent.press(screen.getByRole('button', { name: 'Envoyer la demande' }));
    await waitFor(() => expect(screen.getByText('Demande envoyée à elodie.')).toBeTruthy());
    expect(sendFriendRequest).toHaveBeenCalledWith(mockClient, 'elodie');
  });

  it.each([
    ['pseudo_unknown', 'Aucun joueur ne porte ce pseudo.'],
    ['self_request', 'C’est toi ! Choisis le pseudo d’un autre joueur.'],
    ['already_friends', 'Vous êtes déjà amis.'],
    ['already_requested', 'Demande déjà envoyée : elle attend sa réponse.'],
  ])('message clair : %s', async (code, message) => {
    mocked(sendFriendRequest).mockRejectedValue({ message: code, code: 'P0001' });
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByText('Zoé')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Ajouter un ami'), 'quelqu’un');
    fireEvent.press(screen.getByRole('button', { name: 'Envoyer la demande' }));
    await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
  });

  it('demande croisée : vous voilà amis', async () => {
    mocked(sendFriendRequest).mockResolvedValue('accepted');
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByText('Zoé')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Ajouter un ami'), 'Noé');
    fireEvent.press(screen.getByRole('button', { name: 'Envoyer la demande' }));
    await waitFor(() => expect(screen.getByText('Noé t’avait déjà demandé en ami : vous êtes maintenant amis !')).toBeTruthy());
  });

  it('champ vide : rien n’est envoyé', async () => {
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByText('Zoé')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(screen.getByText('Écris le pseudo de ton ami.')).toBeTruthy();
    expect(sendFriendRequest).not.toHaveBeenCalled();
  });
});

describe('boîte aux lettres', () => {
  it('pastille, demandes de la plus récente à la plus ancienne, accepter et refuser, retour', async () => {
    mocked(respondFriendRequest).mockResolvedValue(undefined);
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByText('Zoé')).toBeTruthy());
    expect(screen.getByText('2', { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Demandes d’ami : 2 en attente' }));
    expect(screen.getByText('Demandes reçues')).toBeTruthy();
    const pseudos = screen.getAllByText(/^(Noé|Iris)$/).map((node) => node.props.children);
    expect(pseudos).toEqual(['Noé', 'Iris']);
    fireEvent.press(screen.getAllByRole('button', { name: 'Accepter' })[0]);
    await waitFor(() => expect(respondFriendRequest).toHaveBeenCalledWith(mockClient, 'r1', true));
    fireEvent.press(screen.getAllByRole('button', { name: 'Refuser' })[1]);
    await waitFor(() => expect(respondFriendRequest).toHaveBeenCalledWith(mockClient, 'r2', false));
    fireEvent.press(screen.getByRole('button', { name: '‹ Mes amis' }));
    expect(screen.getByText('Mes amis (3)')).toBeTruthy();
  });

  it('aucune demande : pas de pastille, liste vide dans la DA', async () => {
    mocked(fetchFriendRequests).mockResolvedValue([]);
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByText('Zoé')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Demandes d’ami : aucune' }));
    expect(screen.getByText('Aucune demande')).toBeTruthy();
  });

  it('Realtime : une nouvelle demande apparaît sans recharger', async () => {
    mocked(fetchFriendRequests).mockResolvedValue([]);
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Demandes d’ami : aucune' })).toBeTruthy());
    expect(mockChannel.handlers.map((h) => `${h.table}:${h.filter}`)).toEqual([
      'friend_requests:recipient_id=eq.me',
      'friendships:user_a=eq.me',
      'friendships:user_b=eq.me',
    ]);
    mocked(fetchFriendRequests).mockResolvedValue([REQUESTS[0]]);
    await act(async () => {
      mockChannel.handlers[0].callback();
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Demandes d’ami : 1 en attente' })).toBeTruthy());
  });
});
