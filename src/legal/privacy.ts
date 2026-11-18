import { CONTACT_EMAIL, SITE_DOMAIN } from './contact';
import type { LegalDocument, LegalDocuments } from './document';

const fr: LegalDocument = {
  title: 'Politique de confidentialité',
  description:
    'Politique de confidentialité de Halma : données collectées, prestataires techniques, durées de conservation et vos droits.',
  version: '18 novembre 2026',
  sections: [
    {
      title: 'Qui est responsable de vos données',
      paragraphs: [
        'Halma est édité par Matthieu Gouélo, éditeur à titre non professionnel (particulier), qui est aussi le responsable du traitement de vos données.',
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
        'Profil : votre pseudo, votre avatar (les choix faits dans l’éditeur), la langue de l’application (pour vous écrire les e-mails du compte dans cette langue), la date de création du compte et celle du dernier changement de pseudo.',
        'Parties en ligne : les rooms que vous créez ou rejoignez (code, hôte, participants), l’état des parties et tous les coups joués, les abandons et forfaits.',
        'Signes de vie : tant qu’une room est ouverte, l’application envoie toutes les 10 secondes l’heure de votre dernier passage, pour savoir si vous êtes encore connecté (au bout de 2 minutes sans signe de vie, vous êtes déclaré forfait).',
        'Statistiques : nombre de victoires en ligne (par niveau d’IA), de parties lancées, et votre série de jours de connexion (le jour de votre dernière ouverture de l’application).',
        'Amis (comptes e-mail seulement) : vos amitiés (avec qui, et depuis quand), les demandes d’ami envoyées et reçues en attente (expéditeur, destinataire, date), et la date du dernier refus d’une demande (pour imposer un délai de 24 heures avant de redemander la même personne).',
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
        'Les classements publics montrent votre pseudo, votre avatar, votre score et votre rang.',
        'Profil public : les autres joueurs connectés avec un compte e-mail peuvent ouvrir votre profil public (en touchant votre ligne dans les classements, dans leur liste d’amis ou dans leurs demandes d’ami reçues) : votre avatar, votre pseudo, vos points, votre rang, vos victoires et votre plus longue série de connexion, rien d’autre. Ils y voient aussi si vous êtes amis ou si une demande d’ami est en attente entre vous. Les invités ne peuvent pas l’ouvrir. Vos autres statistiques (parties lancées, série actuelle) ne sont visibles que par vous (profil).',
        'Les joueurs d’une room voient ses participants, la partie et qui est connecté.',
        'Amis : on ne peut vous ajouter qu’en connaissant votre pseudo exact (il n’existe pas de liste de tous les joueurs). La personne à qui vous envoyez une demande voit votre pseudo, votre avatar et la date de la demande. Vos amis voient votre pseudo, votre avatar, vos points et votre rang au classement des points, rien d’autre. Un refus n’est pas notifié à l’expéditeur ; s’il réessaie dans les 24 heures, l’application lui indique que sa demande a été refusée.',
        'Votre adresse e-mail et la langue de votre compte ne sont jamais montrées aux autres joueurs.',
      ],
    },
    {
      title: 'Où sont stockées vos données',
      paragraphs: [
        'Chez notre hébergeur Supabase (base de données Postgres et authentification), dans la région Irlande, au sein de l’Union européenne. Sur votre appareil (ou dans votre navigateur, sur le site), l’application garde seulement votre session (pour rester connecté) et la langue choisie.',
      ],
    },
    {
      title: 'Nos prestataires techniques',
      paragraphs: ['Trois prestataires traitent des données pour faire fonctionner le service :'],
      bullets: [
        'Supabase : hébergement des données et des comptes (voir ci-dessus).',
        'Brevo : envoi des e-mails du service (validation du compte, changement d’adresse, mot de passe oublié). Brevo reçoit votre adresse e-mail et le contenu de ces messages.',
        `Cloudflare : hébergement du site ${SITE_DOMAIN} (qui traite l’adresse IP de ses visiteurs pour afficher les pages) et réception des e-mails écrits à ${CONTACT_EMAIL}, transférés vers la boîte du projet.`,
        'Brevo stocke les données principalement dans l’Union européenne ; les transferts hors UE sont sécurisés par le Data Privacy Framework et des clauses contractuelles types. Cloudflare traite les données (IP) mondialement, notamment aux États-Unis, sous le couvert de sa certification EU-US Data Privacy Framework.',
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
        'Modifier votre pseudo, votre avatar et la langue : depuis votre profil.',
        'Retirer un ami ou refuser une demande : depuis l’écran Amis.',
        'Supprimer votre compte et vos données : depuis votre profil, bouton « Supprimer mon compte ». C’est immédiat et définitif, amitiés et demandes d’ami comprises.',
        `Accès, rectification, opposition, portabilité : écrivez à ${CONTACT_EMAIL}.`,
        'Réclamation : auprès de la CNIL (cnil.fr) ou de l’autorité de votre pays.',
      ],
    },
    {
      title: 'Âge minimum',
      paragraphs: [
        'Il faut avoir au moins 15 ans pour créer un compte. En dessous de cet âge, l’accord d’un parent ou d’un représentant légal est nécessaire.',
      ],
    },
  ],
};

