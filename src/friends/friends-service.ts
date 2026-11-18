// Amis : appels aux fonctions SQL de la migration friends (aucune écriture
// directe : tout passe par elles), au-dessus d'un client Supabase passé en
// paramètre (le vrai en production, un faux dans les tests), et messages
// traduits. Réservé aux comptes e-mail : rien n'est envoyé pour un invité.

import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizePseudo } from '@/auth/validation';
import { msg, type Msg, type Translator } from '@/i18n';

export interface Friend {
  /** Identifiant de l'amitié (sert à retirer l'ami). */
  friendshipId: string;
  pseudo: string;
  /** `profiles.avatar`, ou l'identifiant du joueur qui sert de graine. */
  avatar: string;
  points: number;
  /** Rang parmi tous les joueurs classés ; null avant la première partie classée. */
  rank: number | null;
  /** Identifiant du joueur (ouvre son profil) ; null si le serveur ne l'envoie pas encore. */
  userId: string | null;
}

export interface FriendRequest {
  id: string;
  pseudo: string;
  avatar: string;
  createdAt: string;
  /** Identifiant de l'expéditeur (ouvre son profil) ; null si le serveur ne l'envoie pas encore. */
  userId: string | null;
}

/** Codes d'erreur courts des fonctions SQL d'amis (le texte est dans src/i18n, clés `error.friends.*`). */
export const FRIEND_ERROR_CODES = [
  'pseudo_unknown',
  'self_request',
  'not_eligible',
  'already_friends',
  'already_requested',
  'recently_refused',
  'too_many_sent',
  'request_not_found',
  'friend_not_found',
  'guest_not_allowed',
  'player_not_found',
  'not_authenticated',
] as const;

export type FriendErrorCode = (typeof FRIEND_ERROR_CODES)[number];

function isFriendErrorCode(value: unknown): value is FriendErrorCode {
  return typeof value === 'string' && (FRIEND_ERROR_CODES as readonly string[]).includes(value);
}

/** Texte d'une erreur des fonctions d'amis, traduit à partir de son code. */
export function describeFriendError(t: Translator, error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  return isFriendErrorCode(message) ? t(`error.friends.${message}`) : t('error.network');
}

/** Vérification avant l'envoi : un pseudo à chercher (le serveur dit s'il existe). */
export function validateFriendPseudo(pseudo: string): Msg | null {
  return normalizePseudo(pseudo) ? null : msg('friends.validation');
}

/** Amis triés par points, le plus haut d'abord ; à égalité, par rang puis pseudo (comme le serveur). */
export function sortFriends(friends: readonly Friend[]): Friend[] {
  return [...friends].sort(
    (a, b) =>
      b.points - a.points ||
      (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
      a.pseudo.localeCompare(b.pseudo, 'fr'),
  );
}

/** Texte de la pastille de la boîte aux lettres (rien sans demande). */
export function badgeLabel(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? '9+' : String(count);
}

// user_id : ajouté par la migration public_profile (absent d'un serveur plus ancien).
type FriendRow = {
  friendship_id: string;
  pseudo: string;
  avatar: string;
  points: number;
  rank: number | null;
  user_id?: string | null;
};
type RequestRow = { request_id: string; pseudo: string; avatar: string; created_at: string; user_id?: string | null };

export async function fetchFriends(client: SupabaseClient): Promise<Friend[]> {
  const { data, error } = await client.rpc('get_friends');
  if (error) throw error;
  return sortFriends(
    ((data ?? []) as FriendRow[]).map((row) => ({
      friendshipId: row.friendship_id,
      pseudo: row.pseudo,
      avatar: row.avatar,
      points: row.points,
      rank: row.rank,
      userId: row.user_id ?? null,
    })),
  );
}

/** Demandes reçues, de la plus récente à la plus ancienne. */
export async function fetchFriendRequests(client: SupabaseClient): Promise<FriendRequest[]> {
  const { data, error } = await client.rpc('get_friend_requests');
  if (error) throw error;
  return ((data ?? []) as RequestRow[])
    .map((row) => ({
      id: row.request_id,
      pseudo: row.pseudo,
      avatar: row.avatar,
      createdAt: row.created_at,
      userId: row.user_id ?? null,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** `sent` : demande envoyée ; `accepted` : l'autre avait déjà demandé, vous voilà amis. */
export async function sendFriendRequest(client: SupabaseClient, pseudo: string): Promise<'sent' | 'accepted'> {
  const { data, error } = await client.rpc('send_friend_request', { p_pseudo: normalizePseudo(pseudo) });
  if (error) throw error;
  return data === 'accepted' ? 'accepted' : 'sent';
}

export async function respondFriendRequest(client: SupabaseClient, requestId: string, accept: boolean): Promise<void> {
  const { error } = await client.rpc('respond_friend_request', { p_request: requestId, p_accept: accept });
  if (error) throw error;
}

export async function removeFriend(client: SupabaseClient, friendshipId: string): Promise<void> {
  const { error } = await client.rpc('remove_friend', { p_friendship: friendshipId });
  if (error) throw error;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Âge d'une demande : « à l'instant », « il y a 5 min », « il y a 3 h », « hier », « il y a 4 jours ». */
export function formatRequestAge(t: Translator, createdAt: string, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(createdAt));
  if (Number.isNaN(elapsed)) return '';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return t('friends.ageNow');
  if (minutes < 60) return t('friends.ageMinutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('friends.ageHours', { n: hours });
  const days = Math.floor(elapsed / DAY_MS);
  return days === 1 ? t('friends.ageYesterday') : t('friends.ageDays', { count: days });
}
