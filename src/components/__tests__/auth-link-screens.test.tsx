// Écrans des liens reçus par e-mail : mot de passe oublié, nouveau mot de
// passe, compte validé ; et attente de la validation à l'inscription.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import {
  requestPasswordReset,
  resendConfirmation,
  sessionFromLink,
  signInIfConfirmed,
  signUpWithEmail,
  updatePassword,
} from '@/auth/auth-service';
import { AuthFailure } from '@/auth/errors';
import { forgetPendingConfirmation, readPendingConfirmation, rememberPendingConfirmation } from '@/auth/pending-confirmation';
import { resetLinkVerifications } from '@/auth/use-auth-link';
import { AUTO_HOME_DELAY_MS } from '@/auth/use-auto-home';
import { getFlashNotice, setFlashNotice } from '@/lib/flash-notice';

let mockLinkingUrl: string | null = null;
let mockParams: Record<string, string> = {};
/** Où s'affiche l'écran : application, ou navigateur d'un téléphone ou d'un ordinateur (site web). */
let mockHost: 'app' | 'phone' | 'desktop' = 'app';
const mockOpenApp = jest.fn();
const mockAuth = {
  configured: true,
  loading: false,
  session: null as unknown,
  isGuest: false,
  profile: null,
  pendingEmail: null as string | null,
  profileError: false,
  refreshProfile: jest.fn(),
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('@/hooks/__test-utils__/reanimated'));
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { dismissTo: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn() },
  usePathname: () => '/',
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-linking', () => ({ useLinkingURL: () => mockLinkingUrl }));
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ main: true }),
  createEphemeralSupabase: () => ({ ephemeral: true }),
}));
jest.mock('@/auth/auth-context', () => ({ useAuth: () => mockAuth }));
jest.mock('@/auth/auth-service', () => ({
  requestPasswordReset: jest.fn(),
  resendConfirmation: jest.fn(),
  sessionFromLink: jest.fn(),
  signInIfConfirmed: jest.fn(),
  signUpWithEmail: jest.fn(),
  updatePassword: jest.fn(),
  refreshAccount: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));
jest.mock('@/auth/open-app', () => ({ useScreenHost: () => mockHost, openApp: () => mockOpenApp() }));

/* eslint-disable @typescript-eslint/no-require-imports */
const ForgotPassword = require('@/app/forgot-password').default;
const ResetPassword = require('@/app/reset-password').default;
const Confirmed = require('@/app/auth/confirmed').default;
const SignUp = require('@/app/sign-up').default;
const { AccountBar } = require('@/components/account-bar');
/* eslint-enable @typescript-eslint/no-require-imports */

const mockRouter = router as unknown as { dismissTo: jest.Mock; replace: jest.Mock };
const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as jest.MockedFunction<T>;

beforeEach(async () => {
  jest.clearAllMocks();
  resetLinkVerifications();
  mockLinkingUrl = null;
  mockParams = {};
  mockHost = 'app';
  delete process.env.EXPO_PUBLIC_SITE_URL;
  mockAuth.session = null;
  mockAuth.isGuest = false;
  mockAuth.pendingEmail = null;
  setFlashNotice(null);
  await forgetPendingConfirmation();
});
afterEach(() => {
  jest.useRealTimers();
  delete process.env.EXPO_PUBLIC_SITE_URL;
});

describe('mot de passe oublié', () => {
  it('envoie le lien vers halma://reset-password et répond de façon neutre', async () => {
    mocked(requestPasswordReset).mockResolvedValue(undefined);
    mockParams = { email: 'lea@example.com' };
    render(<ForgotPassword />);
    expect(screen.getByDisplayValue('lea@example.com')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Recevoir le lien' }));
    await waitFor(() => expect(screen.getByText(/Si un compte existe avec cette adresse, un e-mail vient d’être envoyé/)).toBeTruthy());
    expect(requestPasswordReset).toHaveBeenCalledWith({ main: true }, 'lea@example.com', 'halma://reset-password');
    expect(screen.getByRole('button', { name: '‹ Retour' })).toBeTruthy();
  });

  it('avec EXPO_PUBLIC_SITE_URL : le lien de l’e-mail mène au site (https), cliquable partout', async () => {
    process.env.EXPO_PUBLIC_SITE_URL = 'https://halma-game.com';
    mocked(requestPasswordReset).mockResolvedValue(undefined);
    render(<ForgotPassword />);
    fireEvent.changeText(screen.getByLabelText('E-mail'), 'lea@example.com');
    fireEvent.press(screen.getByRole('button', { name: 'Recevoir le lien' }));
    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalled());
    expect(requestPasswordReset).toHaveBeenCalledWith({ main: true }, 'lea@example.com', 'https://halma-game.com/reset-password');
  });

  it('vérifie l’adresse avant d’envoyer', () => {
    render(<ForgotPassword />);
    fireEvent.changeText(screen.getByLabelText('E-mail'), 'pas-une-adresse');
    fireEvent.press(screen.getByRole('button', { name: 'Recevoir le lien' }));
    expect(screen.getByText('Cette adresse e-mail ne semble pas valide.')).toBeTruthy();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('traduit la limite d’envoi', async () => {
    const { AuthApiError } = jest.requireActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js');
    mocked(requestPasswordReset).mockRejectedValue(
      new AuthApiError('For security purposes, you can only request this after 12 seconds.', 429, 'over_email_send_rate_limit'),
    );
    render(<ForgotPassword />);
    fireEvent.changeText(screen.getByLabelText('E-mail'), 'a@b.fr');
    fireEvent.press(screen.getByRole('button', { name: 'Recevoir le lien' }));
    await waitFor(() => expect(screen.getByText('Un e-mail vient déjà d’être envoyé. Réessaie dans 12 secondes.')).toBeTruthy());
  });
});

describe('nouveau mot de passe', () => {
  const resetLink = 'halma://reset-password?token_hash=abc&type=recovery';

  it('vérifie le lien, demande le mot de passe deux fois, puis mène à l’accueil connecté', async () => {
    jest.useFakeTimers();
    mockLinkingUrl = resetLink;
    mocked(sessionFromLink).mockResolvedValue(null);
    mocked(updatePassword).mockResolvedValue(undefined);
    render(<ResetPassword />);
    expect(screen.getByLabelText('Vérification du lien…')).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('Nouveau mot de passe')).toBeTruthy());
    expect(sessionFromLink).toHaveBeenCalledWith({ main: true }, { kind: 'otp', tokenHash: 'abc', type: 'recovery' });
    // Deux champs, chacun avec son œil.
    expect(screen.getAllByRole('button', { name: 'Afficher le mot de passe' })).toHaveLength(2);

    fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-mdp');
    fireEvent.changeText(screen.getByLabelText('Confirme le mot de passe'), 'nouveau-mdx');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));
    expect(screen.getByText('Les deux mots de passe ne sont pas identiques.')).toBeTruthy();
    expect(updatePassword).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Confirme le mot de passe'), 'nouveau-mdp');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));
    await waitFor(() => expect(screen.getByText('Mot de passe modifié')).toBeTruthy());
    expect(updatePassword).toHaveBeenCalledWith({ main: true }, 'nouveau-mdp');
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(AUTO_HOME_DELAY_MS));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
  });

  const changePassword = async () => {
    await waitFor(() => expect(screen.getByLabelText('Nouveau mot de passe')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-mdp');
    fireEvent.changeText(screen.getByLabelText('Confirme le mot de passe'), 'nouveau-mdp');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));
    await waitFor(() => expect(screen.getByText('Mot de passe modifié')).toBeTruthy());
  };

  it('site, navigateur d’un téléphone (lien https de l’e-mail) : invite à retourner dans l’application, sans repartir seul', async () => {
    jest.useFakeTimers();
    mockHost = 'phone';
    mockParams = { token_hash: 'abc', type: 'recovery' };
    mocked(sessionFromLink).mockResolvedValue(null);
    mocked(updatePassword).mockResolvedValue(undefined);
    render(<ResetPassword />);
    await changePassword();
    expect(sessionFromLink).toHaveBeenCalledWith({ main: true }, { kind: 'otp', tokenHash: 'abc', type: 'recovery' });
    expect(screen.getByText(/Tu peux retourner dans l’application/)).toBeTruthy();
    expect(screen.queryByText(/Retour à l’accueil…/)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Ouvrir l’application Halma' }));
    expect(mockOpenApp).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(AUTO_HOME_DELAY_MS * 3));
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Jouer sur le site' }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
  });

  it('site, navigateur d’un ordinateur : même message, sans bouton pour ouvrir l’application', async () => {
    mockHost = 'desktop';
    mockParams = { token_hash: 'abc', type: 'recovery' };
    mocked(sessionFromLink).mockResolvedValue(null);
    mocked(updatePassword).mockResolvedValue(undefined);
    render(<ResetPassword />);
    await changePassword();
    expect(screen.getByText(/Tu peux retourner dans l’application/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ouvrir l’application Halma' })).toBeNull();
  });

  it('lien expiré : message clair et bouton pour redemander un lien', async () => {
    mockLinkingUrl = resetLink;
    mocked(sessionFromLink).mockRejectedValue(new AuthFailure('link_invalid', { linkCode: 'otp_expired' }));
    render(<ResetPassword />);
    await waitFor(() => expect(screen.getByText('Lien expiré ou invalide')).toBeTruthy());
    expect(screen.getByText('Ce lien a expiré ou a déjà servi.')).toBeTruthy();
    expect(screen.queryByLabelText('Nouveau mot de passe')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Recevoir un nouveau lien' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/forgot-password');
  });

  it('coupure réseau : « Réessayer » refait la vérification', async () => {
    mockLinkingUrl = resetLink;
    mocked(sessionFromLink).mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValue(null);
    render(<ResetPassword />);
    await waitFor(() => expect(screen.getByText('Impossible de joindre le serveur. Vérifie ta connexion.')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByLabelText('Nouveau mot de passe')).toBeTruthy());
    expect(sessionFromLink).toHaveBeenCalledTimes(2);
  });

  it('un lien profond vers un autre écran n’est pas pris pour celui-ci (paramètres de route en secours)', async () => {
    mockLinkingUrl = 'halma://auth/confirmed?token_hash=zzz&type=email';
    mockParams = { token_hash: 'abc', type: 'recovery' };
    mocked(sessionFromLink).mockResolvedValue(null);
    render(<ResetPassword />);
    await waitFor(() => expect(sessionFromLink).toHaveBeenCalled());
    expect(sessionFromLink).toHaveBeenCalledWith({ main: true }, { kind: 'otp', tokenHash: 'abc', type: 'recovery' });
  });

  it('un même lien n’est vérifié qu’une fois, même si l’écran est rouvert', async () => {
    mockLinkingUrl = resetLink;
    mocked(sessionFromLink).mockResolvedValue(null);
    const first = render(<ResetPassword />);
    await waitFor(() => expect(screen.getByLabelText('Nouveau mot de passe')).toBeTruthy());
    first.unmount();
    render(<ResetPassword />);
    await waitFor(() => expect(screen.getByLabelText('Nouveau mot de passe')).toBeTruthy());
    expect(sessionFromLink).toHaveBeenCalledTimes(1);
  });
});

