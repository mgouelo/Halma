import { describe, expect, it, jest } from '@jest/globals';
import { AuthApiError, AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';

import { fetchProfile, signInAsGuest, signInWithEmail, signOut, signUpWithEmail } from '../auth-service';
import {
  AuthFailure,
  describeAuthError,
  GENERIC_ERROR,
  NETWORK_ERROR,
  PROFILE_CREATION_ERROR,
  SERVER_ERROR,
} from '../errors';

type Result = { data: unknown; error: unknown };
const ok = (data: unknown = {}): Result => ({ data, error: null });

/** Faux client Supabase : juste les méthodes utilisées, avec des réponses configurables. */
function fakeClient(overrides: Partial<Record<string, Result>> = {}) {
  const respond = (name: string, fallback: Result) =>
    jest.fn(async (..._args: unknown[]) => overrides[name] ?? fallback);
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: respond('maybeSingle', ok({ id: 'u1', pseudo: 'Alice', avatar: null, created_at: '2026-09-30' })),
  };
  const client = {
    rpc: respond('rpc', ok(true)),
    from: jest.fn(() => query),
    auth: {
      signUp: respond('signUp', ok({ session: { access_token: 't' }, user: { id: 'u1' } })),
      signInWithPassword: respond('signInWithPassword', ok({})),
      signInAnonymously: respond('signInAnonymously', ok({})),
      signOut: respond('signOut', { data: null, error: null }),
    },
  };
  return { client, query, asSupabase: client as unknown as SupabaseClient };
}

describe('signUpWithEmail', () => {
  const fields = { pseudo: ' Alice ', email: ' alice@example.com ', password: 'motdepasse' };

  it('vérifie le pseudo puis inscrit avec le pseudo dans les métadonnées', async () => {
    const { client, asSupabase } = fakeClient();
    await expect(signUpWithEmail(asSupabase, fields)).resolves.toEqual({ needsEmailConfirmation: false });
    expect(client.rpc).toHaveBeenCalledWith('is_pseudo_available', { candidate: 'Alice' });
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'motdepasse',
      options: { data: { pseudo: 'Alice' } },
    });
  });

  it('signale quand l’e-mail doit être confirmé (pas de session)', async () => {
    const { asSupabase } = fakeClient({ signUp: ok({ session: null, user: { id: 'u1' } }) });
    await expect(signUpWithEmail(asSupabase, fields)).resolves.toEqual({ needsEmailConfirmation: true });
  });

  it('refuse un pseudo déjà pris sans tenter l’inscription', async () => {
    const { client, asSupabase } = fakeClient({ rpc: ok(false) });
    await expect(signUpWithEmail(asSupabase, fields)).rejects.toMatchObject({ code: 'pseudo_taken' });
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it('remonte l’erreur de Supabase', async () => {
    const error = new AuthApiError('User already registered', 422, 'user_already_exists');
    const { asSupabase } = fakeClient({ signUp: { data: { session: null, user: null }, error } });
    await expect(signUpWithEmail(asSupabase, fields)).rejects.toBe(error);
  });
});

describe('connexion, invité, déconnexion', () => {
  it('se connecte par e-mail', async () => {
    const { client, asSupabase } = fakeClient();
    await signInWithEmail(asSupabase, { email: ' a@b.fr ', password: 'x' });
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.fr', password: 'x' });
  });

  it('remonte des identifiants incorrects', async () => {
    const error = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');
    const { asSupabase } = fakeClient({ signInWithPassword: { data: {}, error } });
    await expect(signInWithEmail(asSupabase, { email: 'a@b.fr', password: 'x' })).rejects.toBe(error);
  });

  it('se connecte en invité (anonyme)', async () => {
    const { client, asSupabase } = fakeClient();
    await signInAsGuest(asSupabase);
    expect(client.auth.signInAnonymously).toHaveBeenCalled();
  });

  it('se déconnecte', async () => {
    const { client, asSupabase } = fakeClient();
    await signOut(asSupabase);
    expect(client.auth.signOut).toHaveBeenCalled();
  });
});

describe('fetchProfile', () => {
  it('lit le profil de l’utilisateur', async () => {
    const { client, query, asSupabase } = fakeClient();
    await expect(fetchProfile(asSupabase, 'u1')).resolves.toMatchObject({ pseudo: 'Alice' });
    expect(client.from).toHaveBeenCalledWith('profiles');
    expect(query.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('signale un profil manquant', async () => {
    const { asSupabase } = fakeClient({ maybeSingle: ok(null) });
    await expect(fetchProfile(asSupabase, 'u1')).rejects.toBeInstanceOf(AuthFailure);
  });
});

describe('describeAuthError', () => {
  it('traduit les erreurs connues', () => {
    expect(describeAuthError(new AuthApiError('x', 400, 'invalid_credentials'))).toBe('E-mail ou mot de passe incorrect.');
    expect(describeAuthError(new AuthApiError('x', 422, 'anonymous_provider_disabled'))).toMatch(/invité/);
    expect(describeAuthError(new AuthFailure('pseudo_taken', 'Ce pseudo est déjà pris.'))).toBe('Ce pseudo est déjà pris.');
  });

  it('distingue l’échec de création du profil (pseudo pris entre-temps) d’une panne réseau', () => {
    // Forme exacte renvoyée par supabase-js quand le trigger échoue (vérifiée sur un GoTrue local).
    expect(describeAuthError(new AuthRetryableFetchError('Database error saving new user', 500))).toBe(
      PROFILE_CREATION_ERROR,
    );
    expect(describeAuthError(new AuthRetryableFetchError('Bad gateway', 502))).toBe(SERVER_ERROR);
  });

  it('reconnaît les erreurs réseau', () => {
    expect(describeAuthError(new AuthRetryableFetchError('Failed to fetch', 0))).toBe(NETWORK_ERROR);
    expect(describeAuthError(new TypeError('Network request failed'))).toBe(NETWORK_ERROR);
  });

  it('a un message par défaut', () => {
    expect(describeAuthError(new AuthApiError('x', 500, 'bad_jwt'))).toBe(GENERIC_ERROR);
    expect(describeAuthError('bizarre')).toBe(GENERIC_ERROR);
  });
});
