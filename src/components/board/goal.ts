// Branche d'arrivée mise en évidence sur le plateau (teinte plus marquée) : à
// quel joueur elle appartient. Aucune règle de jeu ici : la branche visée vient
// de `Player.target`.

import type { GameState, PlayerId } from '@/game';

/**
 * Joueur dont la branche d'arrivée est mise en évidence :
 * - partie locale (`viewer` absent) : le joueur dont c'est le tour ;
 * - partie en ligne : toujours le joueur de cet appareil (`viewer`), s'il joue
 *   encore ; personne pour un spectateur ou un joueur qui a quitté la partie.
 * Personne une fois la partie finie.
 */
export function goalPlayer(
  game: Pick<GameState, 'status' | 'currentPlayer' | 'players'>,
  viewer?: { me: PlayerId | null; forfeited: readonly PlayerId[] },
): PlayerId | null {
  if (game.status === 'finished') return null;
  const player = viewer ? viewer.me : game.currentPlayer;
  if (player === null || viewer?.forfeited.includes(player)) return null;
  return game.players.some((p) => p.id === player) ? player : null;
}
