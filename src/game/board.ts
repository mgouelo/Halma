// Géométrie du plateau : étoile à six branches de 121 cases.
//
// En coordonnées cubiques (q, r, s) avec q + r + s = 0, l'étoile est l'union
// de deux grands triangles :
//   - triangle A : q ≥ -4, r ≥ -4, s ≥ -4 (91 cases)
//   - triangle B : q ≤ 4,  r ≤ 4,  s ≤ 4  (91 cases)
// Leur intersection est l'hexagone central de rayon 4 (61 cases),
// d'où 91 + 91 - 61 = 121 cases. Chaque branche compte 10 cases.

import type { Cell, CellKey, Corner } from './types';

/** Taille d'une branche (nombre de rangées), 4 pour le plateau standard. */
export const CORNER_SIZE = 4;

/** Nombre de pions par joueur (cases d'une branche). */
export const PIECES_PER_PLAYER = (CORNER_SIZE * (CORNER_SIZE + 1)) / 2;

/** Les six directions voisines en coordonnées axiales. */
export const DIRECTIONS: readonly Cell[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function cellKey(cell: Cell): CellKey {
  return `${cell.q},${cell.r}`;
}

export function parseCellKey(key: CellKey): Cell {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.q === b.q && a.r === b.r;
}

export function addCells(a: Cell, b: Cell): Cell {
  return { q: a.q + b.q, r: a.r + b.r };
}

/** Vrai si la case fait partie du plateau. */
export function isOnBoard(cell: Cell): boolean {
  const { q, r } = cell;
  if (!Number.isInteger(q) || !Number.isInteger(r)) return false;
  const s = -q - r;
  const n = CORNER_SIZE;
  const inA = q >= -n && r >= -n && s >= -n;
  const inB = q <= n && r <= n && s <= n;
  return inA || inB;
}

/** Branche à laquelle appartient la case, ou null pour l'hexagone central. */
export function cornerOf(cell: Cell): Corner | null {
  if (!isOnBoard(cell)) return null;
  const { q, r } = cell;
  const s = -q - r;
  const n = CORNER_SIZE;
  if (r < -n) return 0;
  if (q > n) return 1;
  if (s < -n) return 2;
  if (r > n) return 3;
  if (q < -n) return 4;
  if (s > n) return 5;
  return null;
}

export function oppositeCorner(corner: Corner): Corner {
  return ((corner + 3) % 6) as Corner;
}

function buildAllCells(): Cell[] {
  const cells: Cell[] = [];
  const max = 2 * CORNER_SIZE;
  for (let r = -max; r <= max; r++) {
    for (let q = -max; q <= max; q++) {
      const cell = { q, r };
      if (isOnBoard(cell)) cells.push(cell);
    }
  }
  return cells;
}

/** Toutes les cases du plateau, triées par rangée (r) puis par colonne (q). */
export const ALL_CELLS: readonly Cell[] = buildAllCells();

const CORNER_CELLS: readonly (readonly Cell[])[] = ([0, 1, 2, 3, 4, 5] as const).map(
  (corner) => ALL_CELLS.filter((cell) => cornerOf(cell) === corner),
);

/** Les 10 cases d'une branche. */
export function cornerCells(corner: Corner): readonly Cell[] {
  return CORNER_CELLS[corner];
}

/** Cases voisines présentes sur le plateau. */
export function neighbors(cell: Cell): Cell[] {
  return DIRECTIONS.map((d) => addCells(cell, d)).filter(isOnBoard);
}

/** Distance hexagonale entre deux cases (nombre minimal de pas simples sur une grille infinie). */
export function hexDistance(a: Cell, b: Cell): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
