// Profil public d'un autre joueur (/player/[id]) : un bouton d'amitié selon la
// relation, aucun bouton privé, redirection vers son propre profil, invité
// invité à créer son compte (sans requête).

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { Text } from 'react-native';

import type { AuthState } from '@/auth/auth-context';
import { removeFriend, respondFriendRequest, sendFriendRequest } from '@/friends/friends-service';
import { fetchPublicProfile, type PlayerRelation, type PublicProfile } from '@/players/public-profile';

let mockAuth: Partial<AuthState> = {};
const mockClient = {};

jest.mock('@/lib/supabase', () => ({ getSupabase: () => mockClient, isSupabaseConfigured: true }));
jest.mock('@/auth/auth-context', () => ({ useAuth: () => mockAuth }));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));
jest.mock('@/players/public-profile', () => ({
  ...jest.requireActual<object>('@/players/public-profile'),
  fetchPublicProfile: jest.fn(),
}));
jest.mock('@/friends/friends-service', () => ({
  ...jest.requireActual<object>('@/friends/friends-service'),
  sendFriendRequest: jest.fn(),
  respondFriendRequest: jest.fn(),
  removeFriend: jest.fn(),
}));

// Voir local-game-screen.test.tsx : Reanimated complété après l'import du routeur de test.
// eslint-disable-next-line @typescript-eslint/no-require-imports
Object.assign(require('react-native-reanimated'), require('@/hooks/__test-utils__/reanimated'), { __esModule: true });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PlayerScreen = require('@/app/player/[id]').default;
const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as jest.MockedFunction<T>;

const Stub = (label: string) =>
  function StubScreen() {
    return <Text>{label}</Text>;
  };

function open(id = 'u-elio') {
  return renderRouter(
    {
      index: Stub('Écran accueil'),
      profile: Stub('Écran profil'),
      upgrade: Stub('Écran upgrade'),
      'sign-in': Stub('Écran connexion'),
      'player/[id]': PlayerScreen,
    },
    { initialUrl: `/player/${id}` },
  );
}

const session = (id = 'me', isAnonymous = false) =>
  ({ user: { id, is_anonymous: isAnonymous } }) as unknown as AuthState['session'];

const profile = (relation: PlayerRelation): PublicProfile => ({
  pseudo: 'Elio',
  avatar: 'u-elio',
  points: 50,
  rank: 4,
  wins: 3,
  bestStreak: 7,
  relation,
});

/** Boutons et textes qui n'appartiennent qu'à son propre profil. */
const PRIVATE = [
  'Se déconnecter',
  'Déconnexion',
  'Supprimer mon compte',
  'Changer mon pseudo',
  'Modifier mon avatar',
  'Créer mon avatar',
  'Créer mon compte',
];

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { configured: true, loading: false, session: session(), isGuest: false, profile: null };
});

describe('accès', () => {
  it('son propre identifiant redirige vers son profil', async () => {
    mockAuth = { ...mockAuth, session: session('u-elio') };
    const router = open('u-elio');
    await waitFor(() => expect(router.getPathname()).toBe('/profile'));
    expect(fetchPublicProfile).not.toHaveBeenCalled();
  });

  it('un invité est invité à créer son compte, sans requête', async () => {
    mockAuth = { ...mockAuth, session: session('guest', true), isGuest: true };
    const router = open();
    expect(screen.getByText('Crée ton compte')).toBeTruthy();
    expect(fetchPublicProfile).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));
    await waitFor(() => expect(router.getPathname()).toBe('/upgrade'));
  });

  it('non connecté : se connecter, sans requête', () => {
    mockAuth = { ...mockAuth, session: null };
    open();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy();
    expect(fetchPublicProfile).not.toHaveBeenCalled();
  });

  it('joueur inconnu (ou invité) : « Joueur introuvable »', async () => {
    mocked(fetchPublicProfile).mockRejectedValue({ message: 'player_not_found' });
    open('u-inconnu');
    await waitFor(() => expect(screen.getByText('Joueur introuvable')).toBeTruthy());
    expect(fetchPublicProfile).toHaveBeenCalledWith(mockClient, 'u-inconnu');
  });

  it('erreur réseau : « Réessayer »', async () => {
    mocked(fetchPublicProfile).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mocked(fetchPublicProfile).mockResolvedValue(profile({ kind: 'none' }));
    open();
    await waitFor(() => expect(screen.getByText('Profil indisponible')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByText('Elio')).toBeTruthy());
  });
});

