import { describe, expect, it } from '@jest/globals';

import { CONTACT_EMAIL } from '../contact';
import { missingFields } from '../document';
import { PRIVACY } from '../privacy';
import { TERMS } from '../terms';

const text = (doc: typeof PRIVACY) =>
  doc.sections.flatMap((s) => [s.title, ...(s.paragraphs ?? []), ...(s.bullets ?? [])]).join('\n');

describe('pages légales', () => {
  it('sont marquées comme brouillons à faire relire', () => {
    for (const doc of [PRIVACY, TERMS]) expect(doc.draft).toBe(true);
  });

  it('n’ont plus de champ à compléter, et indiquent la région Supabase (Irlande, UE)', () => {
    expect(missingFields(PRIVACY)).toHaveLength(0);
    expect(missingFields(TERMS)).toHaveLength(0);
    expect(text(PRIVACY)).toMatch(/région Irlande, au sein de l’Union européenne/);
  });

  it('donnent l’adresse de contact, sans inventer d’autre coordonnée (e-mail, téléphone)', () => {
    for (const doc of [PRIVACY, TERMS]) {
      const body = text(doc).replace(/\[À COMPLÉTER[^\]]*\]/g, '');
      expect(body).toContain(CONTACT_EMAIL);
      expect(body.split(CONTACT_EMAIL).join('')).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
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
