import { CONTACT_EMAIL } from './contact';
import type { LegalDocument } from './document';

// BROUILLON À FAIRE RELIRE (par une personne compétente en droit des données
// personnelles) avant toute publication. Les champs [À COMPLÉTER …] doivent
// être remplis ; ne rien inventer.

export const PRIVACY: LegalDocument = {
  title: 'Politique de confidentialité',
  version: '1er octobre 2026',
  draft: true,
  sections: [
    {
      title: 'Qui est responsable de vos données',
      paragraphs: [
        'Halma est édité par Matth.',
        `Pour toute question sur vos données : ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: 'Sans compte : rien ne quitte votre appareil',
      paragraphs: [
        'Les parties hors ligne (contre l’IA ou à deux sur le même appareil) se jouent entièrement sur votre appareil : aucune donnée n’est envoyée.',
      ],
    },
    {
      title: 'Les données que nous collectons',
      paragraphs: ['Seulement si vous créez un compte (e-mail ou invité) et jouez en ligne :'],
      bullets: [
        'Compte e-mail : votre adresse e-mail et votre mot de passe (conservé haché par notre hébergeur, jamais en clair). Compte invité : aucun e-mail, seulement un identifiant technique lié à votre appareil.',
        'Profil : votre pseudo, votre avatar (les choix faits dans l’éditeur) et la date de création du compte.',
        'Parties en ligne : les rooms que vous créez ou rejoignez (code, hôte, participants), l’état des parties et tous les coups joués, les abandons et forfaits.',
        'Signes de vie : tant qu’une room est ouverte, l’application envoie toutes les 10 secondes l’heure de votre dernier passage, pour savoir si vous êtes encore connecté (au bout de 2 minutes sans signe de vie, vous êtes déclaré forfait).',
        'Statistiques : nombre de victoires en ligne (par niveau d’IA), de parties lancées, et votre série de jours de connexion (le jour de votre dernière ouverture de l’application).',
        'Protection contre les abus : les codes de room inconnus que vous essayez (effacés après un jour).',
        'Journaux techniques de l’hébergeur (Supabase), qui peuvent contenir votre adresse IP, conservés par Supabase selon la durée prévue par son offre.',
      ],
    },
    {
      title: 'Ce que nous ne faisons pas',
      bullets: [
        'Pas de publicité, pas de revente de données.',
        'Pas d’outil de mesure d’audience ni de traceur publicitaire dans l’application.',
        'Pas d’accès à vos contacts, photos, micro, caméra ni position.',
      ],
    },
    {
      title: 'Qui voit quoi',
      bullets: [
        'Les autres joueurs connectés voient votre pseudo et votre avatar (salles d’attente, parties, classements).',
        'Les classements publics montrent votre pseudo, votre avatar, votre score et votre rang. Vos autres statistiques ne sont visibles que par vous (profil).',
        'Les joueurs d’une room voient ses participants, la partie et qui est connecté.',
        'Votre adresse e-mail n’est jamais montrée aux autres joueurs.',
      ],
    },
    {
      title: 'Où sont stockées vos données',
      paragraphs: [
        'Chez notre hébergeur Supabase (base de données Postgres et authentification), dans la région Irlande, au sein de l’Union européenne. Sur votre appareil, l’application garde seulement votre session (pour rester connecté).',
      ],
    },
    {
      title: 'Pourquoi et combien de temps',
      paragraphs: [
        'Ces données servent à faire fonctionner le jeu en ligne (comptes, parties, classements) et à le protéger contre les abus. Base légale : l’exécution du contrat (les conditions d’utilisation) pour les comptes et les parties, et notre intérêt légitime pour la protection contre les abus.',
        'Elles sont conservées tant que votre compte existe. Les rooms abandonnées sont effacées automatiquement (salles d’attente après 1 jour sans activité, parties après 7 jours, parties terminées après 30 jours).',
      ],
    },
    {
      title: 'Vos droits',
      bullets: [
        'Modifier votre pseudo et votre avatar : depuis votre profil.',
        'Supprimer votre compte et vos données : depuis votre profil, bouton « Supprimer mon compte ». C’est immédiat et définitif.',
        `Accès, rectification, opposition, portabilité : écrivez à ${CONTACT_EMAIL}.`,
        'Réclamation : auprès de la CNIL (cnil.fr) ou de l’autorité de votre pays.',
      ],
    },
    {
      title: 'Âge minimum',
      paragraphs: ['Il faut avoir au moins 15 ans pour créer un compte. En dessous de cet âge, l’accord d’un parent ou d’un représentant légal est nécessaire.'],
    },
  ],
};
