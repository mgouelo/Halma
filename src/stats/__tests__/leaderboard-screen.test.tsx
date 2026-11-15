// Écran des classements : un invité ne voit pas la liste, aucune requête de
// classement n'est envoyée, et la barre de navigation reste affichée ; chaque
// ligne porte son numéro et ouvre le profil du joueur.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import type { AuthState } from '@/auth/auth-context';

type Row = { board: string; rank: number | null; pseudo: string; avatar: string; score: number; is_me: boolean; user_id?: string };
const ROWS: Row[] = [
  { board: 'points', rank: 1, pseudo: 'Noé', avatar: 'Noé', score: 42, is_me: false, user_id: 'u-noe' },
  { board: 'points', rank: 2, pseudo: 'Léa', avatar: 'Léa', score: -15, is_me: true, user_id: 'u1' },
  { board: 'points', rank: 3, pseudo: 'Ugo', avatar: 'Ugo', score: -20, is_me: false, user_id: 'u-ugo' },
  { board: 'points', rank: 4, pseudo: 'Ana', avatar: 'Ana', score: -30, is_me: false, user_id: 'u-ana' },
  { board: 'wins', rank: 1, pseudo: 'Léa', avatar: 'Léa', score: 4, is_me: true, user_id: 'u1' },
];
const mockFetchLeaderboards = jest.fn(async (): Promise<Row[]> => ROWS);
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
const MAIN_SCREENS = ['index', 'online', 'ai-setup', 'local-setup', 'friends', 'profile', 'avatar', 'credits', 'privacy', 'terms', 'sign-in', 'sign-up', 'upgrade'];

function open() {
  return renderRouter(
    {
      '(main)/_layout': MainLayout,
      ...Object.fromEntries(MAIN_SCREENS.map((name) => [`(main)/${name}`, Stub(`Écran ${name}`)])),
      '(main)/leaderboard': LeaderboardScreen,
      'player/[id]': Stub('Écran player'),
    },
    { initialUrl: '/leaderboard' },
  );
}

const session = (isAnonymous: boolean) =>
  ({ user: { id: 'u1', is_anonymous: isAnonymous } }) as unknown as AuthState['session'];

