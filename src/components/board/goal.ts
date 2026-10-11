// Branche d'arrivée mise en évidence sur le plateau : à qui elle appartient et
// sa géométrie d'affichage (contour, emplacement du drapeau). Aucune règle de
// jeu ici : la branche visée vient de `Player.target`.

import { Spacing } from '@/constants/theme';
import { cellKey, cornerCells, neighbors, type Corner, type GameState, type PlayerId } from '@/game';

import type { BoardLayout, Point } from './layout';

/** Marge entre les centres des cases du bord de la branche et son contour, en multiples de l'écart entre deux cases. */
const OUTLINE_MARGIN = 0.43;
/** Distance du centre du drapeau à la pointe de la branche, en multiples de l'écart entre deux cases. */
const FLAG_DISTANCE = 0.8;
/** Rayon de la pastille du drapeau, en multiples de l'écart entre deux cases. */
const FLAG_RADIUS = 0.46;
/**
 * Débord permis au calque du marqueur autour du plateau : la marge intérieure
 * du cadre (`GameLayout`). Le drapeau peut y dépasser un peu ; le plateau et sa
 * zone tactile, eux, ne changent pas.
 */
export const GOAL_OVERFLOW = Spacing.two;

/**
 * Joueur dont la branche d'arrivée est mise en évidence :
 * - partie locale (`viewer` absent) : le joueur dont c'est le tour ;
 * - partie en ligne : toujours le joueur de cet appareil (`viewer`), s'il joue
 *   encore ; personne pour un spectateur ou un joueur qui a quitté la partie.
 * Personne une fois la partie finie.
 */
export function goalPlayer(
  game: Pick<GameState, 'status' | 'currentPlayer' | 'players'>,
  viewer?: { me: PlayerId | null; forfeited: readonly PlayerId[] },
): PlayerId | null {
  if (game.status === 'finished') return null;
  const player = viewer ? viewer.me : game.currentPlayer;
  if (player === null || viewer?.forfeited.includes(player)) return null;
  return game.players.some((p) => p.id === player) ? player : null;
}

/** Les trois cases sommets d'une branche (sa pointe et les deux bouts de sa base). */
export function branchVertices(corner: Corner) {
  const cells = cornerCells(corner);
  const keys = new Set(cells.map(cellKey));
  // Un sommet du triangle n'a que deux voisins dans la branche ; les autres cases en ont au moins trois.
  return cells.filter((cell) => neighbors(cell).filter((n) => keys.has(cellKey(n))).length <= 2);
}

export interface GoalGeometry {
  /** Contour de la branche, un triangle un peu plus grand que ses cases (format SVG « x,y x,y x,y »). */
  outline: string;
  /** Centre de la pastille du drapeau, dans la pointe de l'étoile au-delà de la dernière case. */
  flag: Point;
  /** Rayon de la pastille du drapeau. */
  flagRadius: number;
}

/** Géométrie d'affichage de la branche d'arrivée `corner` pour la mise en page `layout`. */
export function goalGeometry(layout: Pick<BoardLayout, 'width' | 'height' | 'spacing' | 'toPoint'>, corner: Corner): GoalGeometry {
  const { width, height, spacing, toPoint } = layout;
  const center = { x: width / 2, y: height / 2 };
  const vertices = branchVertices(corner).map(toPoint);
  const centroid = {
    x: vertices.reduce((sum, p) => sum + p.x, 0) / vertices.length,
    y: vertices.reduce((sum, p) => sum + p.y, 0) / vertices.length,
  };
  // Triangle équilatéral : agrandi autour de son centre pour que chaque côté recule de la marge voulue.
  const side = Math.hypot(vertices[1].x - vertices[0].x, vertices[1].y - vertices[0].y);
  const inradius = side / (2 * Math.sqrt(3));
  const scale = inradius > 0 ? (inradius + OUTLINE_MARGIN * spacing) / inradius : 1;
  const outline = vertices
    .map((p) => `${round(centroid.x + (p.x - centroid.x) * scale)},${round(centroid.y + (p.y - centroid.y) * scale)}`)
    .join(' ');

  // La pointe est le sommet le plus éloigné du centre du plateau ; le drapeau se place juste au-delà.
  const apex = vertices.reduce((a, b) =>
    Math.hypot(a.x - center.x, a.y - center.y) >= Math.hypot(b.x - center.x, b.y - center.y) ? a : b,
  );
  const distance = Math.hypot(apex.x - center.x, apex.y - center.y);
  const ux = distance > 0 ? (apex.x - center.x) / distance : 0;
  const uy = distance > 0 ? (apex.y - center.y) / distance : 0;
  return {
    outline,
    flag: { x: apex.x + ux * FLAG_DISTANCE * spacing, y: apex.y + uy * FLAG_DISTANCE * spacing },
    flagRadius: FLAG_RADIUS * spacing,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
