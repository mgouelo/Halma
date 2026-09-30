import { describe, expect, it } from '@jest/globals';

import { FONT_FILES } from '../fonts';
import { Colors, FontFaces, Fonts, PlayerColors, TouchTarget, Typography } from '../theme';

/** Rapport de contraste WCAG 2 entre deux couleurs « #RRGGBB ». */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.replace('#', '').slice(i - 1, i + 1), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('contrastes (WCAG AA : 4,5 pour le texte)', () => {
  it('le texte principal est lisible sur le fond et sur tous les pastels des joueurs', () => {
    for (const background of [Colors.paper, ...PlayerColors.flatMap((c) => [c.piece, c.tint])]) {
      expect(contrast(Colors.ink, background)).toBeGreaterThanOrEqual(7);
    }
  });

  it('le texte secondaire reste lisible sur le fond et sur les teintes pâles', () => {
    for (const background of [Colors.paper, ...PlayerColors.map((c) => c.tint)]) {
      expect(contrast(Colors.inkSoft, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('le texte blanc sur fond noir (onglet choisi) est lisible', () => {
    expect(contrast(Colors.paper, Colors.ink)).toBeGreaterThanOrEqual(7);
  });

  it('les zones touchables font au moins 44 points', () => {
    expect(TouchTarget).toBeGreaterThanOrEqual(44);
  });
});

describe('police', () => {
  it('une seule famille, trois graisses au plus, toutes chargées', () => {
    const faces = Object.values(FontFaces);
    expect(faces.length).toBeLessThanOrEqual(3);
    expect(faces.every((face) => face.startsWith('Fredoka_'))).toBe(true);
    expect(Object.keys(FONT_FILES).sort()).toEqual([...faces].sort());
  });

  it('chaque style de texte utilise une graisse du thème, sans fontWeight (pas de faux gras)', () => {
    const families = Object.values(Fonts) as string[];
    for (const style of Object.values(Typography)) {
      expect(families).toContain(style.fontFamily);
      expect(style).not.toHaveProperty('fontWeight');
    }
  });

  it('garde des tailles lisibles', () => {
    expect(Typography.caption.fontSize).toBeGreaterThanOrEqual(13);
    expect(Typography.body.fontSize).toBeGreaterThanOrEqual(16);
  });
});