const en: LegalDocument = {
  title: 'Privacy policy',
  description:
    'Halma’s privacy policy: data collected, technical service providers, retention periods and your rights.',
  version: 'November 18, 2026',
  sections: [
    {
      title: 'Who is responsible for your data',
      paragraphs: [
        'Halma is published by Matthieu Gouélo, a non-professional publisher (individual), who is also the controller of your data.',
        `For any question about your data: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: 'Without an account: nothing leaves your device',
      paragraphs: [
        'Offline games (against the AI or with two people on the same device) are played entirely on your device: no data is sent.',
      ],
    },
    {
      title: 'The data we collect',
      paragraphs: ['Only if you create an account (email or guest) and play online:'],
      bullets: [
        'Email account: your email address and your password (stored hashed by our hosting provider, never in plain text). Guest account: no email, only a technical identifier linked to your device.',
        'Profile: your username, your avatar (the choices made in the editor), the language of the app (to write your account emails in that language), the date the account was created and the date of the last username change.',
        'Online games: the rooms you create or join (code, host, participants), the state of the games and every move played, resignations and forfeits.',
        'Signs of life: while a room is open, the app sends the time you were last active every 10 seconds, to know whether you are still connected (after 2 minutes without a sign of life, you are declared to have forfeited).',
        'Statistics: number of online wins (by AI level), of games started, and your streak of login days (the day you last opened the app).',
        'Friends (email accounts only): your friendships (with whom, and since when), pending friend requests sent and received (sender, recipient, date), and the date a request was last refused (to impose a 24-hour delay before asking the same person again).',
        'Protection against abuse: the unknown room codes you try (deleted after one day).',
        'Technical logs of the hosting provider (Supabase), which may contain your IP address, kept by Supabase for the period set out in its plan.',
      ],
    },
    {
      title: 'What we do not do',
      bullets: [
        'No advertising, no resale of data.',
        'No audience measurement tool or advertising tracker in the app.',
        'No access to your contacts, photos, microphone, camera or location.',
      ],
    },
    {
      title: 'Who sees what',
      bullets: [
        'Other signed-in players see your username and your avatar (waiting rooms, games, leaderboards).',
        'Public leaderboards show your username, your avatar, your score and your rank.',
        'Public profile: other players signed in with an email account can open your public profile (by tapping your row in the leaderboards, in their friends list or in the friend requests they have received): your avatar, your username, your points, your rank, your wins and your longest login streak, nothing else. They also see there whether you are friends or whether a friend request is pending between you. Guests cannot open it. Your other statistics (games started, current streak) are only visible to you (profile).',
        'The players in a room see its participants, the game and who is connected.',
        'Friends: you can only be added by someone who knows your exact username (there is no list of all players). The person you send a request to sees your username, your avatar and the date of the request. Your friends see your username, your avatar, your points and your rank in the points leaderboard, nothing else. A refusal is not notified to the sender; if they try again within 24 hours, the app tells them that their request was refused.',
        'Your email address and the language of your account are never shown to other players.',
      ],
    },
    {
      title: 'Where your data is stored',
      paragraphs: [
        'With our hosting provider Supabase (Postgres database and authentication), in the Ireland region, within the European Union. On your device (or in your browser, on the website), the app only keeps your session (to stay signed in) and the language you chose.',
      ],
    },
    {
      title: 'Our technical service providers',
      paragraphs: ['Three service providers process data to run the service:'],
      bullets: [
        'Supabase: hosting of data and accounts (see above).',
        'Brevo: sending the service’s emails (account confirmation, change of address, forgotten password). Brevo receives your email address and the content of these messages.',
        `Cloudflare: hosting of the website ${SITE_DOMAIN} (which processes the IP address of its visitors to display the pages) and reception of emails written to ${CONTACT_EMAIL}, forwarded to the project’s mailbox.`,
        'Brevo stores data mainly within the European Union; transfers outside the EU are secured by the Data Privacy Framework and standard contractual clauses. Cloudflare processes data (IP addresses) worldwide, notably in the United States, under its EU-US Data Privacy Framework certification.',
      ],
    },
    {
      title: 'Why and for how long',
      paragraphs: [
        'This data is used to run the online game (accounts, games, leaderboards) and to protect it against abuse. Legal basis: performance of the contract (the terms of use) for accounts and games, and our legitimate interest for protection against abuse.',
        'It is kept as long as your account exists. Abandoned rooms are deleted automatically (waiting rooms after 1 day without activity, games after 7 days, finished games after 30 days).',
      ],
    },
    {
      title: 'Your rights',
      bullets: [
        'Change your username, your avatar and the language: from your profile.',
        'Remove a friend or refuse a request: from the Friends screen.',
        'Delete your account and your data: from your profile, “Delete my account” button. It is immediate and permanent, friendships and friend requests included.',
        `Access, rectification, objection, portability: write to ${CONTACT_EMAIL}.`,
        'Complaint: to the CNIL (cnil.fr) or to the authority of your country.',
      ],
    },
    {
      title: 'Minimum age',
      paragraphs: [
        'You must be at least 15 years old to create an account. Below this age, the consent of a parent or legal guardian is required.',
      ],
    },
  ],
};

const de: LegalDocument = {
  title: 'Datenschutzerklärung',
  description:
    'Datenschutzerklärung von Halma: erhobene Daten, technische Dienstleister, Speicherdauer und Ihre Rechte.',
  version: '18. November 2026',
  sections: [
    {
      title: 'Wer für Ihre Daten verantwortlich ist',
      paragraphs: [
        'Halma wird von Matthieu Gouélo herausgegeben, einem nicht gewerblichen Herausgeber (Privatperson), der auch der Verantwortliche für die Verarbeitung Ihrer Daten ist.',
        `Bei Fragen zu Ihren Daten: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: 'Ohne Konto: nichts verlässt Ihr Gerät',
      paragraphs: [
        'Offline-Partien (gegen die KI oder zu zweit auf demselben Gerät) werden vollständig auf Ihrem Gerät gespielt: Es werden keine Daten gesendet.',
      ],
    },
    {
      title: 'Welche Daten wir erheben',
      paragraphs: ['Nur wenn Sie ein Konto (E-Mail oder Gast) erstellen und online spielen:'],
      bullets: [
        'E-Mail-Konto: Ihre E-Mail-Adresse und Ihr Passwort (von unserem Hoster gehasht gespeichert, nie im Klartext). Gastkonto: keine E-Mail, nur eine technische Kennung, die an Ihr Gerät gebunden ist.',
        'Profil: Ihr Benutzername, Ihr Avatar (die im Editor getroffene Auswahl), die Sprache der App (um Ihnen die E-Mails zum Konto in dieser Sprache zu schreiben), das Erstellungsdatum des Kontos und das Datum der letzten Änderung des Benutzernamens.',
        'Online-Partien: die Räume, die Sie erstellen oder denen Sie beitreten (Code, Gastgeber, Teilnehmende), der Stand der Partien und alle gespielten Züge, Aufgaben und Ausscheiden wegen Abwesenheit.',
        'Lebenszeichen: Solange ein Raum geöffnet ist, sendet die App alle 10 Sekunden den Zeitpunkt Ihrer letzten Aktivität, um festzustellen, ob Sie noch verbunden sind (nach 2 Minuten ohne Lebenszeichen scheiden Sie wegen Abwesenheit aus).',
        'Statistiken: Anzahl der Online-Siege (nach KI-Stufe), der gestarteten Partien und Ihre Serie von Anmeldetagen (der Tag, an dem Sie die App zuletzt geöffnet haben).',
        'Freunde (nur E-Mail-Konten): Ihre Freundschaften (mit wem und seit wann), ausstehende gesendete und empfangene Freundschaftsanfragen (Absender, Empfänger, Datum) sowie das Datum der letzten Ablehnung einer Anfrage (um eine Wartezeit von 24 Stunden durchzusetzen, bevor dieselbe Person erneut angefragt werden kann).',
        'Schutz vor Missbrauch: die unbekannten Raumcodes, die Sie ausprobieren (nach einem Tag gelöscht).',
        'Technische Protokolle des Hosters (Supabase), die Ihre IP-Adresse enthalten können und von Supabase für die in seinem Tarif vorgesehene Dauer aufbewahrt werden.',
      ],
    },
    {
      title: 'Was wir nicht tun',
      bullets: [
        'Keine Werbung, kein Weiterverkauf von Daten.',
        'Kein Tool zur Reichweitenmessung und kein Werbe-Tracker in der App.',
        'Kein Zugriff auf Ihre Kontakte, Fotos, Ihr Mikrofon, Ihre Kamera oder Ihren Standort.',
      ],
    },
    {
      title: 'Wer was sieht',
      bullets: [
        'Andere angemeldete Spielerinnen und Spieler sehen Ihren Benutzernamen und Ihren Avatar (Warteräume, Partien, Ranglisten).',
        'Die öffentlichen Ranglisten zeigen Ihren Benutzernamen, Ihren Avatar, Ihre Punktzahl und Ihren Rang.',
        'Öffentliches Profil: Andere mit einem E-Mail-Konto angemeldete Spielerinnen und Spieler können Ihr öffentliches Profil öffnen (indem sie Ihre Zeile in den Ranglisten, in ihrer Freundesliste oder in ihren empfangenen Freundschaftsanfragen antippen): Ihren Avatar, Ihren Benutzernamen, Ihre Punkte, Ihren Rang, Ihre Siege und Ihre längste Anmeldeserie, sonst nichts. Dort sehen sie auch, ob Sie befreundet sind oder ob zwischen Ihnen eine Freundschaftsanfrage aussteht. Gäste können es nicht öffnen. Ihre übrigen Statistiken (gestartete Partien, aktuelle Serie) sind nur für Sie sichtbar (Profil).',
        'Die Spielerinnen und Spieler eines Raums sehen dessen Teilnehmende, die Partie und wer verbunden ist.',
        'Freunde: Man kann Sie nur hinzufügen, wenn man Ihren genauen Benutzernamen kennt (es gibt keine Liste aller Spielerinnen und Spieler). Die Person, an die Sie eine Anfrage senden, sieht Ihren Benutzernamen, Ihren Avatar und das Datum der Anfrage. Ihre Freunde sehen Ihren Benutzernamen, Ihren Avatar, Ihre Punkte und Ihren Rang in der Punkte-Rangliste, sonst nichts. Eine Ablehnung wird dem Absender nicht mitgeteilt; versucht er es innerhalb von 24 Stunden erneut, teilt ihm die App mit, dass seine Anfrage abgelehnt wurde.',
        'Ihre E-Mail-Adresse und die Sprache Ihres Kontos werden anderen Spielerinnen und Spielern nie angezeigt.',
      ],
    },
    {
      title: 'Wo Ihre Daten gespeichert werden',
      paragraphs: [
        'Bei unserem Hoster Supabase (Postgres-Datenbank und Authentifizierung), in der Region Irland, innerhalb der Europäischen Union. Auf Ihrem Gerät (oder in Ihrem Browser, auf der Website) speichert die App nur Ihre Sitzung (um angemeldet zu bleiben) und die gewählte Sprache.',
      ],
    },
    {
      title: 'Unsere technischen Dienstleister',
      paragraphs: ['Drei Dienstleister verarbeiten Daten, um den Dienst zu betreiben:'],
      bullets: [
        'Supabase: Hosting der Daten und Konten (siehe oben).',
        'Brevo: Versand der E-Mails des Dienstes (Bestätigung des Kontos, Änderung der Adresse, vergessenes Passwort). Brevo erhält Ihre E-Mail-Adresse und den Inhalt dieser Nachrichten.',
        `Cloudflare: Hosting der Website ${SITE_DOMAIN} (die die IP-Adresse ihrer Besucher verarbeitet, um die Seiten anzuzeigen) und Empfang der an ${CONTACT_EMAIL} geschriebenen E-Mails, die an das Postfach des Projekts weitergeleitet werden.`,
        'Brevo speichert Daten hauptsächlich innerhalb der Europäischen Union; Übermittlungen außerhalb der EU werden durch das Data Privacy Framework und Standardvertragsklauseln abgesichert. Cloudflare verarbeitet Daten (IP-Adressen) weltweit, insbesondere in den Vereinigten Staaten, auf Grundlage seiner Zertifizierung im EU-US Data Privacy Framework.',
      ],
    },
    {
      title: 'Wozu und wie lange',
      paragraphs: [
        'Diese Daten dienen dazu, das Online-Spiel zu betreiben (Konten, Partien, Ranglisten) und es vor Missbrauch zu schützen. Rechtsgrundlage: die Erfüllung des Vertrags (die Nutzungsbedingungen) für die Konten und Partien sowie unser berechtigtes Interesse für den Schutz vor Missbrauch.',
        'Sie werden aufbewahrt, solange Ihr Konto besteht. Verlassene Räume werden automatisch gelöscht (Warteräume nach 1 Tag ohne Aktivität, Partien nach 7 Tagen, beendete Partien nach 30 Tagen).',
      ],
    },
    {
      title: 'Ihre Rechte',
      bullets: [
        'Ihren Benutzernamen, Ihren Avatar und die Sprache ändern: in Ihrem Profil.',
        'Einen Freund entfernen oder eine Anfrage ablehnen: auf dem Bildschirm „Freunde“.',
        'Ihr Konto und Ihre Daten löschen: in Ihrem Profil, Schaltfläche „Mein Konto löschen“. Dies erfolgt sofort und endgültig, einschließlich Freundschaften und Freundschaftsanfragen.',
        `Auskunft, Berichtigung, Widerspruch, Datenübertragbarkeit: Schreiben Sie an ${CONTACT_EMAIL}.`,
        'Beschwerde: bei der CNIL (cnil.fr) oder bei der Aufsichtsbehörde Ihres Landes.',
      ],
    },
    {
      title: 'Mindestalter',
      paragraphs: [
        'Um ein Konto zu erstellen, müssen Sie mindestens 15 Jahre alt sein. Unter diesem Alter ist die Zustimmung eines Elternteils oder eines gesetzlichen Vertreters erforderlich.',
      ],
    },
  ],
};

const es: LegalDocument = {
  title: 'Política de privacidad',
  description:
    'Política de privacidad de Halma: datos recogidos, proveedores técnicos, plazos de conservación y sus derechos.',
  version: '18 de noviembre de 2026',
  sections: [
    {
      title: 'Quién es responsable de sus datos',
      paragraphs: [
        'Halma es editado por Matthieu Gouélo, editor a título no profesional (particular), que es también el responsable del tratamiento de sus datos.',
        `Para cualquier pregunta sobre sus datos: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: 'Sin cuenta: nada sale de su dispositivo',
      paragraphs: [
        'Las partidas sin conexión (contra la IA o entre dos personas en el mismo dispositivo) se juegan íntegramente en su dispositivo: no se envía ningún dato.',
      ],
    },
    {
      title: 'Los datos que recogemos',
      paragraphs: ['Solo si crea una cuenta (de correo electrónico o de invitado) y juega en línea:'],
      bullets: [
        'Cuenta de correo electrónico: su dirección de correo electrónico y su contraseña (conservada cifrada mediante hash por nuestro proveedor de alojamiento, nunca en texto claro). Cuenta de invitado: ningún correo electrónico, solo un identificador técnico vinculado a su dispositivo.',
        'Perfil: su nombre de usuario, su avatar (las opciones elegidas en el editor), el idioma de la aplicación (para escribirle los correos electrónicos de la cuenta en ese idioma), la fecha de creación de la cuenta y la del último cambio de nombre de usuario.',
        'Partidas en línea: las salas que crea o a las que se une (código, anfitrión, participantes), el estado de las partidas y todos los movimientos jugados, los abandonos y las derrotas por ausencia.',
        'Señales de actividad: mientras una sala está abierta, la aplicación envía cada 10 segundos la hora de su última actividad, para saber si sigue conectado (tras 2 minutos sin señal de actividad, se le declara derrotado por ausencia).',
        'Estadísticas: número de victorias en línea (por nivel de IA), de partidas iniciadas, y su racha de días de conexión (el día en que abrió la aplicación por última vez).',
        'Amigos (solo cuentas de correo electrónico): sus amistades (con quién y desde cuándo), las solicitudes de amistad enviadas y recibidas pendientes (remitente, destinatario, fecha) y la fecha del último rechazo de una solicitud (para imponer un plazo de 24 horas antes de volver a enviar una solicitud a la misma persona).',
        'Protección contra abusos: los códigos de sala desconocidos que prueba (borrados al cabo de un día).',
        'Registros técnicos del proveedor de alojamiento (Supabase), que pueden contener su dirección IP, conservados por Supabase durante el plazo previsto en su plan.',
      ],
    },
    {
      title: 'Lo que no hacemos',
      bullets: [
        'Sin publicidad, sin reventa de datos.',
        'Sin herramientas de medición de audiencia ni rastreadores publicitarios en la aplicación.',
        'Sin acceso a sus contactos, fotos, micrófono, cámara ni ubicación.',
      ],
    },
    {
      title: 'Quién ve qué',
      bullets: [
        'Los demás jugadores conectados ven su nombre de usuario y su avatar (salas de espera, partidas, clasificaciones).',
        'Las clasificaciones públicas muestran su nombre de usuario, su avatar, su puntuación y su posición.',
        'Perfil público: los demás jugadores conectados con una cuenta de correo electrónico pueden abrir su perfil público (tocando su fila en las clasificaciones, en su lista de amigos o en las solicitudes de amistad que han recibido): su avatar, su nombre de usuario, sus puntos, su posición, sus victorias y su racha de conexión más larga, nada más. También ven allí si son amigos o si hay una solicitud de amistad pendiente entre ustedes. Los invitados no pueden abrirlo. Sus demás estadísticas (partidas iniciadas, racha actual) solo son visibles para usted (perfil).',
        'Los jugadores de una sala ven a sus participantes, la partida y quién está conectado.',
        'Amigos: solo pueden añadirle quienes conozcan su nombre de usuario exacto (no existe una lista de todos los jugadores). La persona a la que envía una solicitud ve su nombre de usuario, su avatar y la fecha de la solicitud. Sus amigos ven su nombre de usuario, su avatar, sus puntos y su posición en la clasificación de puntos, nada más. El rechazo no se notifica al remitente; si vuelve a intentarlo en las 24 horas siguientes, la aplicación le indica que su solicitud ha sido rechazada.',
        'Su dirección de correo electrónico y el idioma de su cuenta nunca se muestran a los demás jugadores.',
      ],
    },
    {
      title: 'Dónde se almacenan sus datos',
      paragraphs: [
        'En nuestro proveedor de alojamiento Supabase (base de datos Postgres y autenticación), en la región de Irlanda, dentro de la Unión Europea. En su dispositivo (o en su navegador, en el sitio web), la aplicación solo guarda su sesión (para mantenerla iniciada) y el idioma elegido.',
      ],
    },
    {
      title: 'Nuestros proveedores técnicos',
      paragraphs: ['Tres proveedores tratan datos para que el servicio funcione:'],
      bullets: [
        'Supabase: alojamiento de los datos y de las cuentas (véase más arriba).',
        'Brevo: envío de los correos electrónicos del servicio (confirmación de la cuenta, cambio de dirección, contraseña olvidada). Brevo recibe su dirección de correo electrónico y el contenido de estos mensajes.',
        `Cloudflare: alojamiento del sitio web ${SITE_DOMAIN} (que trata la dirección IP de sus visitantes para mostrar las páginas) y recepción de los correos electrónicos escritos a ${CONTACT_EMAIL}, reenviados al buzón del proyecto.`,
        'Brevo almacena los datos principalmente en la Unión Europea; las transferencias fuera de la UE están protegidas por el Data Privacy Framework y cláusulas contractuales tipo. Cloudflare trata los datos (direcciones IP) en todo el mundo, en particular en Estados Unidos, al amparo de su certificación en el EU-US Data Privacy Framework.',
      ],
    },
    {
      title: 'Para qué y durante cuánto tiempo',
      paragraphs: [
        'Estos datos sirven para que funcione el juego en línea (cuentas, partidas, clasificaciones) y para protegerlo contra abusos. Base jurídica: la ejecución del contrato (las condiciones de uso) para las cuentas y las partidas, y nuestro interés legítimo para la protección contra abusos.',
        'Se conservan mientras exista su cuenta. Las salas abandonadas se borran automáticamente (salas de espera tras 1 día sin actividad, partidas tras 7 días, partidas terminadas tras 30 días).',
      ],
    },
    {
      title: 'Sus derechos',
      bullets: [
        'Modificar su nombre de usuario, su avatar y el idioma: desde su perfil.',
        'Eliminar a un amigo o rechazar una solicitud: desde la pantalla Amigos.',
        'Eliminar su cuenta y sus datos: desde su perfil, botón «Eliminar mi cuenta». Es inmediato y definitivo, amistades y solicitudes de amistad incluidas.',
        `Acceso, rectificación, oposición, portabilidad: escriba a ${CONTACT_EMAIL}.`,
        'Reclamación: ante la CNIL (cnil.fr) o ante la autoridad de su país.',
      ],
    },
    {
      title: 'Edad mínima',
      paragraphs: [
        'Es necesario tener al menos 15 años para crear una cuenta. Por debajo de esa edad, se requiere el consentimiento de un progenitor o de un representante legal.',
      ],
    },
  ],
};

/** Politique de confidentialité dans chaque langue. */
export const PRIVACY_DOCS: LegalDocuments = { fr, en, de, es };

/** Version française (celle qui fait foi). */
export const PRIVACY = fr;
