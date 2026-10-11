import { describe, expect, it } from '@jest/globals';

import { cornerCells, createGame, oppositeCorner, type Corner, type PlayerCount } from '@/game';

import { branchVertices, GOAL_OVERFLOW, goalGeometry, goalPlayer } from '../goal';
import { cellAt, computeBoardLayout } from '../layout';

const CORNERS: Corner[] = [0, 1, 2, 3, 4, 5];
const COUNTS: PlayerCount[] = [2, 3, 4, 5, 6];

function parse(points: string) {
  return points.split(' ').map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return { x, y };
  });
}

/** Vrai si p est dans le triangle abc (bords compris). */
function inTriangle(p: { x: number; y: number }, [a, b, c]: { x: number; y: number }[]) {
  const side = (u: typeof p, v: typeof p) => (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x);
  const s1 = side(a, b);
  const s2 = side(b, c);
  const s3 = side(c, a);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

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

describe('goalGeometry : contour et drapeau de la branche d’arrivée', () => {
  it('trouve les trois sommets de chaque branche, dont sa pointe', () => {
    for (const corner of CORNERS) {
      expect(branchVertices(corner)).toHaveLength(3);
    }
    expect(branchVertices(0)).toContainEqual({ q: 4, r: -8 });
    expect(branchVertices(3)).toContainEqual({ q: -4, r: 8 });
  });

  for (const [label, width, height] of [
    ['petit écran', 320, 360],
    ['grand écran', 900, 760],
  ] as const) {
    it(`entoure les 10 cases et garde le drapeau dans le cadre (${label}, 2 à 6 joueurs)`, () => {
      const layout = computeBoardLayout(width, height);
      for (const count of COUNTS) {
        for (const player of createGame(count).players) {
          // Branche d'arrivée de chaque joueur, vide ou occupée par un adversaire.
          expect(player.target).toBe(oppositeCorner(player.home));
          const { outline, flag, flagRadius } = goalGeometry(layout, player.target);
          const triangle = parse(outline);
          expect(triangle).toHaveLength(3);
          for (const cell of cornerCells(player.target)) {
            const p = layout.toPoint(cell);
            expect(inTriangle(p, triangle)).toBe(true);
          }
          // Il peut dépasser du plateau, mais pas de la marge intérieure du cadre.
          expect(flag.x - flagRadius).toBeGreaterThanOrEqual(-GOAL_OVERFLOW);
          expect(flag.y - flagRadius).toBeGreaterThanOrEqual(-GOAL_OVERFLOW);
          expect(flag.x + flagRadius).toBeLessThanOrEqual(layout.width + GOAL_OVERFLOW);
          expect(flag.y + flagRadius).toBeLessThanOrEqual(layout.height + GOAL_OVERFLOW);
          // Le drapeau est au-delà de la pointe : aucune case dessous, il ne cache aucun pion.
          expect(cellAt(layout, flag.x, flag.y)).toBeNull();
        }
      }
    });
  }

  it('ne déborde pas sur les cases voisines de la branche', () => {
    const layout = computeBoardLayout(400);
    for (const corner of CORNERS) {
      const triangle = parse(goalGeometry(layout, corner).outline);
      const inside = new Set(cornerCells(corner).map((c) => `${c.q},${c.r}`));
      // Les cases de l'hexagone central restent hors du contour.
      for (let q = -4; q <= 4; q++) {
        for (let r = -4; r <= 4; r++) {
          if (Math.abs(q + r) > 4 || inside.has(`${q},${r}`)) continue;
          expect(inTriangle(layout.toPoint({ q, r }), triangle)).toBe(false);
        }
      }
    }
  });
});
