import { describe, expect, it } from '@jest/globals';
import {
  applyMove,
  cellKey,
  cornerCells,
  createGame,
  getAllLegalMoves,
  hasWon,
  IllegalMoveError,
  piecesOf,
  type GameState,
  type PlayerId,
} from '..';
import { c, seededRandom, stateWith } from '../__test-utils__/helpers';

/** Partie à 2 joueurs où le joueur 0 a 9 pions dans sa branche d'arrivée (haut) et un en (1,-4). */
function almostWon(): GameState {
  const target = cornerCells(0).filter((cell) => cellKey(cell) !== '1,-5');
  return stateWith([...target.map((cell): [number, number, PlayerId] => [cell.q, cell.r, 0]), [1, -4, 0], [0, 4, 1]]);
}

describe('applyMove', () => {
  it('déplace le pion, passe la main et enregistre le coup sans modifier l’état d’origine', () => {
    const state = createGame(2);
    const snapshot = JSON.stringify(state);
    const move = getAllLegalMoves(state, 0)[0];
    const next = applyMove(state, move);

    expect(JSON.stringify(state)).toBe(snapshot);
    expect(next.board[cellKey(move.from)]).toBeUndefined();
    expect(next.board[cellKey(move.path[move.path.length - 1])]).toBe(0);
    expect(next.currentPlayer).toBe(1);
    expect(next.turn).toBe(1);
    expect(next.history).toEqual([{ player: 0, move }]);
  });

  it('applique un saut enchaîné complet', () => {
    const state = stateWith([
      [0, 0, 0],
      [1, 0, 1],
      [3, 0, 0],
    ]);
    const next = applyMove(state, { from: c(0, 0), path: [c(2, 0), c(4, 0)] });
    expect(next.board['4,0']).toBe(0);
    expect(next.board['0,0']).toBeUndefined();
    expect(next.board['1,0']).toBe(1); // les pions sautés restent en place
    expect(next.board['3,0']).toBe(0);
  });

  it('fait tourner la main entre les joueurs dans l’ordre', () => {
    let state = createGame(3);
    const order: PlayerId[] = [];
    for (let i = 0; i < 6; i++) {
      order.push(state.currentPlayer);
      state = applyMove(state, getAllLegalMoves(state, state.currentPlayer)[0]);
    }
    expect(order).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it('refuse de jouer le pion d’un autre joueur', () => {
    const state = createGame(2);
    const opponentMove = getAllLegalMoves(state, 1)[0];
    expect(() => applyMove(state, opponentMove)).toThrow(IllegalMoveError);
  });

  it('refuse un coup illégal', () => {
    const state = createGame(2);
    const from = piecesOf(state, 0)[0];
    expect(() => applyMove(state, { from, path: [c(0, 0)] })).toThrow(IllegalMoveError);
  });

  it('saute un joueur qui ne peut pas bouger', () => {
    // Joueur 1 coincé à la pointe du haut : voisins et cases de saut occupés.
    const state = stateWith(
      [
        [4, -8, 1],
        [3, -7, 0],
        [4, -7, 0],
        [2, -6, 0],
        [4, -6, 0],
        [0, 4, 0],
        [0, -2, 2],
      ],
      { playerCount: 3 },
    );
    const next = applyMove(state, { from: c(0, 4), path: [c(0, 3)] });
    expect(next.currentPlayer).toBe(2);
  });
});

describe('victoire', () => {
  it('personne n’a gagné au départ', () => {
    for (const count of [2, 3, 4, 6] as const) {
      const state = createGame(count);
      expect(state.players.some((p) => hasWon(state, p.id))).toBe(false);
    }
  });

  it('le joueur gagne quand ses 10 pions sont dans la branche opposée', () => {
    const state = almostWon();
    expect(hasWon(state, 0)).toBe(false);
    const next = applyMove(state, { from: c(1, -4), path: [c(1, -5)] });
    expect(hasWon(next, 0)).toBe(true);
    expect(next.status).toBe('finished');
    expect(next.winner).toBe(0);
    expect(next.currentPlayer).toBe(0);
  });

  it('on gagne aussi en terminant par un saut enchaîné', () => {
    const target = cornerCells(0).filter((cell) => cellKey(cell) !== '1,-5');
    const state = stateWith([
      ...target.map((cell): [number, number, PlayerId] => [cell.q, cell.r, 0]),
      [1, -1, 0],
      [1, -2, 1],
      [1, -4, 1],
    ]);
    // Le joueur 0 n'a que 10 pions : 9 dans le coin + (1,-1).
    const next = applyMove(state, { from: c(1, -1), path: [c(1, -3), c(1, -5)] });
    expect(next.winner).toBe(0);
  });

  it('aucun coup n’est accepté une fois la partie terminée', () => {
    const finished = applyMove(almostWon(), { from: c(1, -4), path: [c(1, -5)] });
    expect(() => applyMove(finished, { from: c(0, 4), path: [c(0, 3)] })).toThrow(IllegalMoveError);
  });

  it('une branche d’arrivée pleine mais contenant un pion adverse ne fait pas gagner', () => {
    const target = cornerCells(0);
    const state = stateWith(
      target.map((cell, i): [number, number, PlayerId] => [cell.q, cell.r, i === 0 ? 1 : 0]),
    );
    expect(hasWon(state, 0)).toBe(false);
  });

  it('fonctionne à 6 joueurs pour un joueur qui n’est pas le premier', () => {
    const base = createGame(6);
    const player = base.players[3];
    const board: GameState['board'] = {};
    for (const cell of cornerCells(player.target)) board[cellKey(cell)] = player.id;
    expect(hasWon({ ...base, board }, player.id)).toBe(true);
  });
});

describe('sérialisation', () => {
  it('une partie jouée reste identique après un aller-retour JSON et reste jouable', () => {
    const random = seededRandom(42);
    let state = createGame(4);
    for (let i = 0; i < 80 && state.status === 'playing'; i++) {
      const moves = getAllLegalMoves(state, state.currentPlayer);
      const move = moves[Math.floor(random() * moves.length)];
      const restored: GameState = JSON.parse(JSON.stringify(state));
      expect(restored).toEqual(state);
      state = applyMove(restored, move);
      expect(Object.keys(state.board)).toHaveLength(40);
      for (const player of state.players) expect(piecesOf(state, player.id)).toHaveLength(10);
    }
    expect(state.turn).toBe(80);
    expect(state.history).toHaveLength(80);
  });
});
