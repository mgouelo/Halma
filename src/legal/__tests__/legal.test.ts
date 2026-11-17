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

  it('ne gardent que les champs à compléter connus (identité de l’éditeur, transferts), et indiquent la région Supabase', () => {
    const publisher = '[À COMPLÉTER : nom complet et statut de l’éditeur (particulier, entreprise…)]';
    expect(missingFields(PRIVACY)).toEqual([
      publisher,
      '[À COMPLÉTER : pays où Brevo et Cloudflare traitent les données, et garanties en cas de transfert hors de l’Union européenne]',
    ]);
    expect(missingFields(TERMS)).toEqual([publisher]);
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

  it('la politique dit qui peut ouvrir le profil public, et ce qu’il montre', () => {
    const body = text(PRIVACY);
    expect(body).toMatch(/Profil public : les autres joueurs connectés avec un compte e-mail peuvent ouvrir votre profil public/);
    expect(body).toMatch(/votre avatar, votre pseudo, vos points, votre rang, vos victoires et votre plus longue série de connexion, rien d’autre/);
  });
});
