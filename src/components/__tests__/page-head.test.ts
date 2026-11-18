import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { pageTitle, SITE_DESCRIPTION, SITE_NAME } from '../page-head';

describe('titre et description des pages web', () => {
  it('titre de l’onglet : page puis nom du site', () => {
    expect(pageTitle('Politique de confidentialité')).toBe('Politique de confidentialité · Halma');
    expect(pageTitle()).toBe(SITE_NAME);
    expect(pageTitle(SITE_NAME)).toBe(SITE_NAME);
  });

  it('la description par défaut (française, rendu statique) est celle de app.json', () => {
    const app = JSON.parse(readFileSync(join(__dirname, '../../../app.json'), 'utf8'));
    expect(app.expo.web.description.replace(/'/g, '’')).toBe(SITE_DESCRIPTION);
  });
});
