// L'œil des champs de mot de passe est présent dans les trois formulaires :
// connexion, inscription et création de compte d'un invité (/upgrade).

import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { AccountForm } from '../account-form';
import { SHOW_PASSWORD_LABEL } from '../drawn-text-input';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('@/hooks/__test-utils__/reanimated'));
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { dismissTo: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn() },
  usePathname: () => '/sign-in',
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/auth/auth-context', () => ({
  useAuth: () => ({
    configured: true,
    loading: false,
    session: { user: { id: 'u1' } },
    isGuest: true,
    refreshProfile: jest.fn(),
  }),
}));

describe('œil des mots de passe', () => {
  it('formulaire de connexion', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SignIn = require('@/app/sign-in').default;
    render(<SignIn />);
    const password = screen.getByLabelText('Mot de passe');
    expect(password.props.secureTextEntry).toBe(true);
    expect(password.props.autoComplete).toBe('current-password');
    expect(password.props.textContentType).toBe('password');
    expect(screen.getAllByRole('button', { name: SHOW_PASSWORD_LABEL })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '‹ Retour' })).toBeTruthy();
  });

  it('formulaire d’inscription', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SignUp = require('@/app/sign-up').default;
    render(<SignUp />);
    const password = screen.getByLabelText('Mot de passe');
    expect(password.props.secureTextEntry).toBe(true);
    expect(password.props.autoComplete).toBe('new-password');
    expect(password.props.textContentType).toBe('newPassword');
    expect(screen.getAllByRole('button', { name: SHOW_PASSWORD_LABEL })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '‹ Retour' })).toBeTruthy();
  });

  it('création de compte d’un invité (/upgrade)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Upgrade = require('@/app/upgrade').default;
    render(<Upgrade />);
    expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(true);
    expect(screen.getAllByRole('button', { name: SHOW_PASSWORD_LABEL })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '‹ Retour' })).toBeTruthy();
  });

  it('le formulaire partagé porte l’option', () => {
    render(<AccountForm submitLabel="Créer" pendingLabel="…" pending={false} error={null} onSubmit={() => {}} />);
    expect(screen.getAllByRole('button', { name: SHOW_PASSWORD_LABEL })).toHaveLength(1);
  });
});
