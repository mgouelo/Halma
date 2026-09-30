// Statistiques des parties en ligne : quelles victoires comptent pour le
// classement, et dans quel « hall ». Même règle que la fonction SQL
// `record_game_win` (migration player_stats), qui relit la partie dans la base
// et fait foi ; ce module sert à l'Edge Function (décider s'il faut l'appeler)
// et aux tests.

import { AI_LEVELS, type AiLevel } from '../game/index.ts';

import type { OnlineGame, Participant } from './types.ts';

/** Victoire à compter : le joueur humain gagnant et l'IA la plus forte de la partie. */
export interface WinAward {
  userId: string;
  /** Niveau de l'IA la plus forte de la partie, ou null s'il n'y avait pas d'IA. */
  aiLevel: AiLevel | null;
}

/** Niveau de l'IA la plus forte parmi les participants (null sans IA). */
export function strongestAiLevel(participants: readonly Participant[]): AiLevel | null {
  let best: AiLevel | null = null;
  for (const p of participants) {
    if (p.aiLevel === null) continue;
    if (best === null || AI_LEVELS.indexOf(p.aiLevel) > AI_LEVELS.indexOf(best)) best = p.aiLevel;
  }
  return best;
}

/**
 * Victoire à compter pour cette partie, ou null :
 * - seule une fin `win` compte (un joueur a rempli sa branche) : pas une victoire
 *   par forfait ou abandon des autres, ni une partie arrêtée ;
 * - le vainqueur doit être un humain (une IA qui gagne ne rapporte rien) ;
 * - la victoire est rangée selon l'IA la plus forte présente.
 */
export function winAward(game: OnlineGame, participants: readonly Participant[]): WinAward | null {
  if (game.endReason !== 'win' || game.state.status !== 'finished') return null;
  const winner = game.state.winner;
  if (winner === null || game.forfeited.includes(winner)) return null;
  const participant = participants.find((p) => p.playerIndex === winner);
  if (!participant?.userId) return null;
  return { userId: participant.userId, aiLevel: strongestAiLevel(participants) };
}
