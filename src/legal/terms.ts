import { CONTACT_EMAIL } from './contact';
import type { LegalDocument, LegalDocuments } from './document';

const fr: LegalDocument = {
  title: 'Conditions d’utilisation',
  description: 'Conditions d’utilisation du jeu Halma : le service, votre compte, les règles de conduite et le contact.',
  version: '18 novembre 2026',
  sections: [
    {
      title: 'Le service',
      paragraphs: [
        'Halma est un jeu de dames chinoises édité par Matthieu Gouélo, éditeur à titre non professionnel (particulier). On peut y jouer hors ligne sans compte, ou en ligne avec un compte e-mail ou invité. Le jeu est gratuit.',
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
      paragraphs: [
        'La date de version ci-dessus indique la dernière mise à jour de ces conditions. Nous vous invitons à consulter régulièrement cette page.',
      ],
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

const en: LegalDocument = {
  title: 'Terms of use',
  description: 'Terms of use of the Halma game: the service, your account, the rules of conduct and contact.',
  version: 'November 18, 2026',
  sections: [
    {
      title: 'The service',
      paragraphs: [
        'Halma is a Chinese checkers game published by Matthieu Gouélo, a non-professional publisher (individual). It can be played offline without an account, or online with an email or guest account. The game is free.',
        'By creating an account, you accept these terms.',
      ],
    },
    {
      title: 'Your account',
      bullets: [
        'A guest account only exists on your device: after signing out, it cannot be recovered.',
        'You are responsible for your password.',
        'You can delete your account at any time from your profile.',
      ],
    },
    {
      title: 'Rules of conduct',
      bullets: [
        'Choose a respectful username and avatar: no insults, hateful remarks or impersonation.',
        'No attempts to disrupt the service or to get around its protections.',
        `We may delete an account that does not comply with these rules. You can contest this decision by writing to ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: 'Leaderboards',
      paragraphs: [
        'Leaderboards are provided for fun, with no reward. Only online games count. They are not protected against every form of cheating; we may correct them or reset them.',
      ],
    },
    {
      title: 'Availability',
      paragraphs: [
        'The online game is provided as is, with no guarantee of availability. A game may be interrupted (outage, maintenance); abandoned rooms are deleted automatically.',
      ],
    },
    {
      title: 'Intellectual property',
      paragraphs: [
        'The app uses free and open source projects (Humation avatars, Fredoka font, open source libraries), each under its own license: see “Credits and licenses”.',
      ],
    },
    {
      title: 'Personal data',
      paragraphs: ['See the privacy policy.'],
    },
    {
      title: 'Changes to the terms',
      paragraphs: [
        'The version date above indicates the last update of these terms. We invite you to consult this page regularly.',
      ],
    },
    {
      title: 'Applicable law and contact',
      paragraphs: [
        'Applicable law: French law. In the event of a dispute, the French courts have jurisdiction, without prejudice to the rights you have as a consumer.',
        `Contact: ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

const de: LegalDocument = {
  title: 'Nutzungsbedingungen',
  description: 'Nutzungsbedingungen des Spiels Halma: der Dienst, Ihr Konto, die Verhaltensregeln und der Kontakt.',
  version: '18. November 2026',
  sections: [
    {
      title: 'Der Dienst',
      paragraphs: [
        'Halma ist ein Sternhalma-Spiel (chinesisches Halma), herausgegeben von Matthieu Gouélo, einem nicht gewerblichen Herausgeber (Privatperson). Man kann es offline ohne Konto spielen oder online mit einem E-Mail- oder Gastkonto. Das Spiel ist kostenlos.',
        'Mit der Erstellung eines Kontos akzeptieren Sie diese Bedingungen.',
      ],
    },
    {
      title: 'Ihr Konto',
      bullets: [
        'Ein Gastkonto existiert nur auf Ihrem Gerät: Nach einer Abmeldung kann es nicht wiederhergestellt werden.',
        'Sie sind für Ihr Passwort verantwortlich.',
        'Sie können Ihr Konto jederzeit in Ihrem Profil löschen.',
      ],
    },
    {
      title: 'Verhaltensregeln',
      bullets: [
        'Wählen Sie einen respektvollen Benutzernamen und Avatar: keine Beleidigungen, keine Hassrede und kein Identitätsmissbrauch.',
        'Keine Versuche, den Dienst zu stören oder seine Schutzmaßnahmen zu umgehen.',
        `Wir können ein Konto löschen, das diese Regeln nicht einhält. Sie können dieser Entscheidung widersprechen, indem Sie an ${CONTACT_EMAIL} schreiben.`,
      ],
    },
    {
      title: 'Ranglisten',
      paragraphs: [
        'Die Ranglisten dienen dem Spaß und sind mit keiner Belohnung verbunden. Nur Online-Partien zählen. Sie sind nicht gegen jede Form von Betrug geschützt; wir können sie korrigieren oder zurücksetzen.',
      ],
    },
    {
      title: 'Verfügbarkeit',
      paragraphs: [
        'Das Online-Spiel wird ohne Mängelgewähr und ohne Garantie der Verfügbarkeit bereitgestellt. Eine Partie kann unterbrochen werden (Ausfall, Wartung); verlassene Räume werden automatisch gelöscht.',
      ],
    },
    {
      title: 'Geistiges Eigentum',
      paragraphs: [
        'Die App verwendet freie Projekte (Humation-Avatare, Schriftart Fredoka, Open-Source-Bibliotheken), jeweils unter ihrer eigenen Lizenz: siehe „Credits und Lizenzen“.',
      ],
    },
    {
      title: 'Personenbezogene Daten',
      paragraphs: ['Siehe die Datenschutzerklärung.'],
    },
    {
      title: 'Änderung der Bedingungen',
      paragraphs: [
        'Das oben angegebene Versionsdatum zeigt die letzte Aktualisierung dieser Bedingungen an. Wir empfehlen Ihnen, diese Seite regelmäßig aufzurufen.',
      ],
    },
    {
      title: 'Anwendbares Recht und Kontakt',
      paragraphs: [
        'Anwendbares Recht: französisches Recht. Bei Streitigkeiten sind die französischen Gerichte zuständig, unbeschadet der Rechte, die Ihnen als Verbraucherin oder Verbraucher zustehen.',
        `Kontakt: ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

const es: LegalDocument = {
  title: 'Condiciones de uso',
  description: 'Condiciones de uso del juego Halma: el servicio, su cuenta, las normas de conducta y el contacto.',
  version: '18 de noviembre de 2026',
  sections: [
    {
      title: 'El servicio',
      paragraphs: [
        'Halma es un juego de damas chinas editado por Matthieu Gouélo, editor a título no profesional (particular). Se puede jugar sin conexión y sin cuenta, o en línea con una cuenta de correo electrónico o de invitado. El juego es gratuito.',
        'Al crear una cuenta, usted acepta estas condiciones.',
      ],
    },
    {
      title: 'Su cuenta',
      bullets: [
        'Una cuenta de invitado solo existe en su dispositivo: tras cerrar la sesión, no se puede recuperar.',
        'Usted es responsable de su contraseña.',
        'Puede eliminar su cuenta en cualquier momento desde su perfil.',
      ],
    },
    {
      title: 'Normas de conducta',
      bullets: [
        'Elija un nombre de usuario y un avatar respetuosos: nada de insultos, mensajes de odio ni suplantación de identidad.',
        'Nada de intentos de perturbar el servicio o de eludir sus protecciones.',
        `Podemos eliminar una cuenta que no respete estas normas. Puede impugnar esta decisión escribiendo a ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: 'Clasificaciones',
      paragraphs: [
        'Las clasificaciones se ofrecen por diversión, sin recompensa. Solo cuentan las partidas en línea. No están protegidas contra todas las formas de trampa; podemos corregirlas o ponerlas a cero.',
      ],
    },
    {
      title: 'Disponibilidad',
      paragraphs: [
        'El juego en línea se ofrece tal cual, sin garantía de disponibilidad. Una partida puede interrumpirse (avería, mantenimiento); las salas abandonadas se borran automáticamente.',
      ],
    },
    {
      title: 'Propiedad intelectual',
      paragraphs: [
        'La aplicación utiliza proyectos libres (avatares Humation, fuente Fredoka, bibliotecas de código abierto), cada uno bajo su propia licencia: véase «Créditos y licencias».',
      ],
    },
    {
      title: 'Datos personales',
      paragraphs: ['Véase la política de privacidad.'],
    },
    {
      title: 'Modificación de las condiciones',
      paragraphs: [
        'La fecha de versión indicada arriba muestra la última actualización de estas condiciones. Le invitamos a consultar esta página con regularidad.',
      ],
    },
    {
      title: 'Derecho aplicable y contacto',
      paragraphs: [
        'Derecho aplicable: derecho francés. En caso de litigio, serán competentes los tribunales franceses, sin perjuicio de los derechos de los que usted disponga como consumidor.',
        `Contacto: ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

/** Conditions d'utilisation dans chaque langue. */
export const TERMS_DOCS: LegalDocuments = { fr, en, de, es };

/** Version française (celle qui fait foi). */
export const TERMS = fr;
