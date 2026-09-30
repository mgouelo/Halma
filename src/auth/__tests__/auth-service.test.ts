import { describe, expect, it, jest } from '@jest/globals';
import { AuthApiError, AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';

import {
  fetchProfile,
  refreshAccount,
  signInAsGuest,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  upgradeGuest,
} from '../auth-service';
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
    update: jest.fn((_values: unknown) => query),
    eq: jest.fn((_column: string, _value: unknown) => query),
    maybeSingle: respond('maybeSingle', ok({ id: 'u1', pseudo: 'Alice', avatar: null, created_at: '2026-09-30' })),
    // `await client.from(...).update(...).eq(...)` : la requête elle-même est « thenable ».
    then: (resolve: (r: Result) => unknown) => resolve(overrides.update ?? { data: null, error: null }),
  };
  const client = {
    rpc: respond('rpc', ok(true)),
    from: jest.fn(() => query),
    auth: {
      signUp: respond('signUp', ok({ session: { access_token: 't' }, user: { id: 'u1' } })),
      signInWithPassword: respond('signInWithPassword', ok({})),
      signInAnonymously: respond('signInAnonymously', ok({})),
      signOut: respond('signOut', { data: null, error: null }),
      updateUser: respond('updateUser', ok({ user: { id: 'u1', is_anonymous: false, email: 'a@b.fr' } })),
      refreshSession: respond('refreshSession', ok({ session: {}, user: { id: 'u1', is_anonymous: false } })),
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

  it('envoie le pseudo normalisé en NFC', async () => {
    const { client, asSupabase } = fakeClient();
    await signUpWithEmail(asSupabase, { ...fields, pseudo: 'Zoe\u0308' });
    expect(client.rpc).toHaveBeenCalledWith('is_pseudo_available', { candidate: 'Zoë' });
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

describe('upgradeGuest', () => {
  const fields = { pseudo: ' Élodie ', email: ' elodie@example.com ', password: 'motdepasse' };

  it('change le pseudo du profil, puis ajoute e-mail et mot de passe au même compte', async () => {
    const { client, query, asSupabase } = fakeClient();
    await expect(upgradeGuest(asSupabase, 'u1', fields)).resolves.toEqual({ needsEmailConfirmation: false });
    expect(client.from).toHaveBeenCalledWith('profiles');
    expect(query.update).toHaveBeenCalledWith({ pseudo: 'Élodie' });
    expect(query.eq).toHaveBeenCalledWith('id', 'u1');
    expect(client.auth.updateUser).toHaveBeenCalledWith({ email: 'elodie@example.com', password: 'motdepasse' });
    expect(client.rpc).not.toHaveBeenCalled(); // l'index unique tranche, pas de vérification préalable
  });

  it('signale une confirmation d’e-mail en attente (compte encore invité)', async () => {
    const { asSupabase } = fakeClient({
      updateUser: ok({ user: { id: 'u1', is_anonymous: true, email: '', new_email: 'elodie@example.com' } }),
    });
    await expect(upgradeGuest(asSupabase, 'u1', fields)).resolves.toEqual({ needsEmailConfirmation: true });
  });

  it('traduit un pseudo déjà pris (violation d’unicité) sans toucher à l’e-mail', async () => {
    const { client, asSupabase } = fakeClient({
      update: { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } },
    });
    await expect(upgradeGuest(asSupabase, 'u1', fields)).rejects.toMatchObject({ code: 'pseudo_taken' });
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it('remonte un e-mail déjà utilisé', async () => {
    const error = new AuthApiError('A user with this email address has already been registered', 422, 'email_exists');
    const { asSupabase } = fakeClient({ updateUser: { data: { user: null }, error } });
    await expect(upgradeGuest(asSupabase, 'u1', fields)).rejects.toBe(error);
    expect(describeAuthError(error)).toBe('Un compte existe déjà avec cette adresse e-mail.');
  });
});

describe('refreshAccount', () => {
  it('indique si le compte est toujours invité', async () => {
    await expect(refreshAccount(fakeClient().asSupabase)).resolves.toBe(false);
    const stillGuest = fakeClient({ refreshSession: ok({ session: {}, user: { id: 'u1', is_anonymous: true } }) });
    await expect(refreshAccount(stillGuest.asSupabase)).resolves.toBe(true);
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
