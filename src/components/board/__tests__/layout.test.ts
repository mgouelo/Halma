import { describe, expect, it } from '@jest/globals';

import { ALL_CELLS } from '@/game';

import { computeBoardLayout } from '../layout';

describe('computeBoardLayout', () => {
  it('tient dans la largeur donnée et garde toutes les cases dans le cadre', () => {
    const layout = computeBoardLayout(360);
    expect(layout.width).toBeCloseTo(360);
    for (const cell of ALL_CELLS) {
      const { x, y } = layout.toPoint(cell);
      expect(x).toBeGreaterThan(layout.spacing / 2);
      expect(x).toBeLessThan(layout.width - layout.spacing / 2);
      expect(y).toBeGreaterThan(layout.spacing / 2);
      expect(y).toBeLessThan(layout.height - layout.spacing / 2);
    }
  });

  it('se limite à la hauteur disponible', () => {
    const layout = computeBoardLayout(1000, 300);
    expect(layout.height).toBeCloseTo(300);
    expect(layout.width).toBeLessThan(1000);
  });

  it('place la branche 0 en haut et la branche 3 en bas', () => {
    const layout = computeBoardLayout(400);
    expect(layout.toPoint({ q: 4, r: -8 }).y).toBeLessThan(layout.toPoint({ q: -4, r: 8 }).y);
    expect(layout.toPoint({ q: 0, r: 0 })).toEqual({ x: layout.width / 2, y: layout.height / 2 });
  });

  it('écarte les cases voisines de `spacing`', () => {
    const layout = computeBoardLayout(400);
    const a = layout.toPoint({ q: 0, r: 0 });
    for (const n of [{ q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 }]) {
      const b = layout.toPoint(n);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(layout.spacing);
    }
  });

  it('produit un contour d’étoile à 12 sommets', () => {
    expect(computeBoardLayout(400).starPoints.split(' ')).toHaveLength(12);
  });
});

describe('computeBoardLayout (taille nulle)', () => {
  it('ne produit pas de NaN quand la place disponible est nulle (premier rendu, rendu statique)', () => {
    expect(computeBoardLayout(0).starPoints).not.toContain('NaN');
  });
});
