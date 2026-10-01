// Page Profil : pas de bouton « Accueil » (il est dans la barre), un bouton
// « Se déconnecter » dans la DA, avec confirmation pour un compte invité.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { signOut } from '@/auth/auth-service';

const mockAuth = {
  configured: true,
  loading: false,
  session: { user: { id: 'u1' } },
  profile: { id: 'u1', pseudo: 'invite-abc123', avatar: null },
  isGuest: true,
  pendingEmail: null,
  profileError: false,
  refreshProfile: jest.fn(),
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('@/hooks/__test-utils__/reanimated'));
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { dismissTo: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn() },
  usePathname: () => '/profile',
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/auth/auth-context', () => ({ useAuth: () => mockAuth }));
jest.mock('@/auth/auth-service', () => ({ signOut: jest.fn(), deleteMyAccount: jest.fn() }));
jest.mock('@/components/profile-stats', () => ({ ProfileStats: () => null }));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ProfileScreen = require('@/app/(main)/profile').default;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockRouter = router as unknown as { dismissTo: jest.Mock; push: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue(undefined);
  mockAuth.isGuest = true;
});

describe('page Profil', () => {
  it('n’a ni bouton « Accueil » ni bouton « Retour » (la barre de navigation suffit)', () => {
    render(<ProfileScreen />);
    expect(screen.queryByText('‹ Accueil')).toBeNull();
    expect(screen.queryByText('‹ Retour')).toBeNull();
  });

  it('un invité confirme avant de se déconnecter, et peut préférer créer son compte', async () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByRole('header', { name: 'Se déconnecter ?' })).toBeTruthy();

    fireEvent.press(within(screen.getByLabelText('Se déconnecter ?', { hidden: true })).getByRole('button', { name: 'Créer mon compte' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/upgrade');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('un invité qui confirme est déconnecté et retourne à l’accueil', async () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Se déconnecter' }));
    fireEvent.press(screen.getByRole('button', { name: 'Se déconnecter quand même' }));
    await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalledWith('/'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('un compte e-mail se déconnecte sans confirmation', async () => {
    mockAuth.isGuest = false;
    render(<ProfileScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Se déconnecter' }));
    await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalledWith('/'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('header', { name: 'Se déconnecter ?' })).toBeNull();
  });
});