describe('compte validé', () => {
  const confirmLink = 'halma://auth/confirmed?token_hash=h&type=email';

  it('sur l’appareil de l’inscription : « Compte validé ! » puis l’accueil tout seul', async () => {
    jest.useFakeTimers();
    await rememberPendingConfirmation({ email: 'a@b.fr', kind: 'signup' });
    mockLinkingUrl = confirmLink;
    mocked(sessionFromLink).mockResolvedValue(null);
    render(<Confirmed />);
    await waitFor(() => expect(screen.getByText('Compte validé !')).toBeTruthy());
    expect(sessionFromLink).toHaveBeenCalledWith({ main: true }, { kind: 'otp', tokenHash: 'h', type: 'email' });
    await expect(readPendingConfirmation()).resolves.toBeNull();
    expect(screen.getByRole('button', { name: 'Jouer' })).toBeTruthy();
    act(() => jest.advanceTimersByTime(AUTO_HOME_DELAY_MS));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
  });

  it('sur un autre appareil : « tu peux retourner dans l’application », validé sans ouvrir de session ici', async () => {
    mockLinkingUrl = confirmLink;
    mocked(sessionFromLink).mockResolvedValue(null);
    render(<Confirmed />);
    await waitFor(() => expect(screen.getByText('Compte validé')).toBeTruthy());
    expect(screen.getByText(/Tu peux retourner dans l’application/)).toBeTruthy();
    expect(sessionFromLink).toHaveBeenCalledWith({ ephemeral: true }, expect.objectContaining({ kind: 'otp' }));
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    // Dans l'application elle-même : ni bouton pour l'ouvrir, ni « ferme cette page ».
    expect(screen.queryByRole('button', { name: 'Ouvrir l’application Halma' })).toBeNull();
    expect(screen.queryByText('Tu peux fermer cette page.')).toBeNull();
  });

  it('site, navigateur d’un téléphone (inscription faite dans l’application) : bouton pour ouvrir l’application', async () => {
    mockHost = 'phone';
    mockParams = { token_hash: 'h', type: 'signup' };
    mocked(sessionFromLink).mockResolvedValue(null);
    render(<Confirmed />);
    await waitFor(() => expect(screen.getByText('Compte validé')).toBeTruthy());
    expect(sessionFromLink).toHaveBeenCalledWith({ ephemeral: true }, { kind: 'otp', tokenHash: 'h', type: 'signup' });
    expect(screen.getByText('Tu peux fermer cette page.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Ouvrir l’application Halma' }));
    expect(mockOpenApp).toHaveBeenCalledTimes(1);
  });

  it('site, navigateur d’un ordinateur : pas de bouton pour ouvrir l’application', async () => {
    mockHost = 'desktop';
    mockParams = { token_hash: 'h', type: 'signup' };
    mocked(sessionFromLink).mockResolvedValue(null);
    render(<Confirmed />);
    await waitFor(() => expect(screen.getByText('Compte validé')).toBeTruthy());
    expect(screen.getByText(/Tu peux retourner dans l’application/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ouvrir l’application Halma' })).toBeNull();
  });

  it('lien expiré : message et accès à la connexion', async () => {
    mockLinkingUrl = 'halma://auth/confirmed#error=access_denied&error_code=otp_expired';
    mocked(sessionFromLink).mockImplementation(jest.requireActual<typeof import('@/auth/auth-service')>('@/auth/auth-service').sessionFromLink);
    render(<Confirmed />);
    await waitFor(() => expect(screen.getByText('Lien expiré ou déjà utilisé')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in');
  });
});

describe('inscription en attente de validation', () => {
  const fill = () => {
    fireEvent.changeText(screen.getByLabelText('Pseudo'), 'Zoé');
    fireEvent.changeText(screen.getByLabelText('E-mail'), 'zoe@example.com');
    fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'motdepasse');
    fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));
  };

  it('passe l’adresse /auth/confirmed, attend, puis avance tout seul quand le compte est validé ailleurs', async () => {
    jest.useFakeTimers();
    mocked(signUpWithEmail).mockResolvedValue({ needsEmailConfirmation: true });
    mocked(signInIfConfirmed).mockResolvedValueOnce(false).mockResolvedValue(true);
    render(<SignUp />);
    fill();
    await waitFor(() => expect(screen.getByText(/Cet écran avance tout seul/)).toBeTruthy());
    expect(signUpWithEmail).toHaveBeenCalledWith(
      { main: true },
      { pseudo: 'Zoé', email: 'zoe@example.com', password: 'motdepasse' },
      'halma://auth/confirmed',
      'fr',
    );
    await expect(readPendingConfirmation()).resolves.toEqual({ email: 'zoe@example.com', kind: 'signup' });
    expect(screen.queryByRole('button', { name: 'J’ai confirmé' })).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(signInIfConfirmed).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalledWith('/'));
    expect(getFlashNotice()).toEqual({ key: 'confirmed.notice' });
  });

  it('avec EXPO_PUBLIC_SITE_URL : la confirmation mène au site (https)', async () => {
    process.env.EXPO_PUBLIC_SITE_URL = 'https://halma-game.com';
    mocked(signUpWithEmail).mockResolvedValue({ needsEmailConfirmation: true });
    mocked(signInIfConfirmed).mockResolvedValue(false);
    render(<SignUp />);
    fill();
    await waitFor(() => expect(signUpWithEmail).toHaveBeenCalled());
    expect(signUpWithEmail).toHaveBeenCalledWith(
      { main: true },
      { pseudo: 'Zoé', email: 'zoe@example.com', password: 'motdepasse' },
      'https://halma-game.com/auth/confirmed',
      'fr',
    );
  });

  it('« Renvoyer l’e-mail » renvoie la confirmation d’inscription', async () => {
    mocked(signUpWithEmail).mockResolvedValue({ needsEmailConfirmation: true });
    mocked(signInIfConfirmed).mockResolvedValue(false);
    mocked(resendConfirmation).mockResolvedValue(undefined);
    render(<SignUp />);
    fill();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Renvoyer l’e-mail' })).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Renvoyer l’e-mail' }));
    await waitFor(() => expect(screen.getByText('E-mail renvoyé à zoe@example.com.')).toBeTruthy());
    expect(resendConfirmation).toHaveBeenCalledWith({ main: true }, 'signup', 'zoe@example.com', 'halma://auth/confirmed');
  });
});

describe('accueil d’un invité en attente de confirmation', () => {
  it('plus de bouton « J’ai confirmé », mais « Renvoyer l’e-mail »', () => {
    mockAuth.session = { user: { id: 'u1' } };
    mockAuth.isGuest = true;
    mockAuth.pendingEmail = 'jean@example.com';
    render(<AccountBar />);
    expect(screen.queryByRole('button', { name: 'J’ai confirmé' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Renvoyer l’e-mail' })).toBeTruthy();
    expect(screen.getByText(/Clique sur le lien envoyé à jean@example.com : l’appli s’en apercevra toute seule/)).toBeTruthy();
  });
});
