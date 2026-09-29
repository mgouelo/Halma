import { describe, expect, it } from '@jest/globals';
import {
  cellKey,
  createGame,
  getAllLegalMoves,
  getLegalMoves,
  hexDistance,
  validateMove,
  type Move,
} from '..';
import { c, destinations, stateWith } from '../__test-utils__/helpers';

describe('pas simples', () => {
  it('un pion isolé au centre a 6 pas simples et aucun saut', () => {
    const moves = getLegalMoves(stateWith([[0, 0, 0]]), c(0, 0));
    expect(moves).toHaveLength(6);
    expect(moves.every((m) => m.path.length === 1 && hexDistance(m.from, m.path[0]) === 1)).toBe(true);
  });

  it('ne sort pas du plateau depuis une pointe', () => {
    const moves = getLegalMoves(stateWith([[4, -8, 0]]), c(4, -8));
    expect(destinations(moves)).toEqual(['3,-7', '4,-7']);
  });

  it('ne va pas sur une case occupée', () => {
    const state = stateWith([
      [0, 0, 0],
      [1, 0, 1],
      [2, 0, 1], // bloque aussi le saut vers la droite
    ]);
    expect(destinations(getLegalMoves(state, c(0, 0)))).not.toContain('1,0');
    expect(destinations(getLegalMoves(state, c(0, 0)))).not.toContain('2,0');
  });

  it('renvoie une liste vide pour une case vide', () => {
    expect(getLegalMoves(stateWith([[0, 0, 0]]), c(1, 1))).toEqual([]);
  });
});

describe('sauts', () => {
  it('saute par-dessus son propre pion', () => {
    const state = stateWith([
      [0, 0, 0],
      [1, 0, 0],
    ]);
    const jump = getLegalMoves(state, c(0, 0)).find((m) => cellKey(m.path[0]) === '2,0');
    expect(jump).toEqual({ from: c(0, 0), path: [c(2, 0)] });
  });

  it('saute par-dessus un pion adverse', () => {
    const state = stateWith([
      [0, 0, 0],
      [0, 1, 1],
    ]);
    expect(destinations(getLegalMoves(state, c(0, 0)))).toContain('0,2');
  });

  it('ne saute pas par-dessus une case vide ni par-dessus deux pions', () => {
    const state = stateWith([
      [0, 0, 0],
      [1, 0, 1],
      [2, 0, 1],
    ]);
    const dests = destinations(getLegalMoves(state, c(0, 0)));
    expect(dests).not.toContain('3,0');
    expect(dests).not.toContain('0,2'); // (0,1) est vide
  });

  it('ne saute pas hors du plateau', () => {
    // (4,-7) est occupé mais (4,-6)+(0,-1)*2 = (4,-9) est hors plateau.
    const state = stateWith([
      [4, -6, 0],
      [4, -7, 1],
    ]);
    const moves = getLegalMoves(state, c(4, -6));
    expect(moves.every((m) => m.path.length === 1)).toBe(true);
  });
});

