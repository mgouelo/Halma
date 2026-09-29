import { describe, expect, it } from '@jest/globals';

import { cellKey, cornerCells, createGame, type GameState, type PlayerId } from '@/game';

import { destinationOf, initLocalGame, localGameReducer, type LocalGameState } from '../local-game-reducer';

const c = (q: number, r: number) => ({ q, r });

function withBoard(pieces: [number, number, PlayerId][], currentPlayer: PlayerId = 0): LocalGameState {
  const game: GameState = { ...createGame(2), board: {}, currentPlayer };
  for (const [q, r, player] of pieces) game.board[cellKey({ q, r })] = player;
  return { game, selected: null, moves: [], animating: null };
}

describe('localGameReducer', () => {
  it('démarre une partie à 2 joueurs sans sélection', () => {
    const state = initLocalGame();
    expect(state.game.players).toHaveLength(2);
    expect(state).toMatchObject({ selected: null, moves: [], animating: null });
  });

  it('sélectionne un pion du joueur courant et liste ses coups', () => {
    const state = localGameReducer(withBoard([[0, 0, 0], [1, 0, 1]]), { type: 'tap', cell: c(0, 0) });
    expect(state.selected).toEqual(c(0, 0));
    expect(state.moves.map((m) => cellKey(destinationOf(m)))).toContain('2,0');
  });

  it('ignore les pions de l’adversaire', () => {
    const before = withBoard([[0, 0, 0], [1, 0, 1]]);
    expect(localGameReducer(before, { type: 'tap', cell: c(1, 0) })).toBe(before);
  });

  it('désélectionne en touchant à nouveau le pion ou une case sans intérêt', () => {
    const selected = localGameReducer(withBoard([[0, 0, 0]]), { type: 'tap', cell: c(0, 0) });
    expect(localGameReducer(selected, { type: 'tap', cell: c(0, 0) }).selected).toBeNull();
    expect(localGameReducer(selected, { type: 'tap', cell: c(3, 3) }).selected).toBeNull();
  });

  it('change de pion sélectionné', () => {
    const selected = localGameReducer(withBoard([[0, 0, 0], [0, 3, 0]]), { type: 'tap', cell: c(0, 0) });
    expect(localGameReducer(selected, { type: 'tap', cell: c(0, 3) }).selected).toEqual(c(0, 3));
  });

  it('joue le coup en touchant une destination, puis attend la fin de l’animation', () => {
    let state = withBoard([[0, 0, 0], [1, 0, 1], [0, 4, 1]]);
    state = localGameReducer(state, { type: 'tap', cell: c(0, 0) });
    state = localGameReducer(state, { type: 'tap', cell: c(2, 0) });

    expect(state.game.board['2,0']).toBe(0);
    expect(state.game.currentPlayer).toBe(1);
    expect(state.animating).toEqual({ move: { from: c(0, 0), path: [c(2, 0)] }, player: 0, turn: 1 });
    expect(state.selected).toBeNull();

    // Pendant l'animation, les touches sont ignorées.
    expect(localGameReducer(state, { type: 'tap', cell: c(0, 4) })).toBe(state);

    state = localGameReducer(state, { type: 'animationEnd' });
    expect(state.animating).toBeNull();
    expect(localGameReducer(state, { type: 'tap', cell: c(0, 4) }).selected).toEqual(c(0, 4));
  });

  it('termine la partie sur le coup gagnant et bloque les touches ensuite', () => {
    const target = cornerCells(0).filter((cell) => cellKey(cell) !== '1,-5');
    let state = withBoard([...target.map((cell): [number, number, PlayerId] => [cell.q, cell.r, 0]), [1, -4, 0], [0, 4, 1]]);
    state = localGameReducer(state, { type: 'tap', cell: c(1, -4) });
    state = localGameReducer(state, { type: 'tap', cell: c(1, -5) });
    state = localGameReducer(state, { type: 'animationEnd' });

    expect(state.game.status).toBe('finished');
    expect(state.game.winner).toBe(0);
    expect(localGameReducer(state, { type: 'tap', cell: c(0, 4) })).toBe(state);
  });

  it('recommence une partie', () => {
    let state = localGameReducer(withBoard([[0, 0, 0]]), { type: 'tap', cell: c(0, 0) });
    state = localGameReducer(state, { type: 'reset' });
    expect(state).toEqual(initLocalGame(2));
  });
});