describe('profil public', () => {
  it('avatar, pseudo, points, rang, victoires et plus longue série ; aucun bouton privé ; un seul « ‹ Retour »', async () => {
    mocked(fetchPublicProfile).mockResolvedValue(profile({ kind: 'none' }));
    open();
    await waitFor(() => expect(screen.getByText('Elio')).toBeTruthy());
    expect(screen.getByLabelText('Points : 50')).toBeTruthy();
    expect(screen.getByLabelText('Rang aux points : 4e place')).toBeTruthy();
    expect(screen.getByLabelText('Victoires : 3')).toBeTruthy();
    expect(screen.getByLabelText('Meilleure série (jours) : 7')).toBeTruthy();
    // Statistiques privées absentes.
    expect(screen.queryByText('Parties lancées')).toBeNull();
    expect(screen.queryByText('Série actuelle (jours)')).toBeNull();
    for (const label of PRIVATE) expect(screen.queryByRole('button', { name: label })).toBeNull();
    expect(screen.getAllByRole('button', { name: '‹ Retour' })).toHaveLength(1);
  });

  it('pas encore classé : un tiret et une phrase', async () => {
    mocked(fetchPublicProfile).mockResolvedValue({ ...profile({ kind: 'none' }), rank: null, points: 0 });
    open();
    await waitFor(() => expect(screen.getByLabelText('Rang aux points : pas encore classé')).toBeTruthy());
    expect(screen.getByText('Pas encore classé : aucune partie classée jouée.')).toBeTruthy();
  });

  it.each([
    [{ kind: 'none' } as PlayerRelation, ['Envoyer une demande d’ami']],
    [{ kind: 'request_sent' } as PlayerRelation, ['Demande envoyée']],
    [{ kind: 'request_received', requestId: 'r1' } as PlayerRelation, ['Accepter', 'Refuser']],
    [{ kind: 'friends', friendshipId: 'f1' } as PlayerRelation, ['Retirer des amis']],
  ])('relation %j : un seul jeu de boutons d’amitié', async (relation, buttons) => {
    mocked(fetchPublicProfile).mockResolvedValue(profile(relation));
    open();
    await waitFor(() => expect(screen.getByText('Elio')).toBeTruthy());
    const all = ['Envoyer une demande d’ami', 'Demande envoyée', 'Accepter', 'Refuser', 'Retirer des amis'];
    for (const label of all) {
      expect(screen.queryAllByRole('button', { name: label })).toHaveLength(buttons.includes(label) ? 1 : 0);
    }
    for (const label of PRIVATE) expect(screen.queryByRole('button', { name: label })).toBeNull();
  });
});

