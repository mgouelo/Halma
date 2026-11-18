// Page publique « Supprimer mon compte » : Google Play exige une adresse web qui
// explique comment demander la suppression du compte et des données. Les
// étapes décrites ici sont celles de l'écran Profil (`profile.deleteAccount`) ;
// ce qui est supprimé ou conservé est ce que fait l'Edge Function
// `delete-account` (voir la migration `account_deletion_and_limits`).

import { CONTACT_EMAIL } from './contact';
import type { LegalDocument, LegalDocuments } from './document';

const fr: LegalDocument = {
  title: 'Supprimer mon compte Halma',
  description:
    'Comment supprimer votre compte Halma et vos données : depuis l’application en quelques touches, ou par e-mail.',
  version: '18 novembre 2026',
  sections: [
    {
      title: 'Depuis l’application (le plus rapide)',
      paragraphs: ['Halma, c’est le jeu de dames chinoises disponible sur Android et sur le site halma-game.com. Pour supprimer votre compte :'],
      bullets: [
        '1. Ouvrez Halma et connectez-vous (un compte invité se supprime de la même façon).',
        '2. Touchez votre avatar, en haut à droite, pour ouvrir votre profil.',
        '3. Touchez « Supprimer mon compte ».',
        '4. Confirmez avec « Oui, supprimer définitivement ».',
        'La suppression est immédiate et définitive.',
      ],
    },
    {
      title: 'Si vous ne pouvez plus ouvrir l’application',
      paragraphs: [
        `Écrivez à ${CONTACT_EMAIL} depuis l’adresse e-mail de votre compte, avec pour objet « Suppression de compte Halma » et votre pseudo. Nous supprimons le compte dans un délai maximal d’un mois. Un compte invité n’a pas d’adresse e-mail : il ne peut se supprimer que depuis l’application.`,
      ],
    },
    {
      title: 'Ce qui est supprimé',
      bullets: [
        'Votre adresse e-mail et votre mot de passe.',
        'Votre profil : pseudo, avatar et langue.',
        'Vos statistiques, vos victoires, vos points et votre place dans les classements.',
        'Vos amitiés et vos demandes d’ami, envoyées et reçues.',
        'Vos parties en cours (vous les abandonnez) et vos salles d’attente.',
      ],
    },
    {
      title: 'Ce qui est conservé',
      bullets: [
        'Dans les parties des autres joueurs, votre place reste sans aucun lien avec vous, indiquée « Compte supprimé » : elle est nécessaire pour que la partie continue.',
        'Les journaux techniques de l’hébergeur (Supabase), qui peuvent contenir votre adresse IP, restent conservés pour la durée prévue par son offre.',
        'Les e-mails de service déjà envoyés restent dans les journaux de Brevo pour la durée prévue par son offre.',
      ],
    },
    {
      title: 'Une question ?',
      paragraphs: [`Écrivez à ${CONTACT_EMAIL}. Le détail des données collectées est dans la politique de confidentialité.`],
    },
  ],
};

const en: LegalDocument = {
  title: 'Delete my Halma account',
  description: 'How to delete your Halma account and your data: from the app in a few taps, or by e-mail.',
  version: 'November 18, 2026',
  sections: [
    {
      title: 'From the app (fastest)',
      paragraphs: ['Halma is the Chinese checkers game available on Android and on halma-game.com. To delete your account:'],
      bullets: [
        '1. Open Halma and sign in (a guest account is deleted the same way).',
        '2. Tap your avatar, at the top right, to open your profile.',
        '3. Tap “Delete my account”.',
        '4. Confirm with “Yes, delete permanently”.',
        'Deletion is immediate and permanent.',
      ],
    },
    {
      title: 'If you can no longer open the app',
      paragraphs: [
        `Write to ${CONTACT_EMAIL} from the e-mail address of your account, with the subject “Halma account deletion” and your username. We delete the account within one month at most. A guest account has no e-mail address: it can only be deleted from the app.`,
      ],
    },
    {
      title: 'What is deleted',
      bullets: [
        'Your e-mail address and your password.',
        'Your profile: username, avatar and language.',
        'Your statistics, your wins, your points and your place on the leaderboards.',
        'Your friendships and your friend requests, sent and received.',
        'Your games in progress (you forfeit them) and your waiting rooms.',
      ],
    },
    {
      title: 'What is kept',
      bullets: [
        'In other players’ games, your seat remains with no link to you, shown as “Deleted account”: it is needed for the game to continue.',
        'The technical logs of the host (Supabase), which may contain your IP address, are kept for the period set by its plan.',
        'Service e-mails already sent remain in Brevo’s logs for the period set by its plan.',
      ],
    },
    {
      title: 'A question?',
      paragraphs: [`Write to ${CONTACT_EMAIL}. The details of the data we collect are in the privacy policy.`],
    },
  ],
};

