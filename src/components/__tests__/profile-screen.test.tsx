// Page Profil : écran sans barre, ouvert par l'avatar, avec un seul bouton
// « ‹ Retour » ; « Changer mon pseudo » ; « Se déconnecter » dans la DA, avec
// confirmation pour un compte invité.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { changePseudo, signOut } from '@/auth/auth-service';
import { AuthFailure } from '@/auth/errors';

const mockAuth = {
  configured: true,
  loading: false,
  session: { user: { id: 'u1' } },
  profile: { id: 'u1', pseudo: 'invite-abc123', avatar: null, pseudo_changed_at: null as string | null },
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
jest.mock('@/auth/auth-service', () => ({ signOut: jest.fn(), deleteMyAccount: jest.fn(), changePseudo: jest.fn() }));
jest.mock('@/components/profile-stats', () => ({ ProfileStats: () => null }));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ProfileScreen = require('@/app/profile').default;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockChangePseudo = changePseudo as jest.MockedFunction<typeof changePseudo>;
const mockRouter = router as unknown as {
  dismissTo: jest.Mock;
  push: jest.Mock;
  back: jest.Mock;
  replace: jest.Mock;
  canGoBack: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue(undefined);
  mockAuth.isGuest = true;
  mockAuth.profile = { id: 'u1', pseudo: 'invite-abc123', avatar: null, pseudo_changed_at: null };
});

describe('page Profil', () => {
  it('a un seul bouton « ‹ Retour », qui revient à l’écran précédent', () => {
    mockRouter.canGoBack.mockReturnValue(true);
    render(<ProfileScreen />);
    expect(screen.queryByText('‹ Accueil')).toBeNull();
    expect(screen.getAllByRole('button', { name: '‹ Retour' })).toHaveLength(1);
    fireEvent.press(screen.getByRole('button', { name: '‹ Retour' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('sans historique (lien direct), le retour mène à l’accueil', () => {
    mockRouter.canGoBack.mockReturnValue(false);
    render(<ProfileScreen />);
    fireEvent.press(screen.getByRole('button', { name: '‹ Retour' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('un invité voit son profil avec la carte « Créer mon compte »', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('invite-abc123')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/upgrade');
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

describe('changer de pseudo depuis le profil', () => {
  beforeEach(() => {
    mockAuth.isGuest = false;
    mockAuth.profile = { id: 'u1', pseudo: 'Alice', avatar: null, pseudo_changed_at: null };
  });

  it('ouvre un champ prérempli, enregistre, confirme et relit le profil', async () => {
    mockChangePseudo.mockResolvedValue('Zoé');
    render(<ProfileScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Changer mon pseudo' }));
    const input = screen.getByDisplayValue('Alice');
    // Accent envoyé séparément par le clavier : recomposé à la saisie.
    fireEvent.changeText(input, 'Zoe\u0301');
    expect(screen.getByDisplayValue('Zoé')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(screen.getByText('C’est fait : ton pseudo est maintenant « Zoé ».')).toBeTruthy());
    expect(mockChangePseudo).toHaveBeenCalledWith(expect.anything(), 'Zoé');
    expect(mockAuth.refreshProfile).toHaveBeenCalled();
  });

  it('vérifie le pseudo avant d’appeler le serveur', () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Changer mon pseudo' }));
    fireEvent.changeText(screen.getByDisplayValue('Alice'), "'Dan");
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText('Le pseudo ne peut ni commencer ni finir par une apostrophe.')).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue("'Dan"), 'Alice');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText('C’est déjà ton pseudo.')).toBeTruthy();
    expect(mockChangePseudo).not.toHaveBeenCalled();
  });

  it('affiche le refus du serveur (pseudo déjà pris)', async () => {
    mockChangePseudo.mockRejectedValue(new AuthFailure('pseudo_taken'));
    render(<ProfileScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Changer mon pseudo' }));
    fireEvent.changeText(screen.getByDisplayValue('Alice'), 'Élodie');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(screen.getByText('Ce pseudo est déjà pris.')).toBeTruthy());
    expect(mockAuth.refreshProfile).not.toHaveBeenCalled();
  });

  it('annonce le délai de 7 jours après un changement récent', () => {
    mockAuth.profile = { id: 'u1', pseudo: 'Alice', avatar: null, pseudo_changed_at: new Date().toISOString() };
    render(<ProfileScreen />);
    expect(screen.getByRole('button', { name: 'Changer mon pseudo' })).toBeDisabled();
    expect(screen.getByText(/qu’une fois tous les 7 jours\. Prochain changement possible le/)).toBeTruthy();
  });

  it('un invité choisit son premier pseudo sans délai', () => {
    mockAuth.isGuest = true;
    mockAuth.profile = { id: 'u1', pseudo: 'invite-abc123', avatar: null, pseudo_changed_at: new Date().toISOString() };
    render(<ProfileScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Changer mon pseudo' }));
    expect(screen.getByLabelText('Nouveau pseudo').props.value).toBe('');
  });
});