describe('amitié', () => {
  it('pas amis : envoyer une demande, puis « Demande envoyée » (désactivé)', async () => {
    mocked(fetchPublicProfile).mockResolvedValueOnce(profile({ kind: 'none' }));
    mocked(fetchPublicProfile).mockResolvedValue(profile({ kind: 'request_sent' }));
    mocked(sendFriendRequest).mockResolvedValue('sent');
    open();
    fireEvent.press(await screen.findByRole('button', { name: 'Envoyer une demande d’ami' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Demande envoyée', disabled: true })).toBeTruthy());
    expect(sendFriendRequest).toHaveBeenCalledWith(mockClient, 'Elio');
    expect(screen.getByText('Demande envoyée à Elio.')).toBeTruthy();
  });

  it('relecture ratée après l’envoi : l’état passe quand même à « Demande envoyée »', async () => {
    mocked(fetchPublicProfile).mockResolvedValueOnce(profile({ kind: 'none' }));
    mocked(fetchPublicProfile).mockRejectedValue(new TypeError('Failed to fetch'));
    mocked(sendFriendRequest).mockResolvedValue('sent');
    open();
    fireEvent.press(await screen.findByRole('button', { name: 'Envoyer une demande d’ami' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Demande envoyée', disabled: true })).toBeTruthy());
  });

  it.each([
    ['recently_refused', 'Ce joueur a refusé ta demande. Réessaie dans 24 heures.'],
    ['too_many_sent', 'Tu as déjà 20 demandes en attente. Attends des réponses avant d’en envoyer d’autres.'],
    ['already_requested', 'Demande déjà envoyée : elle attend sa réponse.'],
  ])('erreur à l’envoi (%s) : message existant', async (code, message) => {
    mocked(fetchPublicProfile).mockResolvedValue(profile({ kind: 'none' }));
    mocked(sendFriendRequest).mockRejectedValue({ message: code, code: 'P0001' });
    open();
    fireEvent.press(await screen.findByRole('button', { name: 'Envoyer une demande d’ami' }));
    await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Envoyer une demande d’ami' })).toBeTruthy();
  });

  it('demande reçue : Accepter, puis amis', async () => {
    mocked(fetchPublicProfile).mockResolvedValueOnce(profile({ kind: 'request_received', requestId: 'r1' }));
    mocked(fetchPublicProfile).mockResolvedValue(profile({ kind: 'friends', friendshipId: 'f9' }));
    mocked(respondFriendRequest).mockResolvedValue(undefined);
    open();
    expect(await screen.findByText('Elio t’a envoyé une demande d’ami.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Accepter' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retirer des amis' })).toBeTruthy());
    expect(respondFriendRequest).toHaveBeenCalledWith(mockClient, 'r1', true);
  });

  it('demande reçue : Refuser, puis pas amis', async () => {
    mocked(fetchPublicProfile).mockResolvedValueOnce(profile({ kind: 'request_received', requestId: 'r1' }));
    mocked(fetchPublicProfile).mockResolvedValue(profile({ kind: 'none' }));
    mocked(respondFriendRequest).mockResolvedValue(undefined);
    open();
    fireEvent.press(await screen.findByRole('button', { name: 'Refuser' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Envoyer une demande d’ami' })).toBeTruthy());
    expect(respondFriendRequest).toHaveBeenCalledWith(mockClient, 'r1', false);
    expect(screen.getByText('Demande refusée.')).toBeTruthy();
  });

  it('amis : « Retirer des amis » demande confirmation, puis retour à « pas amis »', async () => {
    mocked(fetchPublicProfile).mockResolvedValueOnce(profile({ kind: 'friends', friendshipId: 'f1' }));
    mocked(fetchPublicProfile).mockResolvedValue(profile({ kind: 'none' }));
    mocked(removeFriend).mockResolvedValue(undefined);
    open();
    fireEvent.press(await screen.findByRole('button', { name: 'Retirer des amis' }));
    const dialog = screen.getByLabelText('Retirer Elio de tes amis ?', { hidden: true });
    fireEvent.press(within(dialog).getByRole('button', { name: 'Garder' }));
    expect(removeFriend).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Retirer des amis' }));
    fireEvent.press(
      within(screen.getByLabelText('Retirer Elio de tes amis ?', { hidden: true })).getByRole('button', { name: 'Retirer' }),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Envoyer une demande d’ami' })).toBeTruthy());
    expect(removeFriend).toHaveBeenCalledWith(mockClient, 'f1');
    expect(screen.getByText('Elio ne fait plus partie de tes amis.')).toBeTruthy();
  });
});
