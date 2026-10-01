import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';

import { signOut } from '../auth-service';
import { NETWORK_ERROR } from '../errors';
import { useSignOut } from '../use-sign-out';

jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn(), push: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('../auth-service', () => ({ signOut: jest.fn() }));

const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockRouter = router as unknown as { dismissTo: jest.Mock; push: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue(undefined);
});

describe('déconnexion partagée', () => {
  it('déconnecte un compte e-mail aussitôt, sans confirmation, puis retourne à l’accueil', async () => {
    const { result } = renderHook(() => useSignOut(false));
    await act(async () => result.current.request());
    expect(result.current.confirming).toBe(false);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
    expect(result.current.error).toBeNull();
  });

  it('demande d’abord confirmation à un invité : rien n’est fait tant qu’il ne confirme pas', async () => {
    const { result } = renderHook(() => useSignOut(true));
    act(() => result.current.request());
    expect(result.current.confirming).toBe(true);
    expect(mockSignOut).not.toHaveBeenCalled();

    act(() => result.current.cancel());
    expect(result.current.confirming).toBe(false);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();

    act(() => result.current.request());
    await act(async () => result.current.confirm());
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.current.confirming).toBe(false);
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
  });

  it('propose à l’invité de créer son compte plutôt que de se déconnecter', () => {
    const { result } = renderHook(() => useSignOut(true));
    act(() => result.current.request());
    act(() => result.current.createAccount());
    expect(result.current.confirming).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith('/upgrade');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('une erreur réseau donne un message en français : on reste connecté, l’écran n’est pas bloqué', async () => {
    mockSignOut.mockRejectedValueOnce(new AuthRetryableFetchError('Failed to fetch', 0));
    const { result } = renderHook(() => useSignOut(false));
    await act(async () => result.current.request());
    expect(result.current.error).toBe(NETWORK_ERROR);
    expect(result.current.pending).toBe(false);
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();

    // On peut réessayer ; l'erreur disparaît.
    await act(async () => result.current.request());
    expect(result.current.error).toBeNull();
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
  });
});
