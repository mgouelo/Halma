// Opérations d'authentification et de profil, au-dessus d'un client Supabase
// passé en paramètre (le vrai en production, un faux dans les tests).

import type { SupabaseClient } from '@supabase/supabase-js';

import { AuthFailure } from './errors';
import type { SignInFields, SignUpFields } from './validation';

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
  const pseudo = fields.pseudo.trim();
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
