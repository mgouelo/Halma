import { describe, expect, it, jest } from '@jest/globals';
import { AuthApiError, AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';

import {
  changePseudo,
  fetchProfile,
  guestEmailConfirmed,
  requestPasswordReset,
  resendConfirmation,
  sessionFromLink,
  signInIfConfirmed,
  updatePassword,
  updateAvatar,
  refreshAccount,
  saveAccountLanguage,
  signInAsGuest,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  upgradeGuest,
} from '../auth-service';
import { translator } from '@/i18n';

import { AuthFailure, describeAuthError as describe_ } from '../errors';

const t = translator('fr');
const describeAuthError = (error: unknown) => describe_(t, error);
const GENERIC_ERROR = 'Une erreur est survenue. Réessaie.';
const NETWORK_ERROR = 'Impossible de joindre le serveur. Vérifie ta connexion.';
const SERVER_ERROR = 'Le serveur rencontre un problème. Réessaie dans un moment.';
const PROFILE_CREATION_ERROR =
  'Impossible de créer le compte : ce pseudo vient sans doute d’être pris. Essaies-en un autre.';

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
      resetPasswordForEmail: respond('resetPasswordForEmail', ok({})),
      resend: respond('resend', ok({})),
      verifyOtp: respond('verifyOtp', ok({ session: { access_token: 't' }, user: { id: 'u1' } })),
      setSession: respond('setSession', ok({ session: { access_token: 't' }, user: { id: 'u1' } })),
      getUser: respond('getUser', ok({ user: { id: 'u1', is_anonymous: false, new_email: null } })),
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

  it('garde la langue de l’application dans les métadonnées (e-mail de confirmation dans cette langue)', async () => {
    const { client, asSupabase } = fakeClient();
    await signUpWithEmail(asSupabase, fields, 'https://halma-game.com/auth/confirmed', 'de');
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'motdepasse',
      options: { data: { pseudo: 'Alice', language: 'de' }, emailRedirectTo: 'https://halma-game.com/auth/confirmed' },
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

  it('un invité garde lui aussi la langue de l’application dans ses métadonnées', async () => {
    const { client, asSupabase } = fakeClient();
    await signInAsGuest(asSupabase, 'es');
    expect(client.auth.signInAnonymously).toHaveBeenCalledWith({ options: { data: { language: 'es' } } });
  });

  it('se déconnecte', async () => {
    const { client, asSupabase } = fakeClient();
    await signOut(asSupabase);
    expect(client.auth.signOut).toHaveBeenCalled();
  });
});

describe('changePseudo', () => {
  it('passe par change_pseudo avec le pseudo normalisé (NFC, apostrophe droite, sans espaces)', async () => {
    const { client, query, asSupabase } = fakeClient({ rpc: ok('Zoé d\'Arc') });
    await expect(changePseudo(asSupabase, ' Zoe\u0301 d\u2019Arc ')).resolves.toBe('Zoé d\'Arc');
    expect(client.rpc).toHaveBeenCalledWith('change_pseudo', { new_pseudo: 'Zoé d\'Arc' });
    expect(query.update).not.toHaveBeenCalled(); // la colonne pseudo n'est plus modifiable directement
  });

  it.each([
    ['pseudo_taken', 'Ce pseudo est déjà pris.'],
    ['pseudo_invalid', 'Ce pseudo n’est pas autorisé.'],
    ['pseudo_reserved', 'Ce début de pseudo est réservé aux invités.'],
  ])('traduit le refus %s', async (reason, message) => {
    const { asSupabase } = fakeClient({ rpc: { data: null, error: { code: 'P0001', message: reason, details: null } } });
    const failure = await changePseudo(asSupabase, 'Bobby').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AuthFailure);
    expect(failure).toMatchObject({ code: reason });
    expect(describeAuthError(failure)).toBe(message);
  });

  it('traduit une violation d’unicité (pseudo pris au même moment)', async () => {
    const { asSupabase } = fakeClient({ rpc: { data: null, error: { code: '23505', message: 'duplicate key' } } });
    await expect(changePseudo(asSupabase, 'Bobby')).rejects.toMatchObject({ code: 'pseudo_taken' });
  });

  it('annonce la date du prochain changement possible quand le délai n’est pas écoulé', async () => {
    const next = new Date(2026, 10, 21, 15, 38);
    const { asSupabase } = fakeClient({
      rpc: { data: null, error: { code: 'P0001', message: 'pseudo_too_soon', details: next.toISOString() } },
    });
    const failure = await changePseudo(asSupabase, 'Bobby').catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'pseudo_too_soon' });
    expect(describeAuthError(failure)).toContain('une fois tous les 7 jours');
    expect(describeAuthError(failure)).toContain('21 novembre à 15 h 38');
    expect(describe_(translator('de'), failure)).toContain('alle 7 Tage');
  });

  it('remonte les autres erreurs telles quelles', async () => {
    const error = { code: 'PGRST301', message: 'JWT expired' };
    const { asSupabase } = fakeClient({ rpc: { data: null, error } });
    await expect(changePseudo(asSupabase, 'Bobby')).rejects.toBe(error);
  });
});

