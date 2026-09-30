// Écran des classements : un invité ne voit pas la liste, aucune requête de
// classement n'est envoyée, et la barre de navigation reste affichée.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import type { AuthState } from '@/auth/auth-context';

const mockFetchLeaderboards = jest.fn(async () => [
  { board: 'wins', rank: 1, pseudo: 'Léa', avatar: 'Léa', score: 4, is_me: true },
]);
let mockAuth: Partial<AuthState> = {};

jest.mock('@/stats/stats-service', () => ({ fetchLeaderboards: () => mockFetchLeaderboards() }));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({}), isSupabaseConfigured: true }));
jest.mock('@/auth/auth-context', () => ({ useAuth: () => mockAuth }));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));

// Voir local-game-screen.test.tsx : Reanimated complété après l'import du routeur de test.
// eslint-disable-next-line @typescript-eslint/no-require-imports
Object.assign(require('react-native-reanimated'), require('@/hooks/__test-utils__/reanimated'), { __esModule: true });

/* eslint-disable @typescript-eslint/no-require-imports */
const MainLayout = require('@/app/(main)/_layout').default;
const LeaderboardScreen = require('@/app/(main)/leaderboard').default;
/* eslint-enable @typescript-eslint/no-require-imports */

const Stub = (label: string) =>
  function StubScreen() {
    return <Text>{label}</Text>;
  };

// Tous les écrans déclarés par le layout (main), remplacés par un texte, sauf les classements.
const MAIN_SCREENS = ['index', 'online', 'ai-setup', 'local-setup', 'profile', 'avatar', 'credits', 'privacy', 'terms', 'sign-in', 'sign-up', 'upgrade'];

function open() {
  return renderRouter(
    {
      '(main)/_layout': MainLayout,
      ...Object.fromEntries(MAIN_SCREENS.map((name) => [`(main)/${name}`, Stub(`Écran ${name}`)])),
      '(main)/leaderboard': LeaderboardScreen,
    },
    { initialUrl: '/leaderboard' },
  );
}

const session = (isAnonymous: boolean) =>
  ({ user: { id: 'u1', is_anonymous: isAnonymous } }) as unknown as AuthState['session'];

beforeEach(() => {
  mockFetchLeaderboards.mockClear();
});

describe('classements', () => {
  it('invité : message et bouton vers la création de compte, sans aucune requête', async () => {
    mockAuth = { configured: true, loading: false, session: session(true), isGuest: true, profile: null };
    const router = open();
    expect(screen.getByText('Rejoins les légendes')).toBeTruthy();
    expect(screen.getByText(/pour apparaître dans les classements et les consulter/)).toBeTruthy();
    expect(screen.getByText('Seules les légendes apparaissent ici.')).toBeTruthy();
    // La barre de navigation reste affichée.
    expect(screen.getByRole('tab', { name: 'Classements' })).toBeTruthy();
    expect(mockFetchLeaderboards).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));
    await waitFor(() => expect(router.getPathname()).toBe('/upgrade'));
    expect(screen.getByRole('tab', { name: 'Profil' })).toBeTruthy();
    expect(mockFetchLeaderboards).not.toHaveBeenCalled();
  });

  it('non connecté : même invitation, vers la connexion, sans requête', () => {
    mockAuth = { configured: true, loading: false, session: null, isGuest: false, profile: null };
    open();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy();
    expect(mockFetchLeaderboards).not.toHaveBeenCalled();
  });

  it('compte e-mail : les classements sont lus', async () => {
    mockAuth = { configured: true, loading: false, session: session(false), isGuest: false, profile: null };
    open();
    await waitFor(() => expect(screen.getByText('Léa')).toBeTruthy());
    expect(mockFetchLeaderboards).toHaveBeenCalled();
    expect(screen.queryByText(/en ligne|hors ligne|validées par le serveur|parties lancées/i)).toBeNull();
  });
});
