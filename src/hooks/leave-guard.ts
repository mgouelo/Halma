// Confirmation avant de perdre une partie locale en cours (quitter l'écran ou
// recommencer). Une partie locale n'est jamais sauvegardée : quitter l'écran
// de jeu la supprime. Logique pure, testée à part.

import type { GameState } from '@/game';

import { isGameInProgress } from './local-game-reducer';

export type GuardKind = 'leave' | 'restart';

export interface GuardTexts {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
}

export const GUARD_TEXTS: Record<GuardKind, GuardTexts> = {
  leave: {
    title: 'Quitter la partie ?',
    message: 'La partie en cours n’est pas sauvegardée : si tu quittes, elle sera perdue.',
    cancelLabel: 'Continuer la partie',
    confirmLabel: 'Quitter',
  },
  restart: {
    title: 'Nouvelle partie ?',
    message: 'La partie en cours sera perdue et tout recommencera depuis le début.',
    cancelLabel: 'Continuer la partie',
    confirmLabel: 'Recommencer',
  },
};

/** Faut-il demander confirmation avant de quitter ou de recommencer ? */
export function needsConfirmation(game: GameState): boolean {
  return isGameInProgress(game);
}