describe('sauts enchaînés', () => {
  it('enchaîne plusieurs sauts en ligne droite', () => {
    const state = stateWith([
      [0, 0, 0],
      [1, 0, 1],
      [3, 0, 0],
    ]);
    const moves = getLegalMoves(state, c(0, 0));
    expect(moves).toContainEqual({ from: c(0, 0), path: [c(2, 0), c(4, 0)] });
  });

  it('enchaîne des sauts en changeant de direction', () => {
    const state = stateWith([
      [0, 0, 0],
      [1, 0, 1], // saut vers (2,0)
      [2, -1, 1], // puis vers (2,-2)
      [1, -2, 0], // puis vers (0,-2)
    ]);
    const moves = getLegalMoves(state, c(0, 0));
    expect(moves).toContainEqual({ from: c(0, 0), path: [c(2, 0), c(2, -2), c(0, -2)] });
  });

  it('ne boucle pas et ne revient jamais sur la case de départ', () => {
    // Trois pions en triangle autour de (0,0) : (0,0) → (2,0) → (0,2) → (0,0) formerait une boucle.
    const state = stateWith([
      [0, 0, 0],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ]);
    const moves = getLegalMoves(state, c(0, 0));
    for (const move of moves) {
      const keys = [move.from, ...move.path].map(cellKey);
      expect(new Set(keys).size).toBe(keys.length);
      expect(cellKey(move.path[move.path.length - 1])).not.toBe('0,0');
    }
    expect(destinations(moves)).toEqual(expect.arrayContaining(['2,0', '0,2']));
  });

  it('renvoie une seule entrée par destination, avec le chemin le plus court', () => {
    // (0,2) est atteignable directement (par-dessus (0,1)) ou via (2,0) puis (1,1)… on garde le saut direct.
    const state = stateWith([
      [0, 0, 0],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ]);
    const moves = getLegalMoves(state, c(0, 0));
    const keys = destinations(moves);
    expect(new Set(keys).size).toBe(keys.length);
    expect(moves.find((m) => cellKey(m.path[m.path.length - 1]) === '0,2')?.path).toEqual([c(0, 2)]);
  });

  it('tous les coups listés sont acceptés par validateMove', () => {
    const state = stateWith([
      [0, 0, 0],
      [1, 0, 1],
      [3, 0, 0],
      [2, -1, 1],
      [1, -2, 0],
      [0, 1, 1],
      [-1, 0, 0],
    ]);
    for (const move of getLegalMoves(state, c(0, 0))) {
      expect(validateMove(state, move)).toEqual({ ok: true });
    }
  });
});

describe('validateMove', () => {
  const lone = stateWith([
    [0, 0, 0],
    [1, 0, 1],
    [3, 0, 0],
    [5, -5, 1],
  ]);

  it('accepte un chemin de sauts valide qui n’est pas le plus court', () => {
    const state = stateWith([
      [0, 0, 0],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ]);
    // (0,0) → (2,0) → (0,2) au lieu du saut direct (0,0) → (0,2).
    expect(validateMove(state, { from: c(0, 0), path: [c(2, 0), c(0, 2)] })).toEqual({ ok: true });
  });

  it.each<[string, Move]>([
    ['case de départ vide', { from: c(2, 2), path: [c(2, 3)] }],
    ['pion adverse', { from: c(1, 0), path: [c(1, 1)] }],
    ['chemin vide', { from: c(0, 0), path: [] }],
    ['destination occupée', { from: c(0, 0), path: [c(1, 0)] }],
    ['pas simple suivi d’un saut', { from: c(0, 0), path: [c(0, 1), c(0, 3)] }],
    ['saut par-dessus une case vide', { from: c(0, 0), path: [c(0, 2)] }],
    ['déplacement de trois cases', { from: c(0, 0), path: [c(3, 0)] }],
    ['retour sur la case de départ', { from: c(0, 0), path: [c(2, 0), c(0, 0)] }],
    ['case hors plateau', { from: c(0, 0), path: [c(9, 9)] }],
  ])('refuse : %s', (_label, move) => {
    expect(validateMove(lone, move).ok).toBe(false);
  });

  it('refuse un coup mal formé', () => {
    expect(validateMove(lone, { from: c(0, 0) } as unknown as Move).ok).toBe(false);
    expect(validateMove(lone, { from: c(0, 0), path: [{ q: '1', r: 0 }] } as unknown as Move).ok).toBe(false);
  });
});

describe('getAllLegalMoves', () => {
  it('au départ à 2 joueurs, le joueur 0 a des pas simples et des sauts', () => {
    const state = createGame(2);
    const moves = getAllLegalMoves(state, 0);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.some((m) => m.path.length === 1 && hexDistance(m.from, m.path[0]) === 2)).toBe(true);
    for (const move of moves) expect(validateMove(state, move)).toEqual({ ok: true });
  });
});
