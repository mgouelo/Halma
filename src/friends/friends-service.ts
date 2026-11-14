// Amis : appels aux fonctions SQL de la migration friends (aucune écriture
// directe : tout passe par elles), au-dessus d'un client Supabase passé en
// paramètre (le vrai en production, un faux dans les tests), et messages en
// français. Réservé aux comptes e-mail : rien n'est envoyé pour un invité.

import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizePseudo } from '@/auth/validation';

export interface Friend {
  /** Identifiant de l'amitié (sert à retirer l'ami). */
  friendshipId: string;
  pseudo: string;
  /** `profiles.avatar`, ou l'identifiant du joueur qui sert de graine. */
  avatar: string;
  points: number;
  /** Rang parmi tous les joueurs classés ; null avant la première partie classée. */
  rank: number | null;
}

export interface FriendRequest {
  id: string;
  pseudo: string;
  avatar: string;
  createdAt: string;
}

/** Codes d'erreur courts des fonctions SQL, et leur traduction. */
export const FRIEND_ERROR_MESSAGES = {
  pseudo_unknown: 'Aucun joueur ne porte ce pseudo.',
  self_request: 'C’est toi ! Choisis le pseudo d’un autre joueur.',
  not_eligible: 'Ce joueur joue en invité : il pourra avoir des amis une fois son compte créé.',
  already_friends: 'Vous êtes déjà amis.',
  already_requested: 'Demande déjà envoyée : elle attend sa réponse.',
  recently_refused: 'Ce joueur a refusé ta demande. Réessaie dans 24 heures.',
  too_many_sent: 'Tu as déjà 20 demandes en attente. Attends des réponses avant d’en envoyer d’autres.',
  request_not_found: 'Cette demande n’existe plus.',
  friend_not_found: 'Cet ami n’est déjà plus dans ta liste.',
  guest_not_allowed: 'Crée ton compte pour avoir des amis.',
  not_authenticated: 'Connecte-toi pour retrouver tes amis.',
} as const;

export type FriendErrorCode = keyof typeof FRIEND_ERROR_MESSAGES;

export const DEFAULT_FRIEND_ERROR = 'Impossible de joindre le serveur. Vérifie ta connexion.';

/** Message à afficher pour une erreur des fonctions d'amis. */
export function describeFriendError(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && Object.prototype.hasOwnProperty.call(FRIEND_ERROR_MESSAGES, message)) {
    return FRIEND_ERROR_MESSAGES[message as FriendErrorCode];
  }
  return DEFAULT_FRIEND_ERROR;
}

/** Vérification avant l'envoi : un pseudo à chercher (le serveur dit s'il existe). */
export function validateFriendPseudo(pseudo: string): string | null {
  return normalizePseudo(pseudo) ? null : 'Écris le pseudo de ton ami.';
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

type FriendRow = { friendship_id: string; pseudo: string; avatar: string; points: number; rank: number | null };
type RequestRow = { request_id: string; pseudo: string; avatar: string; created_at: string };

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
    })),
  );
}

/** Demandes reçues, de la plus récente à la plus ancienne. */
export async function fetchFriendRequests(client: SupabaseClient): Promise<FriendRequest[]> {
  const { data, error } = await client.rpc('get_friend_requests');
  if (error) throw error;
  return ((data ?? []) as RequestRow[])
    .map((row) => ({ id: row.request_id, pseudo: row.pseudo, avatar: row.avatar, createdAt: row.created_at }))
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
export function formatRequestAge(createdAt: string, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(createdAt));
  if (Number.isNaN(elapsed)) return '';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(elapsed / DAY_MS);
  return days === 1 ? 'hier' : `il y a ${days} jours`;
}
