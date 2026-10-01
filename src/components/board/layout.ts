// Géométrie d'affichage du plateau : passage des coordonnées axiales du
// moteur à des pixels. Aucune règle de jeu ici.

import { ALL_CELLS, cellKey, type Cell } from '@/game';

const SQRT3 = Math.sqrt(3);

const BOARD_KEYS: ReadonlySet<string> = new Set(ALL_CELLS.map(cellKey));

/** Marge autour des cases extrêmes, en multiples de l'écart entre deux cases. */
const PADDING_IN_CELLS = 1.15;

/**
 * Sommets de l'étoile (centres des cases extrêmes), dans le sens horaire depuis
 * la pointe du haut : pointe, creux, pointe, creux…
 */
const STAR_VERTICES: readonly Cell[] = [
  { q: 4, r: -8 },
  { q: 4, r: -4 },
  { q: 8, r: -4 },
  { q: 4, r: 0 },
  { q: 4, r: 4 },
  { q: 0, r: 4 },
  { q: -4, r: 8 },
  { q: -4, r: 4 },
  { q: -8, r: 4 },
  { q: -4, r: 0 },
  { q: -4, r: -4 },
  { q: 0, r: -4 },
];

export interface Point {
  x: number;
  y: number;
}

export interface BoardLayout {
  width: number;
  height: number;
  /** Écart entre les centres de deux cases voisines. */
  spacing: number;
  toPoint: (cell: Cell) => Point;
  /** Contour de l'étoile, légèrement agrandi autour des cases (format SVG « x,y x,y … »). */
  starPoints: string;
}

/**
 * Calcule la mise en page pour tenir dans `maxWidth` × `maxHeight`
 * (disposition « pointe en haut » : la branche 0 est en haut, la 3 en bas).
 */
export function computeBoardLayout(maxWidth: number, maxHeight = Infinity): BoardLayout {
  // Étendue des centres : x ∈ [-6√3, 6√3]·s, y ∈ [-12, 12]·s, où s est la taille d'un hexagone.
  const pad = PADDING_IN_CELLS * SQRT3;
  const size = Math.max(0, Math.min(maxWidth / (12 * SQRT3 + 2 * pad), maxHeight / (24 + 2 * pad)));
  const width = (12 * SQRT3 + 2 * pad) * size;
  const height = (24 + 2 * pad) * size;
  const spacing = SQRT3 * size;

  const toPoint = (cell: Cell): Point => ({
    x: width / 2 + SQRT3 * size * (cell.q + cell.r / 2),
    y: height / 2 + 1.5 * size * cell.r,
  });

  const outline = spacing * 0.95;
  const starPoints = STAR_VERTICES.map((vertex) => {
    const p = toPoint(vertex);
    const dx = p.x - width / 2;
    const dy = p.y - height / 2;
    const distance = Math.hypot(dx, dy);
    const scale = distance > 0 ? 1 + outline / distance : 1;
    return `${round(width / 2 + dx * scale)},${round(height / 2 + dy * scale)}`;
  }).join(' ');

  return { width, height, spacing, toPoint, starPoints };
}

/**
 * Case du plateau sous le point (x, y), en pixels dans le repère du plateau
 * (origine en haut à gauche) : l'inverse de `layout.toPoint`. Chaque case
 * occupe son hexagone, sans trou entre deux cases ; renvoie null hors des
 * cases du plateau (marge, creux entre les branches de l'étoile).
 */
export function cellAt(layout: Pick<BoardLayout, 'width' | 'height' | 'spacing'>, x: number, y: number): Cell | null {
  const size = layout.spacing / SQRT3;
  if (!(size > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  // Coordonnées axiales fractionnaires, puis arrondi à l'hexagone le plus proche (via les coordonnées cubiques).
  const fr = (y - layout.height / 2) / (1.5 * size);
  const fq = (x - layout.width / 2) / (SQRT3 * size) - fr / 2;
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  const cell = { q: q + 0, r: r + 0 };
  return BOARD_KEYS.has(cellKey(cell)) ? cell : null;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