beforeEach(() => {
  mockFetchLeaderboards.mockClear();
  mockFetchLeaderboards.mockImplementation(async () => ROWS);
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
    expect(screen.getByRole('tab', { name: 'Amis' })).toBeTruthy();
    expect(mockFetchLeaderboards).not.toHaveBeenCalled();
  });

  it('l’avatar en haut à droite ouvre le profil (invité compris) ; la barre n’a plus d’entrée Profil', async () => {
    mockAuth = { configured: true, loading: false, session: session(true), isGuest: true, profile: null };
    const router = open();
    expect(screen.queryByRole('tab', { name: 'Profil' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Profil' }));
    await waitFor(() => expect(router.getPathname()).toBe('/profile'));
  });

  it('non connecté : la silhouette en haut à droite ouvre la connexion', async () => {
    mockAuth = { configured: true, loading: false, session: null, isGuest: false, profile: null };
    const router = open();
    fireEvent.press(screen.getByRole('button', { name: 'Profil' }));
    await waitFor(() => expect(router.getPathname()).toBe('/sign-in'));
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
    // « Points » par défaut, score négatif avec son signe.
    await waitFor(() => expect(screen.getByText('Noé')).toBeTruthy());
    expect(screen.getByRole('tab', { name: 'Points', selected: true })).toBeTruthy();
    expect(screen.getByText('-15')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Profil de Léa' }).props.accessibilityValue).toEqual({
      text: '2e place, Léa (toi), -15 points',
    });
    // Trois onglets, plus de classements par niveau d'IA.
    expect(screen.getAllByRole('tab').filter((tab) => ['Points', 'Victoires', 'Série de connexion'].includes(tab.props.accessibilityLabel))).toHaveLength(3);
    expect(screen.queryByRole('tab', { name: 'Hall des pros' })).toBeNull();
    fireEvent.press(screen.getByRole('tab', { name: 'Victoires' }));
    expect(screen.getByRole('button', { name: 'Profil de Léa' }).props.accessibilityValue).toEqual({
      text: '1er place, Léa (toi), 4 victoires',
    });
    expect(mockFetchLeaderboards).toHaveBeenCalled();
    expect(screen.queryByText(/en ligne|hors ligne|validées par le serveur|parties lancées/i)).toBeNull();
  });

  it('le numéro de position est sur chaque ligne, podium compris (médaille et numéro)', async () => {
    mockAuth = { configured: true, loading: false, session: session(false), isGuest: false, profile: null };
    open();
    await waitFor(() => expect(screen.getByText('Noé')).toBeTruthy());
    for (const rank of ['1er', '2e', '3e', '4e']) expect(screen.getByText(rank, { includeHiddenElements: true })).toBeTruthy();
  });

  it('toucher une ligne ouvre le profil du joueur', async () => {
    mockAuth = { configured: true, loading: false, session: session(false), isGuest: false, profile: null };
    const router = open();
    await waitFor(() => expect(screen.getByText('Noé')).toBeTruthy());
    const row = screen.getByRole('button', { name: 'Profil de Noé' });
    expect(row).toHaveStyle({ minHeight: 56 });
    fireEvent.press(row);
    await waitFor(() => expect(router.getPathname()).toBe('/player/u-noe'));
  });

  it('la ligne « C’est toi » du top ouvre son propre profil', async () => {
    mockAuth = { configured: true, loading: false, session: session(false), isGuest: false, profile: null };
    const router = open();
    await waitFor(() => expect(screen.getByText('C’est toi')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Profil de Léa' }));
    await waitFor(() => expect(router.getPathname()).toBe('/profile'));
  });

  it('hors du top 50 : « Tu es 61e » en bas, et la ligne ouvre son profil', async () => {
    mockAuth = { configured: true, loading: false, session: session(false), isGuest: false, profile: null };
    mockFetchLeaderboards.mockImplementation(async () => [
      ...Array.from({ length: 50 }, (_, i) => ({
        board: 'points',
        rank: i + 1,
        pseudo: `J${i + 1}`,
        avatar: 'x',
        score: 500 - i,
        is_me: false,
        user_id: `u-j${i + 1}`,
      })),
      { board: 'points', rank: 61, pseudo: 'Léa', avatar: 'Léa', score: 3, is_me: true, user_id: 'u1' },
    ]);
    const router = open();
    await waitFor(() => expect(screen.getByText('Tu es 61e')).toBeTruthy());
    expect(screen.queryByText('Tu n’es pas encore classé ici.')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Profil de Léa' }));
    await waitFor(() => expect(router.getPathname()).toBe('/profile'));
  });

  it('pas encore classé : le texte reste, sans position', async () => {
    mockAuth = { configured: true, loading: false, session: session(false), isGuest: false, profile: null };
    mockFetchLeaderboards.mockImplementation(async () => [
      { board: 'points', rank: 1, pseudo: 'Noé', avatar: 'Noé', score: 42, is_me: false, user_id: 'u-noe' },
      { board: 'points', rank: null, pseudo: 'Léa', avatar: 'Léa', score: 0, is_me: true, user_id: 'u1' },
    ]);
    open();
    await waitFor(() => expect(screen.getByText('Tu n’es pas encore classé ici.')).toBeTruthy());
    expect(screen.queryByText(/^Tu es /)).toBeNull();
  });

  it('serveur pas encore migré (sans identifiant) : les lignes restent affichées, non cliquables', async () => {
    mockAuth = { configured: true, loading: false, session: session(false), isGuest: false, profile: null };
    mockFetchLeaderboards.mockImplementation(async () => ROWS.map(({ user_id: _id, ...row }) => row));
    open();
    await waitFor(() => expect(screen.getByText('Noé')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Profil de Noé' })).toBeNull();
    expect(screen.getByLabelText('1er place, Noé, 42 points')).toBeTruthy();
  });
});
