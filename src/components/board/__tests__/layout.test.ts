import { describe, expect, it } from '@jest/globals';

import { ALL_CELLS } from '@/game';

import { cellAt, computeBoardLayout } from '../layout';

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

describe('cellAt (coordonnées vers case)', () => {
  it('retrouve chacune des 121 cases à partir de son centre, à toutes les tailles', () => {
    for (const width of [200, 360, 411, 900]) {
      const layout = computeBoardLayout(width);
      for (const cell of ALL_CELLS) {
        const { x, y } = layout.toPoint(cell);
        expect(cellAt(layout, x, y)).toEqual(cell);
      }
    }
  });

  it('retrouve la case sur toute la surface de son cercle (sans trou entre deux cases)', () => {
    const layout = computeBoardLayout(400);
    const radius = layout.spacing / 2 - 0.5;
    for (const cell of ALL_CELLS) {
      const { x, y } = layout.toPoint(cell);
      for (let angle = 0; angle < 360; angle += 30) {
        const a = (angle * Math.PI) / 180;
        expect(cellAt(layout, x + radius * Math.cos(a), y + radius * Math.sin(a))).toEqual(cell);
      }
    }
  });

  it('respecte la limite entre deux cases voisines', () => {
    const layout = computeBoardLayout(400);
    const a = layout.toPoint({ q: 0, r: 0 });
    const b = layout.toPoint({ q: 1, r: 0 });
    expect(cellAt(layout, a.x + (b.x - a.x) * 0.4, a.y)).toEqual({ q: 0, r: 0 });
    expect(cellAt(layout, a.x + (b.x - a.x) * 0.6, a.y)).toEqual({ q: 1, r: 0 });
  });

  it('renvoie null hors du plateau : marge, creux entre les branches, coordonnées invalides', () => {
    const layout = computeBoardLayout(400);
    expect(cellAt(layout, 1, 1)).toBeNull();
    expect(cellAt(layout, layout.width - 1, layout.height - 1)).toBeNull();
    // Creux entre la pointe du haut et celle de droite : cases hors de l'étoile.
    expect(cellAt(layout, layout.toPoint({ q: 8, r: -8 }).x, layout.toPoint({ q: 8, r: -8 }).y)).toBeNull();
    expect(cellAt(layout, Number.NaN, 10)).toBeNull();
    expect(cellAt({ width: 0, height: 0, spacing: 0 }, 0, 0)).toBeNull();
  });

  it('ne renvoie jamais -0 (les cases sont comparées avec toEqual / par clé)', () => {
    const layout = computeBoardLayout(400);
    const { x, y } = layout.toPoint({ q: 0, r: 0 });
    const cell = cellAt(layout, x, y)!;
    expect(Object.is(cell.q, 0)).toBe(true);
    expect(Object.is(cell.r, 0)).toBe(true);
  });
});
