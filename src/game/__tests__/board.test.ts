import { describe, expect, it } from '@jest/globals';
import {
  ALL_CELLS,
  cellKey,
  cornerCells,
  cornerOf,
  hexDistance,
  isOnBoard,
  neighbors,
  oppositeCorner,
  parseCellKey,
  PIECES_PER_PLAYER,
  type Corner,
} from '..';
import { c } from '../__test-utils__/helpers';

const CORNERS: Corner[] = [0, 1, 2, 3, 4, 5];

describe('plateau', () => {
  it('compte 121 cases distinctes', () => {
    expect(ALL_CELLS).toHaveLength(121);
    expect(new Set(ALL_CELLS.map(cellKey)).size).toBe(121);
  });

  it('a six branches de 10 cases et un hexagone central de 61 cases', () => {
    expect(PIECES_PER_PLAYER).toBe(10);
    for (const corner of CORNERS) {
      expect(cornerCells(corner)).toHaveLength(10);
    }
    expect(ALL_CELLS.filter((cell) => cornerOf(cell) === null)).toHaveLength(61);
  });

  it('associe chaque branche à la branche opposée, par symétrie centrale', () => {
    for (const corner of CORNERS) {
      const opposite = oppositeCorner(corner);
      expect(oppositeCorner(opposite)).toBe(corner);
      const mirrored = cornerCells(corner).map((cell) => cellKey(c(-cell.q, -cell.r)));
      expect(mirrored.sort()).toEqual(cornerCells(opposite).map(cellKey).sort());
    }
  });

  it('place les pointes de l’étoile aux bons endroits', () => {
    expect(cornerOf(c(4, -8))).toBe(0); // haut
    expect(cornerOf(c(4, 4))).toBe(2); // bas-droite
    expect(cornerOf(c(-4, 8))).toBe(3); // bas
    expect(cornerOf(c(-8, 4))).toBe(4); // bas-gauche
    expect(cornerOf(c(0, 0))).toBeNull();
  });

  it('rejette les cases hors plateau ou non entières', () => {
    expect(isOnBoard(c(5, 5))).toBe(false);
    expect(isOnBoard(c(0, 9))).toBe(false);
    expect(isOnBoard(c(4, -9))).toBe(false);
    expect(isOnBoard(c(0.5, 0))).toBe(false);
    expect(isOnBoard(c(Number.NaN, 0))).toBe(false);
  });

  it('donne 6 voisins au centre et 2 à une pointe', () => {
    expect(neighbors(c(0, 0))).toHaveLength(6);
    expect(neighbors(c(4, -8)).map(cellKey).sort()).toEqual(['3,-7', '4,-7']);
  });

  it('convertit les clés dans les deux sens', () => {
    for (const cell of ALL_CELLS) {
      expect(parseCellKey(cellKey(cell))).toEqual(cell);
    }
  });

  it('calcule la distance hexagonale', () => {
    expect(hexDistance(c(0, 0), c(0, 0))).toBe(0);
    expect(hexDistance(c(4, -8), c(-4, 8))).toBe(16);
    expect(hexDistance(c(0, 0), c(2, -1))).toBe(2);
  });
});
