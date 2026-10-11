import { describe, expect, it } from '@jest/globals';

import { createGame } from '@/game';

import { goalPlayer } from '../goal';

describe('goalPlayer : qui voit sa branche d’arrivée', () => {
  it('partie locale : le joueur dont c’est le tour', () => {
    const game = { ...createGame(3), currentPlayer: 2 };
    expect(goalPlayer(game)).toBe(2);
  });

  it('en ligne : toujours le joueur de l’appareil, même quand ce n’est pas son tour', () => {
    const game = { ...createGame(4), currentPlayer: 0 };
    expect(goalPlayer(game, { me: 3, forfeited: [] })).toBe(3);
  });

  it('personne pour un spectateur, un joueur parti ou une partie finie', () => {
    const game = createGame(2);
    expect(goalPlayer(game, { me: null, forfeited: [] })).toBeNull();
    expect(goalPlayer(game, { me: 1, forfeited: [1] })).toBeNull();
    expect(goalPlayer({ ...game, status: 'finished' })).toBeNull();
    expect(goalPlayer({ ...game, status: 'finished' }, { me: 0, forfeited: [] })).toBeNull();
  });
});