describe('upgradeGuest', () => {
  const fields = { pseudo: ' Jean.Dupont ', email: ' jean@example.com ', password: 'motdepasse' };

  it('change le pseudo par change_pseudo, puis ajoute e-mail et mot de passe au même compte', async () => {
    const { client, query, asSupabase } = fakeClient({ rpc: ok('Jean.Dupont') });
    await expect(upgradeGuest(asSupabase, fields)).resolves.toEqual({ needsEmailConfirmation: false });
    expect(client.rpc).toHaveBeenCalledWith('change_pseudo', { new_pseudo: 'Jean.Dupont' });
    expect(query.update).not.toHaveBeenCalled();
    expect(client.auth.updateUser).toHaveBeenCalledWith({ email: 'jean@example.com', password: 'motdepasse' }, undefined);
  });

  it('signale une confirmation d’e-mail en attente (compte encore invité)', async () => {
    const { asSupabase } = fakeClient({
      updateUser: ok({ user: { id: 'u1', is_anonymous: true, email: '', new_email: 'jean@example.com' } }),
    });
    await expect(upgradeGuest(asSupabase, fields)).resolves.toEqual({ needsEmailConfirmation: true });
  });

  it('traduit un pseudo déjà pris sans toucher à l’e-mail', async () => {
    const { client, asSupabase } = fakeClient({
      rpc: { data: null, error: { code: 'P0001', message: 'pseudo_taken' } },
    });
    await expect(upgradeGuest(asSupabase, fields)).rejects.toMatchObject({ code: 'pseudo_taken' });
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it('remonte un e-mail déjà utilisé', async () => {
    const error = new AuthApiError('A user with this email address has already been registered', 422, 'email_exists');
    const { asSupabase } = fakeClient({ updateUser: { data: { user: null }, error } });
    await expect(upgradeGuest(asSupabase, fields)).rejects.toBe(error);
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

describe('updateAvatar', () => {
  it('enregistre l’avatar dans le profil du joueur', async () => {
    const { client, query, asSupabase } = fakeClient();
    await updateAvatar(asSupabase, 'u1', '{"v":1}');
    expect(client.from).toHaveBeenCalledWith('profiles');
    expect(query.update).toHaveBeenCalledWith({ avatar: '{"v":1}' });
    expect(query.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('remonte l’erreur de la base', async () => {
    const error = { code: '23514', message: 'check violation' };
    const { asSupabase } = fakeClient({ update: { data: null, error } });
    await expect(updateAvatar(asSupabase, 'u1', 'x')).rejects.toBe(error);
  });
});

describe('describeAuthError', () => {
  it('traduit les erreurs connues', () => {
    expect(describeAuthError(new AuthApiError('x', 400, 'invalid_credentials'))).toBe('E-mail ou mot de passe incorrect.');
    expect(describeAuthError(new AuthApiError('x', 422, 'anonymous_provider_disabled'))).toMatch(/invité/);
    expect(describeAuthError(new AuthFailure('pseudo_taken'))).toBe('Ce pseudo est déjà pris.');
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

describe('liens de confirmation : adresse de redirection', () => {
  it('inscription : emailRedirectTo vers /auth/confirmed', async () => {
    const { client, asSupabase } = fakeClient();
    await signUpWithEmail(asSupabase, { pseudo: 'Alice', email: 'a@b.fr', password: 'motdepasse' }, 'halma://auth/confirmed');
    expect(client.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ options: { data: { pseudo: 'Alice' }, emailRedirectTo: 'halma://auth/confirmed' } }),
    );
  });

  it('invité vers compte e-mail : emailRedirectTo passé à updateUser', async () => {
    const { client, asSupabase } = fakeClient({ rpc: ok('Jean') });
    await upgradeGuest(asSupabase, { pseudo: 'Jean', email: 'j@b.fr', password: 'motdepasse' }, 'https://h.example/auth/confirmed');
    expect(client.auth.updateUser).toHaveBeenCalledWith(
      { email: 'j@b.fr', password: 'motdepasse' },
      { emailRedirectTo: 'https://h.example/auth/confirmed' },
    );
  });

  it('renvoie l’e-mail de confirmation', async () => {
    const { client, asSupabase } = fakeClient();
    await resendConfirmation(asSupabase, 'email_change', ' j@b.fr ', 'halma://auth/confirmed');
    expect(client.auth.resend).toHaveBeenCalledWith({
      type: 'email_change',
      email: 'j@b.fr',
      options: { emailRedirectTo: 'halma://auth/confirmed' },
    });
  });
});

describe('mot de passe oublié', () => {
  it('demande le lien avec l’adresse de redirection', async () => {
    const { client, asSupabase } = fakeClient();
    await requestPasswordReset(asSupabase, ' a@b.fr ', 'halma://reset-password');
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.fr', { redirectTo: 'halma://reset-password' });
  });

  it('traduit la limite d’envoi, avec le délai', async () => {
    const error = new AuthApiError('For security purposes, you can only request this after 37 seconds.', 429, 'over_email_send_rate_limit');
    const { asSupabase } = fakeClient({ resetPasswordForEmail: { data: {}, error } });
    await expect(requestPasswordReset(asSupabase, 'a@b.fr', 'x')).rejects.toBe(error);
    expect(describeAuthError(error)).toBe('Un e-mail vient déjà d’être envoyé. Réessaie dans 37 secondes.');
    const quota = new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit');
    expect(describeAuthError(quota)).toBe('Trop d’e-mails envoyés. Réessaie dans quelques minutes.');
    expect(describeAuthError(new AuthApiError('Too many requests', 429, undefined))).toBe(
      'Trop de tentatives. Réessaie dans quelques minutes.',
    );
  });

  it('enregistre le nouveau mot de passe', async () => {
    const { client, asSupabase } = fakeClient();
    await updatePassword(asSupabase, 'nouveau-mdp');
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'nouveau-mdp' });
  });

  it('traduit un mot de passe identique à l’ancien', async () => {
    const error = new AuthApiError('New password should be different from the old password.', 422, 'same_password');
    const { asSupabase } = fakeClient({ updateUser: { data: { user: null }, error } });
    await expect(updatePassword(asSupabase, 'ancien-mdp')).rejects.toBe(error);
    expect(describeAuthError(error)).toBe('Choisis un mot de passe différent de l’ancien.');
  });
});

describe('session ouverte par un lien', () => {
  it('jeton à vérifier (verifyOtp)', async () => {
    const { client, asSupabase } = fakeClient();
    await expect(sessionFromLink(asSupabase, { kind: 'otp', tokenHash: 'h', type: 'recovery' })).resolves.toEqual({
      access_token: 't',
    });
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'h', type: 'recovery' });
  });

  it('jetons du flux implicite (setSession)', async () => {
    const { client, asSupabase } = fakeClient();
    await sessionFromLink(asSupabase, { kind: 'session', accessToken: 'a', refreshToken: 'r', type: 'recovery' });
    expect(client.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
  });

  it('lien sans jeton ou en erreur : lien invalide, sans appel au serveur', async () => {
    const { client, asSupabase } = fakeClient();
    await expect(sessionFromLink(asSupabase, { kind: 'none' })).rejects.toMatchObject({ code: 'link_invalid' });
    await expect(
      sessionFromLink(asSupabase, { kind: 'error', code: 'otp_expired', description: null }),
    ).rejects.toMatchObject({ code: 'link_invalid', detail: { linkCode: 'otp_expired' } });
    expect(client.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('jeton refusé (expiré ou déjà utilisé) : lien invalide', async () => {
    const error = new AuthApiError('Token has expired or is invalid', 403, 'otp_expired');
    const { asSupabase } = fakeClient({ verifyOtp: { data: { session: null, user: null }, error } });
    const failure = await sessionFromLink(asSupabase, { kind: 'otp', tokenHash: 'h', type: 'email' }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AuthFailure);
    expect(describeAuthError(failure)).toBe('Ce lien a expiré ou a déjà servi.');
  });

  it('coupure réseau : l’erreur reste une erreur réseau (on pourra réessayer)', async () => {
    const error = new AuthRetryableFetchError('Failed to fetch', 0);
    const { asSupabase } = fakeClient({ verifyOtp: { data: { session: null, user: null }, error } });
    await expect(sessionFromLink(asSupabase, { kind: 'otp', tokenHash: 'h', type: 'email' })).rejects.toBe(error);
    expect(describeAuthError(error)).toBe(NETWORK_ERROR);
  });
});

describe('détection de la validation', () => {
  it('inscription : connexion refusée tant que l’e-mail n’est pas confirmé', async () => {
    const error = new AuthApiError('Email not confirmed', 400, 'email_not_confirmed');
    const waiting = fakeClient({ signInWithPassword: { data: {}, error } });
    await expect(signInIfConfirmed(waiting.asSupabase, { email: 'a@b.fr', password: 'motdepasse' })).resolves.toBe(false);
    const confirmed = fakeClient();
    await expect(signInIfConfirmed(confirmed.asSupabase, { email: ' a@b.fr ', password: 'motdepasse' })).resolves.toBe(true);
    expect(confirmed.client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.fr', password: 'motdepasse' });
  });

  it('inscription : un autre refus (mot de passe changé…) est remonté', async () => {
    const error = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');
    const { asSupabase } = fakeClient({ signInWithPassword: { data: {}, error } });
    await expect(signInIfConfirmed(asSupabase, { email: 'a@b.fr', password: 'x' })).rejects.toBe(error);
  });

  it('invité : toujours invité, rien ne change', async () => {
    const { client, asSupabase } = fakeClient({
      getUser: ok({ user: { id: 'u1', is_anonymous: true, new_email: 'j@b.fr' } }),
    });
    await expect(guestEmailConfirmed(asSupabase)).resolves.toBe(false);
    expect(client.auth.refreshSession).not.toHaveBeenCalled();
  });

  it('invité : e-mail validé ailleurs, la session est renouvelée (compte e-mail)', async () => {
    const { client, asSupabase } = fakeClient();
    await expect(guestEmailConfirmed(asSupabase)).resolves.toBe(true);
    expect(client.auth.refreshSession).toHaveBeenCalledTimes(1);
  });
});

describe('saveAccountLanguage', () => {
  it('enregistre la langue sur le profil (set_my_language) et dans les métadonnées du compte', async () => {
    const { client, asSupabase } = fakeClient({ rpc: ok(null) });
    await saveAccountLanguage(asSupabase, 'en');
    expect(client.rpc).toHaveBeenCalledWith('set_my_language', { p_language: 'en' });
    expect(client.auth.updateUser).toHaveBeenCalledWith({ data: { language: 'en' } });
  });

  it('les métadonnées sont enregistrées même si la base n’est pas encore migrée, et l’erreur remonte', async () => {
    const missing = { code: 'PGRST202', message: 'Could not find the function public.set_my_language' };
    const { client, asSupabase } = fakeClient({ rpc: { data: null, error: missing } });
    await expect(saveAccountLanguage(asSupabase, 'de')).rejects.toBe(missing);
    expect(client.auth.updateUser).toHaveBeenCalledWith({ data: { language: 'de' } });
  });
});
