// Profil public d'un autre joueur : appel à la fonction SQL get_public_profile
// (migration public_profile), au-dessus d'un client Supabase passé en
// paramètre (le vrai en production, un faux dans les tests). Réservé aux
// comptes e-mail : rien n'est demandé pour un invité.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Relation entre le joueur connecté et le joueur affiché. */
export type PlayerRelation =
  | { kind: 'self' }
  | { kind: 'none' }
  | { kind: 'request_sent' }
  | { kind: 'request_received'; requestId: string }
  | { kind: 'friends'; friendshipId: string };

export interface PublicProfile {
  pseudo: string;
  /** `profiles.avatar`, ou l'identifiant du joueur qui sert de graine. */
  avatar: string;
  points: number;
  /** Rang au classement des points ; null avant la première partie classée. */
  rank: number | null;
  wins: number;
  /** Plus longue série de jours de connexion. */
  bestStreak: number;
  relation: PlayerRelation;
}

type Row = {
  pseudo: string;
  avatar: string;
  points: number | null;
  rank: number | null;
  wins: number | null;
  best_streak: number | null;
  relation: string;
  friendship_id: string | null;
  request_id: string | null;
};

/** Relation lue dans une ligne du serveur ; une valeur inattendue (ou un identifiant manquant) vaut « aucune ». */
export function parseRelation(row: Pick<Row, 'relation' | 'friendship_id' | 'request_id'>): PlayerRelation {
  switch (row.relation) {
    case 'self':
      return { kind: 'self' };
    case 'request_sent':
      return { kind: 'request_sent' };
    case 'request_received':
      return row.request_id ? { kind: 'request_received', requestId: row.request_id } : { kind: 'none' };
    case 'friends':
      return row.friendship_id ? { kind: 'friends', friendshipId: row.friendship_id } : { kind: 'none' };
    default:
      return { kind: 'none' };
  }
}

/** Erreur `player_not_found` : joueur inconnu ou invité (le serveur ne les distingue pas). */
export function isPlayerNotFound(error: unknown): boolean {
  return (error as { message?: unknown } | null)?.message === 'player_not_found';
}

export async function fetchPublicProfile(client: SupabaseClient, userId: string): Promise<PublicProfile> {
  const { data, error } = await client.rpc('get_public_profile', { p_user: userId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Row | null | undefined;
  if (!row) throw { message: 'player_not_found' };
  return {
    pseudo: row.pseudo,
    avatar: row.avatar,
    points: row.points ?? 0,
    rank: row.rank ?? null,
    wins: row.wins ?? 0,
    bestStreak: row.best_streak ?? 0,
    relation: parseRelation(row),
  };
}
