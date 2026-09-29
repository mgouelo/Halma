import { describe, expect, it } from '@jest/globals';
import { cornerCells, cornerOf, createGame, parseCellKey, piecesOf, type PlayerCount } from '..';

const COUNTS: PlayerCount[] = [2, 3, 4, 6];

describe('création de partie', () => {
  it.each(COUNTS)('place 10 pions par joueur dans sa branche (%i joueurs)', (count) => {
    const state = createGame(count);
    expect(state.players).toHaveLength(count);
    expect(Object.keys(state.board)).toHaveLength(10 * count);
    for (const player of state.players) {
      const pieces = piecesOf(state, player.id);
      expect(pieces).toHaveLength(10);
      expect(pieces.every((cell) => cornerOf(cell) === player.home)).toBe(true);
      expect(player.target).toBe((player.home + 3) % 6);
    }
    expect(new Set(state.players.map((p) => p.home)).size).toBe(count);
    expect(state).toMatchObject({ currentPlayer: 0, turn: 0, status: 'playing', winner: null, history: [] });
  });

  it('utilise les placements standard', () => {
    expect(createGame(2).players.map((p) => p.home)).toEqual([3, 0]);
    expect(createGame(3).players.map((p) => p.home)).toEqual([3, 5, 1]);
    expect(createGame(4).players.map((p) => p.home)).toEqual([4, 5, 1, 2]);
    expect(createGame(6).players.map((p) => p.home)).toEqual([3, 4, 5, 0, 1, 2]);
  });

  it('à 2 joueurs, chacun vise la branche de départ de l’autre', () => {
    const [a, b] = createGame(2).players;
    expect(a.target).toBe(b.home);
    expect(b.target).toBe(a.home);
  });

  it('à 3 joueurs, les branches d’arrivée sont vides au départ', () => {
    const state = createGame(3);
    for (const player of state.players) {
      const occupied = Object.keys(state.board)
        .map(parseCellKey)
        .filter((cell) => cornerOf(cell) === player.target);
      expect(occupied).toHaveLength(0);
    }
  });

  it('à 6 joueurs, chaque branche d’arrivée est occupée par l’adversaire d’en face', () => {
    const state = createGame(6);
    for (const player of state.players) {
      const opponent = state.players.find((p) => p.home === player.target)!;
      expect(cornerCells(player.target).every((cell) => state.board[`${cell.q},${cell.r}`] === opponent.id)).toBe(true);
    }
  });

  it('refuse un nombre de joueurs invalide', () => {
    for (const n of [0, 1, 5, 7]) {
      expect(() => createGame(n as PlayerCount)).toThrow();
    }
  });

  it('produit un état sérialisable en JSON', () => {
    const state = createGame(6);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
