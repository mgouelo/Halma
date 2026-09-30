import { describe, expect, it } from '@jest/globals';

import { CREDITS } from '@/credits/credits';

import { reflow } from '../doc-screen';

const words = (text: string) => text.split(/\s+/).filter(Boolean);

describe('mise en page des textes de licence', () => {
  it('recolle les lignes coupées mais garde les paragraphes', () => {
    expect(reflow('Copyright (c) X\n\nPermission is\nhereby granted,\n  free.\n\nTHE END')).toBe(
      'Copyright (c) X\n\nPermission is hereby granted, free.\n\nTHE END',
    );
  });

  it('ne perd ni n’ajoute aucun mot des licences affichées', () => {
    for (const entry of [...CREDITS.humation.packages, CREDITS.font, ...CREDITS.libraries]) {
      expect(words(reflow(entry.licenseText))).toEqual(words(entry.licenseText));
    }
  });
});
