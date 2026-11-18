// Confirmation avant de perdre une partie locale en cours (quitter l'écran ou
// recommencer). Une partie locale n'est jamais sauvegardée : quitter l'écran
// de jeu la supprime. Logique pure, testée à part.

import type { GameState } from '@/game';
import type { Translator } from '@/i18n';

import { isGameInProgress } from './local-game-reducer';

export type GuardKind = 'leave' | 'restart';

export interface GuardTexts {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
}

/** Textes de la fenêtre de confirmation, dans la langue de `t`. */
export function guardTexts(t: Translator, kind: GuardKind): GuardTexts {
  return kind === 'leave'
    ? {
        title: t('game.leaveTitle'),
        message: t('game.leaveMessage'),
        cancelLabel: t('game.continue'),
        confirmLabel: t('game.leave'),
      }
    : {
        title: t('game.restartTitle'),
        message: t('game.restartMessage'),
        cancelLabel: t('game.continue'),
        confirmLabel: t('game.restart'),
      };
}

/** Faut-il demander confirmation avant de quitter ou de recommencer ? */
export function needsConfirmation(game: GameState): boolean {
  return isGameInProgress(game);
}
