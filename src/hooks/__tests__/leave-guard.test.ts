import { describe, expect, it } from '@jest/globals';

import { applyMove, createGame, getAllLegalMoves, type GameState } from '@/game';

import { GUARD_TEXTS, needsConfirmation } from '../leave-guard';
import { initLocalGame, isGameInProgress, localGameReducer } from '../local-game-reducer';

function afterOneMove(game: GameState): GameState {
  return applyMove(game, getAllLegalMoves(game, game.currentPlayer)[0]);
}

describe('confirmation avant de perdre une partie locale', () => {
  it('rien à confirmer avant le premier coup', () => {
    expect(needsConfirmation(createGame(2))).toBe(false);
    expect(needsConfirmation(createGame(6))).toBe(false);
  });

  it('confirmation dès qu’un coup a été joué', () => {
    expect(needsConfirmation(afterOneMove(createGame(2)))).toBe(true);
    expect(isGameInProgress(afterOneMove(createGame(4)))).toBe(true);
  });

  it('rien à confirmer sur une partie terminée', () => {
    const finished: GameState = { ...afterOneMove(createGame(2)), status: 'finished', winner: 0 };
    expect(needsConfirmation(finished)).toBe(false);
  });

  it('« Nouvelle partie » repart d’une partie vierge : plus rien à confirmer', () => {
    const played = { ...initLocalGame(), game: afterOneMove(createGame(2)) };
    expect(needsConfirmation(played.game)).toBe(true);
    expect(needsConfirmation(localGameReducer(played, { type: 'reset' }).game)).toBe(false);
  });

  it('textes clairs, en français, avec le choix sans risque en premier', () => {
    expect(GUARD_TEXTS.leave).toEqual(
      expect.objectContaining({ title: 'Quitter la partie ?', cancelLabel: 'Continuer la partie', confirmLabel: 'Quitter' }),
    );
    expect(GUARD_TEXTS.restart).toEqual(
      expect.objectContaining({ cancelLabel: 'Continuer la partie', confirmLabel: 'Recommencer' }),
    );
    expect(GUARD_TEXTS.leave.message).toMatch(/perdue/);
  });
});
