import { CONTACT_EMAIL } from './contact';
import type { LegalDocument } from './document';

// BROUILLON À FAIRE RELIRE avant toute publication. Les champs
// [À COMPLÉTER …] doivent être remplis ; ne rien inventer.

export const TERMS: LegalDocument = {
  title: 'Conditions d’utilisation',
  version: '[À COMPLÉTER : date de la version]',
  draft: true,
  sections: [
    {
      title: 'Le service',
      paragraphs: [
        'Halma est un jeu de dames chinoises édité par [À COMPLÉTER : nom ou raison sociale de l’éditeur]. On peut y jouer hors ligne sans compte, ou en ligne avec un compte e-mail ou invité. Le jeu est gratuit.',
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
        'Nous pouvons supprimer un compte qui ne respecte pas ces règles : [À COMPLÉTER : procédure et moyen de contestation].',
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
      paragraphs: ['[À COMPLÉTER : comment les utilisateurs sont prévenus d’un changement de ces conditions].'],
    },
    {
      title: 'Droit applicable et contact',
      paragraphs: [
        'Droit applicable : [À COMPLÉTER : droit applicable et tribunaux compétents].',
        `Contact : ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};
