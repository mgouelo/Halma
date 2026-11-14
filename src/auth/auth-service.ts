// Opérations d'authentification et de profil, au-dessus d'un client Supabase
// passé en paramètre (le vrai en production, un faux dans les tests).

import { FunctionsHttpError, isAuthApiError, type Session, type SupabaseClient } from '@supabase/supabase-js';

import { linkErrorMessage, type AuthLink } from './auth-links';
import { AuthFailure } from './errors';
import { PSEUDO_ERROR_MESSAGES, tooSoonMessage } from './pseudo-change';
import { normalizePseudo, type SignInFields, type SignUpFields } from './validation';

export interface Profile {
  id: string;
  pseudo: string;
  avatar: string | null;
  created_at: string;
  /** Dernier changement de pseudo (ISO 8601), ou null s'il n'a jamais changé depuis l'inscription. */
  pseudo_changed_at: string | null;
}

export interface SignUpResult {
  /** Vrai si Supabase demande de confirmer l'e-mail avant la première connexion. */
  needsEmailConfirmation: boolean;
}

/**
 * Inscription par e-mail ; le profil (avec le pseudo) est créé par la base.
 * `emailRedirectTo` : adresse ouverte par le lien de confirmation (/auth/confirmed).
 */
export async function signUpWithEmail(
  client: SupabaseClient,
  fields: SignUpFields,
  emailRedirectTo?: string,
): Promise<SignUpResult> {
  const pseudo = normalizePseudo(fields.pseudo);
  const { data: available, error: rpcError } = await client.rpc('is_pseudo_available', { candidate: pseudo });
  if (rpcError) throw rpcError;
  if (available === false) throw new AuthFailure('pseudo_taken', 'Ce pseudo est déjà pris.');

  const { data, error } = await client.auth.signUp({
    email: fields.email.trim(),
    password: fields.password,
    options: { data: { pseudo }, ...(emailRedirectTo ? { emailRedirectTo } : {}) },
  });
  if (error) throw error;
  return { needsEmailConfirmation: data.session === null };
}

export async function signInWithEmail(client: SupabaseClient, fields: SignInFields): Promise<void> {
  const { error } = await client.auth.signInWithPassword({ email: fields.email.trim(), password: fields.password });
  if (error) throw error;
}

/** Connexion invité : compte anonyme, avec un pseudo « invite-xxxxxx » généré par la base. */
export async function signInAsGuest(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
}

