import { describe, expect, it } from '@jest/globals';

import { missingFields } from '../document';
import { PRIVACY } from '../privacy';
import { TERMS } from '../terms';

const text = (doc: typeof PRIVACY) =>
  doc.sections.flatMap((s) => [s.title, ...(s.paragraphs ?? []), ...(s.bullets ?? [])]).join('\n');

describe('pages légales', () => {
  it('sont marquées comme brouillons, avec les champs à compléter visibles', () => {
    for (const doc of [PRIVACY, TERMS]) {
      expect(doc.draft).toBe(true);
      expect(missingFields(doc)).toContain('[À COMPLÉTER : adresse e-mail de contact]');
    }
  });

  it('n’inventent aucune coordonnée (ni e-mail, ni téléphone, ni adresse web de contact)', () => {
    for (const doc of [PRIVACY, TERMS]) {
      const body = text(doc).replace(/\[À COMPLÉTER[^\]]*\]/g, '');
      expect(body).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
      expect(body).not.toMatch(/\+?\d[\d .]{8,}\d/);
    }
  });

  it('la politique décrit chaque donnée collectée et où elle est stockée', () => {
    const body = text(PRIVACY);
    for (const word of ['e-mail', 'pseudo', 'avatar', 'Statistiques', 'Parties en ligne', 'Signes de vie', 'Supabase']) {
      expect(body).toContain(word);
    }
    expect(body).toMatch(/Supprimer mon compte/);
  });
});
