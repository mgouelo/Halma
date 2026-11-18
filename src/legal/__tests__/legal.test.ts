import { describe, expect, it } from '@jest/globals';

import { LANGUAGES } from '@/i18n';

import { CONTACT_EMAIL } from '../contact';
import { documentText as text, type LegalDocuments } from '../document';
import { PRIVACY, PRIVACY_DOCS } from '../privacy';
import { TERMS, TERMS_DOCS } from '../terms';

describe('pages légales', () => {
  it('ne gardent aucune trace de brouillon : ni champ à compléter, ni mention de relecture', () => {
    for (const docs of [PRIVACY_DOCS, TERMS_DOCS]) {
      for (const language of LANGUAGES) {
        const doc = docs[language] as unknown as Record<string, unknown>;
        expect('draft' in doc).toBe(false);
        expect(text(docs[language])).not.toMatch(/\[[^\]]*(COMPLÉTER|COMPLETED|ERGÄNZEN|COMPLETAR)[^\]]*\]|brouillon|draft|Entwurf|borrador/i);
      }
    }
  });

  it('nomment le même éditeur partout, sans adresse postale, et indiquent la région Supabase', () => {
    for (const language of LANGUAGES) {
      expect(text(PRIVACY_DOCS[language])).toContain('Matthieu Gouélo');
      expect(text(TERMS_DOCS[language])).toContain('Matthieu Gouélo');
      expect(text(PRIVACY_DOCS[language]) + text(TERMS_DOCS[language])).not.toMatch(/fauvette|Bourgbarr|35230/);
    }
    expect(text(PRIVACY)).toMatch(/région Irlande, au sein de l’Union européenne/);
  });

  it('l’adresse de contact est celle du domaine du site', () => {
    expect(CONTACT_EMAIL).toBe('contact@halma-game.com');
  });

  it('la politique nomme les trois prestataires techniques et leur rôle', () => {
    const body = text(PRIVACY);
    expect(body).toMatch(/Supabase : hébergement des données/);
    expect(body).toMatch(/Brevo : envoi des e-mails/);
    expect(body).toMatch(/Cloudflare : hébergement du site halma-game\.com/);
    expect(body).toMatch(/réception des e-mails écrits à contact@halma-game\.com/);
  });

  it('ont une description pour la page web', () => {
    for (const doc of [PRIVACY, TERMS]) expect(doc.description.length).toBeGreaterThan(20);
  });

  it('donnent l’adresse de contact, sans inventer d’autre coordonnée (e-mail, téléphone)', () => {
    for (const doc of [PRIVACY, TERMS]) {
      const body = text(doc);
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

  it('la politique dit qui peut ouvrir le profil public, et ce qu’il montre', () => {
    const body = text(PRIVACY);
    expect(body).toMatch(/Profil public : les autres joueurs connectés avec un compte e-mail peuvent ouvrir votre profil public/);
    expect(body).toMatch(/votre avatar, votre pseudo, vos points, votre rang, vos victoires et votre plus longue série de connexion, rien d’autre/);
  });
});

describe('pages légales traduites (en, de, es)', () => {
  const sets: [string, LegalDocuments][] = [
    ['confidentialité', PRIVACY_DOCS],
    ['conditions', TERMS_DOCS],
  ];

  it.each(sets)('%s : une version par langue, le français est celui qui fait foi', (_name, docs) => {
    expect(Object.keys(docs).sort()).toEqual([...LANGUAGES].sort());
    expect(docs.fr === PRIVACY || docs.fr === TERMS).toBe(true);
  });

  it.each(sets)('%s : même structure qu’en français (sections, paragraphes, puces)', (_name, docs) => {
    const shape = (doc: LegalDocuments['fr']) =>
      doc.sections.map((s) => [s.paragraphs?.length ?? 0, s.bullets?.length ?? 0]);
    for (const language of LANGUAGES) {
      expect(shape(docs[language])).toEqual(shape(docs.fr));
      expect(docs[language].description.length).toBeGreaterThan(20);
    }
  });

  it.each(sets)('%s : même adresse de contact, aucune autre coordonnée inventée', (_name, docs) => {
    for (const language of LANGUAGES) {
      const body = text(docs[language]).replace(/\[[^\]]*\]/g, '');
      expect(body.split(CONTACT_EMAIL).length).toBe(text(docs.fr).replace(/\[[^\]]*\]/g, '').split(CONTACT_EMAIL).length);
      expect(body.split(CONTACT_EMAIL).join('')).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
      expect(body).not.toMatch(/\+?\d[\d .]{8,}\d/);
    }
  });

  it('la politique mentionne la langue du compte (nouvelle donnée, pour les e-mails)', () => {
    expect(text(PRIVACY)).toMatch(/la langue de l’application \(pour vous écrire les e-mails du compte dans cette langue\)/);
    expect(text(PRIVACY_DOCS.en)).toMatch(/the language of the app/);
  });
});

