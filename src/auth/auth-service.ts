// Opérations d'authentification et de profil, au-dessus d'un client Supabase
// passé en paramètre (le vrai en production, un faux dans les tests).

import type { SupabaseClient } from '@supabase/supabase-js';

import { AuthFailure } from './errors';
import { normalizePseudo, type SignInFields, type SignUpFields } from './validation';

export interface Profile {
  id: string;
  pseudo: string;
  avatar: string | null;
  created_at: string;
}

export interface SignUpResult {
  /** Vrai si Supabase demande de confirmer l'e-mail avant la première connexion. */
  needsEmailConfirmation: boolean;
}

/** Inscription par e-mail ; le profil (avec le pseudo) est créé par la base. */
export async function signUpWithEmail(client: SupabaseClient, fields: SignUpFields): Promise<SignUpResult> {
  const pseudo = normalizePseudo(fields.pseudo);
  const { data: available, error: rpcError } = await client.rpc('is_pseudo_available', { candidate: pseudo });
  if (rpcError) throw rpcError;
  if (available === false) throw new AuthFailure('pseudo_taken', 'Ce pseudo est déjà pris.');

  const { data, error } = await client.auth.signUp({
    email: fields.email.trim(),
    password: fields.password,
    options: { data: { pseudo } },
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

/**
 * Transforme le compte invité connecté en compte e-mail, sans changer
 * d'identifiant : le profil (et plus tard les parties) sont conservés.
 *
 * 1. Le pseudo choisi remplace « invite-xxxxxx ». On passe directement par la
 *    mise à jour : l'index unique tranche, et retenter avec son propre nouveau
 *    pseudo ne compte pas comme « déjà pris ».
 * 2. L'e-mail et le mot de passe sont ajoutés au compte. Si le projet exige la
 *    confirmation des e-mails, le compte reste invité jusqu'au clic sur le lien
 *    reçu (le mot de passe est déjà enregistré) ; sinon il devient aussitôt un
 *    compte e-mail.
 */
export async function upgradeGuest(client: SupabaseClient, userId: string, fields: SignUpFields): Promise<SignUpResult> {
  const pseudo = normalizePseudo(fields.pseudo);
  const { error: profileError } = await client.from('profiles').update({ pseudo }).eq('id', userId);
  if (profileError) {
    if (profileError.code === UNIQUE_VIOLATION) throw new AuthFailure('pseudo_taken', 'Ce pseudo est déjà pris.');
    throw profileError;
  }

  const { data, error } = await client.auth.updateUser({ email: fields.email.trim(), password: fields.password });
  if (error) throw error;
  return { needsEmailConfirmation: data.user.is_anonymous === true || Boolean(data.user.new_email) };
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
    .select('id, pseudo, avatar, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AuthFailure('profile_missing', 'Profil introuvable.');
  return data as Profile;
}
