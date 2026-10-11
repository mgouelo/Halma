// Textes du tour en ligne : bannière et titre de l'onglet du navigateur.

import type { PlayerId } from '@/game';

export interface OnlineTurn {
  /** Partie terminée (victoire, forfait ou arrêt). */
  finished: boolean;
  /** Joueur de cet appareil, ou null (spectateur). */
  me: PlayerId | null;
  /** Joueurs qui ont quitté la partie. */
  forfeited: readonly PlayerId[];
  currentPlayer: PlayerId;
  /** Nom affiché du joueur dont c'est le tour (pseudo, « IA · Moyen »…). */
  currentName: string;
}

/** Vrai quand c'est à toi de jouer : partie en cours, ton tour, et tu n'as pas quitté la partie. */
export function isMyTurn(turn: OnlineTurn): boolean {
  return !turn.finished && turn.me !== null && turn.currentPlayer === turn.me && !turn.forfeited.includes(turn.me);
}

/** Texte au-dessus du joueur dont c'est le tour, quand ce n'est pas toi. */
export const WAITING_LEAD = 'En attente de';

/**
 * Titre de l'onglet du navigateur pendant une partie en ligne, pour voir d'un
 * coup d'œil, depuis un autre onglet, que c'est à toi.
 */
export function onlineTabTitle(turn: OnlineTurn): string {
  if (turn.finished) return 'Partie terminée · Halma';
  if (isMyTurn(turn)) return '● À toi de jouer ! · Halma';
  return `${WAITING_LEAD} ${turn.currentName} · Halma`;
}
