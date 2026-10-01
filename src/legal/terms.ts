import { CONTACT_EMAIL } from './contact';
import type { LegalDocument } from './document';

// BROUILLON À FAIRE RELIRE avant toute publication. Les champs
// [À COMPLÉTER …] doivent être remplis ; ne rien inventer.

export const TERMS: LegalDocument = {
  title: 'Conditions d’utilisation',
  version: '1er octobre 2026',
  draft: true,
  sections: [
    {
      title: 'Le service',
      paragraphs: [
        'Halma est un jeu de dames chinoises édité par Matth. On peut y jouer hors ligne sans compte, ou en ligne avec un compte e-mail ou invité. Le jeu est gratuit.',
        'En créant un compte, vous acceptez ces conditions.',
      ],
    },
    {
      title: 'Votre compte',
      bullets: [
        'Un compte invité n’existe que sur votre appareil : après une déconnexion, il ne peut pas être retrouvé.',
        'Vous êtes responsable de votre mot de passe.',
        'Vous pouvez supprimer votre compte à tout moment depuis votre profil.',
      ],
    },
    {
      title: 'Règles de conduite',
      bullets: [
        'Choisissez un pseudo et un avatar respectueux : pas d’insulte, de propos haineux ni d’usurpation d’identité.',
        'Pas de tentative de perturber le service ou de contourner ses protections.',
        `Nous pouvons supprimer un compte qui ne respecte pas ces règles. Vous pouvez contester cette décision en écrivant à ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: 'Classements',
      paragraphs: [
        'Les classements sont donnés pour le plaisir, sans récompense. Seules les parties en ligne comptent. Ils ne sont pas protégés contre toutes les formes de triche ; nous pouvons les corriger ou les remettre à zéro.',
      ],
    },
    {
      title: 'Disponibilité',
      paragraphs: [
        'Le jeu en ligne est fourni tel quel, sans garantie de disponibilité. Une partie peut être interrompue (panne, maintenance) ; les rooms abandonnées sont effacées automatiquement.',
      ],
    },
    {
      title: 'Propriété intellectuelle',
      paragraphs: [
        'L’application utilise des projets libres (avatars Humation, police Fredoka, bibliothèques open source), chacun sous sa propre licence : voir « Crédits et licences ».',
      ],
    },
    {
      title: 'Données personnelles',
      paragraphs: ['Voir la politique de confidentialité.'],
    },
    {
      title: 'Modification des conditions',
      paragraphs: ['La date de version ci-dessus indique la dernière mise à jour de ces conditions. Nous vous invitons à consulter régulièrement cette page.'],
    },
    {
      title: 'Droit applicable et contact',
      paragraphs: [
        'Droit applicable : droit français. En cas de litige, les tribunaux français sont compétents, sans préjudice des droits dont vous disposez en tant que consommateur.',
        `Contact : ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};
