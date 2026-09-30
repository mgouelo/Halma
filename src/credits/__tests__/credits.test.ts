import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from '@jest/globals';

import { CREDITS } from '../credits';

const root = join(__dirname, '../../..');

describe('crédits et licences', () => {
  it('reproduit la licence MIT complète de Humation, avec son avis de copyright', () => {
    const names = CREDITS.humation.packages.map((p) => p.name);
    expect(names).toEqual(['@humation/core', '@humation/assets-humation-1']);
    for (const pkg of CREDITS.humation.packages) {
      const original = readFileSync(join(root, 'node_modules', pkg.name, 'LICENSE.md'), 'utf8');
      expect(pkg.license).toBe('MIT');
      expect(pkg.copyright).toBe('Copyright (c) 2026 Humation contributors');
      expect(pkg.licenseText).toContain('Permission is hereby granted, free of charge');
      expect(pkg.licenseText).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
      // Texte intégral : seul le titre Markdown « # » est retiré.
      expect(pkg.licenseText).toBe(original.replace(/^#\s*/, '').trim());
    }
  });

  it('donne la licence SIL OFL de la police avec son avis de copyright', () => {
    expect(CREDITS.font.name).toBe('Fredoka');
    expect(CREDITS.font.license).toBe('OFL-1.1');
    expect(CREDITS.font.copyright).toMatch(/^Copyright 2016 The Fredoka Project Authors/);
    expect(CREDITS.font.licenseText).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('liste les principales bibliothèques, chacune avec sa licence complète', () => {
    const names = CREDITS.libraries.map((l) => l.name);
    for (const name of ['expo', 'react-native', '@supabase/supabase-js', 'react-native-svg', 'react-native-reanimated']) {
      expect(names).toContain(name);
    }
    for (const library of CREDITS.libraries) {
      expect(library.licenseText.length).toBeGreaterThan(200);
      expect(library.license).toBeTruthy();
    }
  });

  it('est à jour par rapport à node_modules (npm run licenses)', () => {
    expect(() =>
      execFileSync('node', [join(root, 'scripts/generate-licenses.mjs'), '--check'], { stdio: 'pipe' }),
    ).not.toThrow();
  });
});
