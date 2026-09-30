// Suppression de compte, pour l'Edge Function `delete-account`. Indépendant de
// Supabase (comme server.ts) : la base est vue à travers `AccountStore`.
//
// 1. Le joueur abandonne chacune de ses parties en cours, exactement comme avec
//    le bouton « Abandonner » : ses pions sont retirés, les autres continuent
//    (ou gagnent par forfait s'il ne reste qu'eux).
// 2. Le compte est supprimé (clé service_role). La base fait le reste
//    (trigger `before delete` sur profiles, migration account_deletion) :
//    l'hôte passe à un autre humain, le joueur quitte les salles d'attente, sa
//    place dans les parties lancées devient « Compte supprimé », et profil,
//    statistiques et classements disparaissent en cascade.

import type { ServerOptions, GameStore } from './server.ts';
import { handleGameRequest } from './server.ts';
import type { OnlineErrorCode } from './types.ts';

export interface AccountStore {
  /** Rooms dont la partie est en cours et où l'utilisateur a une place. */
  playingRooms(userId: string): Promise<string[]>;
  /** Supprime l'utilisateur (Supabase Auth) ; les données liées partent en cascade. */
  deleteUser(userId: string): Promise<void>;
}

export type DeletionResult = { ok: true; resigned: number } | { ok: false; code: OnlineErrorCode; message: string };

/** Réponses d'abandon qui veulent dire « rien à faire dans cette partie ». */
const ALREADY_OUT: readonly OnlineErrorCode[] = ['forfeited', 'game_over', 'not_in_game', 'room_not_found', 'game_not_started'];

/**
 * Supprime le compte de `userId` (null si le jeton est absent ou invalide).
 * Si un abandon échoue pour une autre raison (base indisponible…), rien n'est
 * supprimé : l'utilisateur peut réessayer. Ne lève jamais.
 */
export async function deleteAccount(
  userId: string | null,
  accounts: AccountStore,
  games: GameStore,
  options: ServerOptions = {},
): Promise<DeletionResult> {
  if (!userId) return { ok: false, code: 'not_authenticated', message: 'Connecte-toi pour supprimer ton compte.' };
  try {
    let resigned = 0;
    for (const roomId of await accounts.playingRooms(userId)) {
      const response = await handleGameRequest({ action: 'resign', roomId }, userId, games, options);
      if (response.ok) resigned++;
      else if (!ALREADY_OUT.includes(response.code)) return response;
    }
    await accounts.deleteUser(userId);
    return { ok: true, resigned };
  } catch (error) {
    console.error(error);
    return { ok: false, code: 'server_error', message: 'La suppression a échoué. Réessaie dans un moment.' };
  }
}