export async function signOut(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

/** Code Postgres d'une violation d'unicité (pseudo déjà pris). */
const UNIQUE_VIOLATION = '23505';

/** Traduit un refus de change_pseudo en AuthFailure ; les autres erreurs sont renvoyées telles quelles. */
function pseudoFailure(error: { code?: string; message?: string; details?: string | null }): unknown {
  const reason = error.message ?? '';
  if (reason === 'pseudo_taken' || error.code === UNIQUE_VIOLATION) {
    return new AuthFailure('pseudo_taken', PSEUDO_ERROR_MESSAGES.pseudo_taken);
  }
  if (reason === 'pseudo_invalid' || reason === 'pseudo_reserved') {
    return new AuthFailure(reason, PSEUDO_ERROR_MESSAGES[reason]);
  }
  if (reason === 'pseudo_too_soon') {
    const next = error.details ? new Date(error.details) : null;
    return new AuthFailure('pseudo_too_soon', tooSoonMessage(next && !Number.isNaN(next.getTime()) ? next : null));
  }
  return error;
}

/**
 * Change le pseudo du joueur connecté (fonction change_pseudo de la base, qui
 * vérifie format, unicité et délai de 7 jours). Renvoie le pseudo enregistré.
 */
export async function changePseudo(client: SupabaseClient, pseudo: string): Promise<string> {
  const { data, error } = await client.rpc('change_pseudo', { new_pseudo: normalizePseudo(pseudo) });
  if (error) throw pseudoFailure(error);
  return data as string;
}

/**
 * Transforme le compte invité connecté en compte e-mail, sans changer
 * d'identifiant : le profil (et plus tard les parties) sont conservés.
 *
 * 1. Le pseudo choisi remplace « invite-xxxxxx », par change_pseudo : le
 *    premier choix d'un invité n'est pas soumis au délai, et retenter avec son
 *    propre nouveau pseudo (si l'étape 2 a échoué) ne compte ni comme « déjà
 *    pris » ni comme un nouveau changement.
 * 2. L'e-mail et le mot de passe sont ajoutés au compte. Si le projet exige la
 *    confirmation des e-mails, le compte reste invité jusqu'au clic sur le lien
 *    reçu (le mot de passe est déjà enregistré) ; sinon il devient aussitôt un
 *    compte e-mail.
 */
export async function upgradeGuest(
  client: SupabaseClient,
  fields: SignUpFields,
  emailRedirectTo?: string,
): Promise<SignUpResult> {
  await changePseudo(client, fields.pseudo);

  const { data, error } = await client.auth.updateUser(
    { email: fields.email.trim(), password: fields.password },
    emailRedirectTo ? { emailRedirectTo } : undefined,
  );
  if (error) throw error;
  return { needsEmailConfirmation: data.user.is_anonymous === true || Boolean(data.user.new_email) };
}

/**
 * « Mot de passe oublié » : envoie le lien de réinitialisation. Supabase répond
 * de la même façon que l'adresse ait un compte ou non : l'écran reste neutre.
 */
export async function requestPasswordReset(client: SupabaseClient, email: string, redirectTo: string): Promise<void> {
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
}

/** Nouveau mot de passe, une fois la session de récupération ouverte par le lien. */
export async function updatePassword(client: SupabaseClient, password: string): Promise<void> {
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

/** Renvoie l'e-mail de confirmation (inscription, ou e-mail ajouté par un invité). */
export async function resendConfirmation(
  client: SupabaseClient,
  type: 'signup' | 'email_change',
  email: string,
  emailRedirectTo: string,
): Promise<void> {
  const { error } = await client.auth.resend({ type, email: email.trim(), options: { emailRedirectTo } });
  if (error) throw error;
}

/**
 * Ouvre la session portée par un lien reçu par e-mail : vérifie le jeton
 * (`verifyOtp`) ou reprend les jetons du flux implicite (`setSession`).
 * Un lien sans jeton, expiré ou déjà utilisé donne une AuthFailure `link_invalid`.
 */
export async function sessionFromLink(client: SupabaseClient, link: AuthLink): Promise<Session | null> {
  if (link.kind === 'none') throw new AuthFailure('link_invalid', linkErrorMessage(null));
  if (link.kind === 'error') throw new AuthFailure('link_invalid', linkErrorMessage(link.code));
  const { data, error } =
    link.kind === 'otp'
      ? await client.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
      : await client.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
  if (error) {
    // Jeton refusé par le serveur (expiré, déjà utilisé, inconnu).
    if (isAuthApiError(error) && error.status < 500) throw new AuthFailure('link_invalid', linkErrorMessage(error.code));
    throw error;
  }
  return data.session;
}

/**
 * Inscription en attente de confirmation : tente la connexion avec les
 * identifiants saisis. Vrai si elle réussit (l'e-mail a été validé, sur cet
 * appareil ou un autre) ; faux tant que l'e-mail n'est pas confirmé.
 */
export async function signInIfConfirmed(client: SupabaseClient, fields: SignInFields): Promise<boolean> {
  const { error } = await client.auth.signInWithPassword({ email: fields.email.trim(), password: fields.password });
  if (!error) return true;
  if (isAuthApiError(error) && error.code === 'email_not_confirmed') return false;
  throw error;
}

/**
 * Invité qui a ajouté un e-mail : relit le compte (sans renouveler le jeton) et,
 * si l'e-mail a été confirmé, renouvelle la session pour que l'application le
 * voie comme compte e-mail. Vrai quand c'est fait.
 */
export async function guestEmailConfirmed(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (data.user.is_anonymous || data.user.new_email) return false;
  return !(await refreshAccount(client));
}

/**
 * Relit le compte auprès du serveur (nouveau jeton) : après un clic sur le lien
 * de confirmation, le compte invité apparaît alors comme compte e-mail.
 * Renvoie vrai si le compte est toujours invité.
 */
export async function refreshAccount(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.auth.refreshSession();
  if (error) throw error;
  return data.user?.is_anonymous ?? false;
}

export async function fetchProfile(client: SupabaseClient, userId: string): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .select('id, pseudo, avatar, created_at, pseudo_changed_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AuthFailure('profile_missing', 'Profil introuvable.');
  return data as Profile;
}

/** Enregistre l'avatar du joueur (configuration JSON, ou null pour revenir à l'avatar par défaut). */
export async function updateAvatar(client: SupabaseClient, userId: string, avatar: string | null): Promise<void> {
  const { error } = await client.from('profiles').update({ avatar }).eq('id', userId);
  if (error) throw error;
}

/**
 * Supprime définitivement le compte connecté (Edge Function `delete-account`) :
 * profil, avatar, statistiques et classements ; le joueur abandonne ses
 * parties en cours. Puis oublie la session sur l'appareil.
 */
export async function deleteMyAccount(client: SupabaseClient): Promise<void> {
  const { error } = await client.functions.invoke('delete-account', { method: 'POST' });
  if (error) {
    // Refus du serveur : le corps de la réponse porte un message en français.
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null);
      if (typeof body?.message === 'string') throw new AuthFailure('delete_failed', body.message);
    }
    throw error;
  }
  // Le compte n'existe plus : le jeton enregistré ne sert plus à rien.
  await client.auth.signOut({ scope: 'local' }).catch(() => {});
}