const de: LegalDocument = {
  title: 'Mein Halma-Konto löschen',
  description: 'So löschen Sie Ihr Halma-Konto und Ihre Daten: in der App mit wenigen Fingertipps oder per E-Mail.',
  version: '18. November 2026',
  sections: [
    {
      title: 'In der App (am schnellsten)',
      paragraphs: ['Halma ist das Sternhalma-Spiel für Android und auf halma-game.com. So löschen Sie Ihr Konto:'],
      bullets: [
        '1. Öffnen Sie Halma und melden Sie sich an (ein Gastkonto wird genauso gelöscht).',
        '2. Tippen Sie oben rechts auf Ihren Avatar, um Ihr Profil zu öffnen.',
        '3. Tippen Sie auf „Mein Konto löschen“.',
        '4. Bestätigen Sie mit „Ja, endgültig löschen“.',
        'Das Löschen erfolgt sofort und endgültig.',
      ],
    },
    {
      title: 'Wenn Sie die App nicht mehr öffnen können',
      paragraphs: [
        `Schreiben Sie an ${CONTACT_EMAIL} von der E-Mail-Adresse Ihres Kontos, mit dem Betreff „Halma-Konto löschen“ und Ihrem Benutzernamen. Wir löschen das Konto spätestens innerhalb eines Monats. Ein Gastkonto hat keine E-Mail-Adresse: Es kann nur in der App gelöscht werden.`,
      ],
    },
    {
      title: 'Was gelöscht wird',
      bullets: [
        'Ihre E-Mail-Adresse und Ihr Passwort.',
        'Ihr Profil: Benutzername, Avatar und Sprache.',
        'Ihre Statistiken, Ihre Siege, Ihre Punkte und Ihr Platz in den Ranglisten.',
        'Ihre Freundschaften und Ihre Freundschaftsanfragen, gesendete und empfangene.',
        'Ihre laufenden Partien (Sie geben sie auf) und Ihre Wartezimmer.',
      ],
    },
    {
      title: 'Was aufbewahrt wird',
      bullets: [
        'In den Partien anderer Spieler bleibt Ihr Platz ohne jeden Bezug zu Ihnen erhalten, angezeigt als „Gelöschtes Konto“: Er wird gebraucht, damit die Partie weiterläuft.',
        'Die technischen Protokolle des Hosters (Supabase), die Ihre IP-Adresse enthalten können, werden für die in seinem Tarif vorgesehene Dauer aufbewahrt.',
        'Bereits gesendete Service-E-Mails bleiben für die in seinem Tarif vorgesehene Dauer in den Protokollen von Brevo.',
      ],
    },
    {
      title: 'Eine Frage?',
      paragraphs: [`Schreiben Sie an ${CONTACT_EMAIL}. Die Einzelheiten zu den erhobenen Daten stehen in der Datenschutzerklärung.`],
    },
  ],
};

const es: LegalDocument = {
  title: 'Eliminar mi cuenta de Halma',
  description:
    'Cómo eliminar su cuenta de Halma y sus datos: desde la aplicación con unos toques, o por correo electrónico.',
  version: '18 de noviembre de 2026',
  sections: [
    {
      title: 'Desde la aplicación (lo más rápido)',
      paragraphs: ['Halma es el juego de damas chinas disponible en Android y en halma-game.com. Para eliminar su cuenta:'],
      bullets: [
        '1. Abra Halma e inicie sesión (una cuenta de invitado se elimina de la misma forma).',
        '2. Toque su avatar, arriba a la derecha, para abrir su perfil.',
        '3. Toque «Eliminar mi cuenta».',
        '4. Confirme con «Sí, eliminar definitivamente».',
        'La eliminación es inmediata y definitiva.',
      ],
    },
    {
      title: 'Si ya no puede abrir la aplicación',
      paragraphs: [
        `Escriba a ${CONTACT_EMAIL} desde la dirección de correo de su cuenta, con el asunto «Eliminación de cuenta de Halma» y su nombre de usuario. Eliminamos la cuenta en un plazo máximo de un mes. Una cuenta de invitado no tiene correo electrónico: solo puede eliminarse desde la aplicación.`,
      ],
    },
    {
      title: 'Qué se elimina',
      bullets: [
        'Su dirección de correo electrónico y su contraseña.',
        'Su perfil: nombre de usuario, avatar e idioma.',
        'Sus estadísticas, sus victorias, sus puntos y su puesto en las clasificaciones.',
        'Sus amistades y sus solicitudes de amistad, enviadas y recibidas.',
        'Sus partidas en curso (las abandona) y sus salas de espera.',
      ],
    },
    {
      title: 'Qué se conserva',
      bullets: [
        'En las partidas de otros jugadores, su lugar permanece sin ningún vínculo con usted, indicado como «Cuenta eliminada»: es necesario para que la partida continúe.',
        'Los registros técnicos del alojamiento (Supabase), que pueden contener su dirección IP, se conservan durante el plazo previsto por su plan.',
        'Los correos de servicio ya enviados permanecen en los registros de Brevo durante el plazo previsto por su plan.',
      ],
    },
    {
      title: '¿Alguna pregunta?',
      paragraphs: [`Escriba a ${CONTACT_EMAIL}. El detalle de los datos que recogemos está en la política de privacidad.`],
    },
  ],
};

/** Page de suppression de compte dans chaque langue. */
export const DELETE_ACCOUNT_DOCS: LegalDocuments = { fr, en, de, es };

/** Version française (celle qui fait foi). */
export const DELETE_ACCOUNT = fr;
