# Halma (dames chinoises)

Application mobile de dames chinoises (Halma) jouable à distance, de 2 à 6 joueurs.

## Stack

- **Client :** Expo (React Native) + TypeScript, avec Expo Router. Cibles : iOS, Android et web.
- **Comptes :** Supabase Auth (e-mail et invité anonyme) et table `profiles` dans Postgres.
- **En ligne :** rooms dans Postgres (Row Level Security), mises à jour en direct avec Supabase Realtime ;
  coups validés par l'Edge Function `game-action` (Deno).
- **Règles :** module TypeScript pur (sans React ni Expo) partagé entre le client et le serveur, dans `src/game/`.
- **Avatars :** [Humation](https://github.com/humation-labs/humation) (licence MIT), `@humation/core` affiché
  avec `react-native-svg`.

## Démarrer

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npx expo start
```

Ensuite : scanner le QR code avec l'appli Expo Go sur le téléphone, ou appuyer sur `w` pour ouvrir la version web.

Sans configuration Supabase, l'application fonctionne hors ligne (contre l'IA ou de 2 à 6 amis sur le même appareil) ; seuls les comptes et
le jeu en ligne sont indisponibles.

## Comptes (Supabase)

### Variables d'environnement

Copier `.env.example` en `.env` (ignoré par git) et le remplir :

| Variable | Contenu |
| -------- | ------- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet, par exemple `https://abcdefghijklmnop.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clé publique du projet : clé `anon` ou nouvelle clé `publishable` (`sb_publishable_…`) |
| `EXPO_PUBLIC_SITE_URL` | adresse publique du site, **sans barre finale** : `https://halma-game.com` (facultative en développement) |

Elles se trouvent dans le tableau de bord Supabase, rubrique *Project Settings → API* (ou *API Keys*).
Le préfixe `EXPO_PUBLIC_` les intègre dans l'application : ce sont des valeurs publiques, la sécurité
repose sur la Row Level Security. **Ne jamais mettre la clé `service_role` (ou *secret key*) dans l'application
ni dans un fichier commité.** Après un changement de `.env`, relancer avec `npx expo start --clear`.
Pour une compilation EAS, définir les mêmes variables dans l'environnement EAS du projet. Le cache de Metro
garde les valeurs déjà intégrées : après un changement, `npx expo export --platform web --clear` aussi.

`EXPO_PUBLIC_SITE_URL` fixe l'adresse vers laquelle mènent les liens des e-mails envoyés depuis l'application
mobile (`src/auth/redirect.ts`) :

- **définie** (`https://halma-game.com`) : `https://halma-game.com/reset-password` et
  `https://halma-game.com/auth/confirmed`. Des liens https, cliquables dans toutes les messageries (Gmail ne rend
  pas cliquables les liens `halma://`), ouverts dans le navigateur du téléphone ou de l'ordinateur, sans avoir
  besoin de l'application ;
- **absente** (développement local, tests) : `halma://reset-password` et `halma://auth/confirmed`, comme avant.

Sur le web, l'adresse de redirection reste celle du site ouvert (`window.location.origin`) ; la variable y sert
seulement aux adresses absolues des pages (`og:url`, `og:image`, lien canonique, voir « Déploiement du site »).
Aucune adresse n'est écrite en dur dans le code.

### Mise en place du projet Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Appliquer les migrations de `supabase/migrations/` : avec la CLI Supabase (`supabase link` puis
   `supabase db push`), ou en collant le fichier SQL dans l'éditeur SQL du tableau de bord.
3. Dans *Authentication → Sign In / Providers* :
   - laisser **Email** activé ; en développement, on peut désactiver *Confirm email* pour se connecter
     tout de suite (sinon l'application affiche « vérifie tes e-mails ») ;
   - activer **Allow anonymous sign-ins** pour le mode invité ;
   - mettre la longueur minimale des mots de passe à 8, comme l'application.
4. Régler les adresses des liens envoyés par e-mail, l'envoi des e-mails et leurs modèles (quatre langues) :
   voir « E-mails d'authentification : réglages Supabase » plus bas (étape par étape).
5. Déployer l'Edge Function du jeu en ligne, **depuis la racine du dépôt** (elle importe `src/online/` et
   `src/game/`, que la CLI embarque en suivant les imports) :

   ```bash
   supabase functions deploy game-action --project-ref <référence-du-projet>
   ```

   Elle utilise les variables `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` que Supabase fournit à toute
   Edge Function : rien à configurer. Elle vérifie elle-même le jeton de l'utilisateur ; si le projet utilise
   les nouvelles clés de signature JWT, on peut la déployer avec `--no-verify-jwt`.
6. La migration `rooms` ajoute les tables `rooms`, `room_players` et `games` à la publication
   `supabase_realtime` : rien à activer dans le tableau de bord.
7. Après une nouvelle migration qui touche au jeu en ligne (par exemple `player_stats`), **redéployer
   `game-action`** avec la même commande : la fonction et la base doivent aller ensemble.
8. Déployer l'Edge Function de suppression de compte, elle aussi depuis la racine du dépôt :

   ```bash
   supabase functions deploy delete-account --project-ref <référence-du-projet>
   ```

9. Vérifier le nettoyage automatique des rooms abandonnées (voir « Production » plus bas) : la migration
   `cleanup_abandoned_rooms` le planifie avec pg_cron si l'extension est disponible.
10. Activer les protections contre les abus de la connexion invité (voir « Limites d'abus »).

### Ce qui est en place

- Écrans `/sign-in` (connexion, bouton « Jouer en invité »), `/sign-up` (pseudo, e-mail, mot de passe)
  et `/upgrade` (« Créer mon compte » : un invité ajoute un e-mail à son compte), **sans** barre de
  navigation, avec un seul bouton « ‹ Retour » (voir « Barre de navigation »). Les champs de mot de passe ont
  un œil pour afficher ou masquer la saisie (voir « Champ de mot de passe »). L'accueil affiche le pseudo du joueur connecté, ou « Connecte-toi pour conserver ta progression »
  et un bouton « Se connecter ».
- **Profil d'un invité** (`/profile`, en touchant son avatar en haut à droite) : son pseudo `invite-xxxxxx`, son avatar, ses
  statistiques et une carte « Conserve ta progression » avec le bouton « Créer mon compte » (vers `/upgrade`).
- Table `profiles` (`id`, `pseudo`, `avatar`, `created_at`), remplie automatiquement à l'inscription par un
  trigger : le pseudo vient du formulaire, ou `invite-xxxxxx` pour un invité.
- Pseudos : 3 à 20 caractères parmi les lettres sans accent, les quatre lettres « é », « è », « É », « È »,
  les chiffres, « _ », « - », « . » et l'apostrophe droite « ' », dont au moins 3 lettres (é, è, É et È
  comptent). Aucun autre accent (`Zoë`, `Ça` refusés). L'apostrophe n'est ni la première, ni la dernière, ni
  doublée. Le préfixe `invite-` est réservé aux invités. Exemples : `Jean.Dupont-2`, `Zoé`, `d'Artagnan` ;
  `...`, `12345`, `'Dan` ou `Da''n` sont refusés. La même règle est vérifiée par l'application
  (`src/auth/validation.ts`) et imposée par la base (`is_valid_pseudo`, liste de caractères écrite en
  entier : indépendante de la locale).
- Saisie normalisée : unicode NFC (un clavier peut envoyer « e » suivi d'un accent séparé) et apostrophe
  courbe « ’ » convertie en « ' », par l'application pendant la frappe et par la base (`clean_pseudo`).
- Unicité sans tenir compte de la casse, des accents ni des apostrophes, contre l'usurpation d'identité :
  `Zoé` et `zoe`, `Élodie` et `elodie`, `Dan'` et `Dan` sont le même pseudo. La clé (`pseudo_key`, index
  unique) est construite avec `translate()` et une table de correspondance explicite (A-Z, é, è, É, È ; les
  apostrophes sont retirées), pas avec `lower()`, dont le résultat dépend de la locale de la base (en locale C,
  `lower('É')` vaut `É`).
- Row Level Security : les joueurs connectés (invités compris) lisent les profils ; chacun ne modifie
  directement que son avatar ; le pseudo ne change que par `change_pseudo` (voir « Changer de pseudo ») ;
  personne ne crée ni ne supprime de profil directement (la suppression suit celle du compte). La fonction
  `is_pseudo_available` permet de tester un pseudo avant l'inscription (le joueur connecté ne se gêne pas
  lui-même : `Zoe` peut devenir `Zoé`).
- Le code : `src/lib/supabase.ts` (client, session enregistrée avec AsyncStorage), `src/auth/`
  (validation, appels à Supabase, messages d'erreur traduits à partir de leur code, contexte `useAuth()`).

### Du compte invité au compte e-mail

Un compte invité est lié à l'appareil : après déconnexion, il ne peut pas être retrouvé. Depuis l'accueil, son
profil ou l'onglet Classements, « Créer mon compte » (écran `/upgrade`) le transforme en compte e-mail **sans
changer d'identifiant** : le profil et toute la progression (statistiques, série de connexion) sont conservés, et
le joueur apparaît alors dans les classements.

1. Le pseudo choisi remplace `invite-xxxxxx`, par la fonction `change_pseudo` (format et unicité vérifiés ;
   le premier choix d'un invité n'est pas soumis au délai de 7 jours et n'est pas daté).
2. L'e-mail et le mot de passe sont ajoutés au compte (`supabase.auth.updateUser`).
   - Si *Confirm email* est désactivé, le compte devient aussitôt un compte e-mail.
   - Sinon, le mot de passe est enregistré mais le compte reste invité jusqu'au clic sur le lien reçu
     (« Change Email Address »), qui mène à `/auth/confirmed`. L'accueil et le profil l'indiquent, avec
     « Renvoyer l'e-mail » ; **l'application détecte toute seule la validation** (voir « Validation de
     l'e-mail ») et le compte devient un compte e-mail sans bouton à toucher. Ensuite, la connexion par
     e-mail et mot de passe fonctionne.

### Validation de l'e-mail

À l'inscription (`signUp`) et quand un invité ajoute un e-mail (`updateUser`), l'application passe une adresse de
redirection (`emailRedirectTo`) : `https://halma-game.com/auth/confirmed` (`EXPO_PUBLIC_SITE_URL`, voir plus
haut ; `halma://auth/confirmed` sans elle) sur mobile, `https://<site>/auth/confirmed` sur le web
(`src/auth/auth-links.ts`). Le lien de l'e-mail ouvre l'écran **`/auth/confirmed`**, en général **dans le
navigateur** (page du site) :

- **dans le navigateur de l'inscription faite sur le site** (il garde en mémoire locale qu'une confirmation est
  attendue, `src/auth/pending-confirmation.ts`) : le jeton est vérifié, la session ouverte, « Compte validé ! »
  s'affiche et l'accueil suit tout seul (environ 2 s, bouton « Jouer » en secours) ;
- **ailleurs** (inscription faite dans l'application, ou sur un autre appareil) : le jeton est vérifié avec un
  client Supabase jetable, sans ouvrir ni remplacer de session ; l'écran affiche « Compte validé » et « Tu peux
  retourner dans l'application : elle s'en aperçoit toute seule en quelques secondes. ». Dans le navigateur d'un
  téléphone (Android ou iPhone), un bouton **« Ouvrir l'application Halma »** (lien `halma://`) ; pas sur
  ordinateur (`src/auth/open-app.ts`, `src/components/open-app-button.tsx`) ;
- **lien expiré ou déjà utilisé** : message clair et bouton « Se connecter ».

Pendant l'attente, l'appareil d'origine **détecte la validation tout seul** : relecture du compte au retour au
premier plan (sur le web, quand l'onglet redevient visible) et à intervalle court
(`src/auth/confirmation-poller.ts`, `use-confirmation-watcher.ts`) :

- inscription : l'écran d'attente retente la connexion avec les identifiants saisis (gardés en mémoire seulement,
  jamais enregistrés) toutes les 15 s — Supabase limite les connexions par adresse IP — puis va à l'accueil
  (« Compte validé ! Bienvenue dans Halma. ») ;
- invité devenu compte e-mail : `AuthProvider` relit le compte (`getUser`) toutes les 5 s ; dès que l'e-mail est
  confirmé, la session est renouvelée et l'application passe d'elle-même au compte e-mail.

Le bouton « J'ai confirmé » a disparu ; « Renvoyer l'e-mail » reste (`auth.resend`).

### Mot de passe oublié

- Lien « Mot de passe oublié ? » sous le formulaire de connexion, vers **`/forgot-password`** (sans barre, bouton
  « ‹ Retour », e-mail prérempli depuis la connexion). L'application appelle `auth.resetPasswordForEmail` avec
  l'adresse de redirection `https://halma-game.com/reset-password` (mobile, `EXPO_PUBLIC_SITE_URL` ;
  `halma://reset-password` sans elle) ou `https://<site>/reset-password` (web).
- Réponse **toujours neutre** : « Si un compte existe avec cette adresse, un e-mail vient d'être envoyé. » (on ne
  révèle pas quelles adresses ont un compte). Les limites d'envoi sont traduites (« Un e-mail vient déjà d'être
  envoyé. Réessaie dans 37 secondes. », « Trop d'e-mails envoyés… »).
- **`/reset-password`** reçoit le lien (web : l'URL de la page, `https://halma-game.com/reset-password?token_hash=…&type=recovery` ;
  mobile en développement : lien profond `halma://reset-password`, lu avec `expo-linking` et la route Expo Router
  du même nom), ouvre la session de récupération, retire les jetons de la barre d'adresse, puis demande le
  nouveau mot de passe deux fois (8 caractères au moins, œil sur chaque champ) et appelle
  `auth.updateUser({ password })`. Tout se passe dans le navigateur, sans l'application. Ensuite :
  - **sur le site** : « Mot de passe modifié », « Tu peux retourner dans l'application et te connecter avec ce
    nouveau mot de passe. », bouton « Ouvrir l'application Halma » dans le navigateur d'un téléphone (pas sur
    ordinateur) et « Jouer sur le site » ; pas de retour automatique à l'accueil ;
  - **dans l'application** : « Mot de passe modifié » et retour à l'accueil, connecté.

  Lien expiré ou invalide : « Lien expiré ou invalide », « Ce lien a expiré ou a déjà servi. » et bouton
  « Recevoir un nouveau lien ».
- Pas de « changer mon mot de passe » sur le profil : « mot de passe oublié » est la seule voie.

**Choix du flux.** Les modèles d'e-mails de `docs/emails/` mènent directement à l'application avec
`token_hash` et `type` ; l'application vérifie le jeton (`auth.verifyOtp`), une seule fois même si l'écran est
rouvert, puis retire les jetons de la barre d'adresse sur le web. Le flux PKCE n'est pas utilisé : son `code` ne
s'échange que sur l'appareil (et le navigateur) qui a fait la demande, or on ouvre souvent l'e-mail ailleurs ; et
un jeton vérifié par l'application n'est pas consommé par les antivirus de messagerie qui visitent les liens. Les
liens des modèles par défaut de Supabase (flux implicite, jetons après « # ») restent acceptés (`setSession`). Le
client garde `detectSessionInUrl: false` : c'est l'écran du lien qui ouvre la session, sur mobile comme sur le web.

### E-mails d'authentification : réglages Supabase

À faire une fois dans le tableau de bord du projet (rien de secret dans le dépôt).

1. **Adresses des liens** : *Authentication → URL Configuration*.
   - *Site URL* : `https://halma-game.com` (adresse de secours quand une redirection n'est pas autorisée).
   - *Redirect URLs*, ajouter :
     - `https://halma-game.com/**` (site web, et liens des e-mails envoyés depuis l'application mobile quand
       `EXPO_PUBLIC_SITE_URL` est définie) ;
     - `halma://**` (application sans `EXPO_PUBLIC_SITE_URL` : `halma://auth/confirmed`, `halma://reset-password`) ;
     - en développement : `http://localhost:8081/**` (web local) et, avec Expo Go, `exp://**`.
2. **Service d'envoi d'e-mails** : *Authentication → Emails → SMTP Settings* (ou *Project Settings →
   Authentication*). Le service par défaut de Supabase ne sert qu'aux essais : très peu d'e-mails par heure, et
   seulement vers les adresses des membres de l'équipe du projet. Halma utilise [Brevo](https://www.brevo.com) :
   1. dans Brevo, ajouter et authentifier le domaine `halma-game.com` (enregistrements DNS fournis par Brevo, à
      créer dans la zone DNS Cloudflare) ;
   2. dans Supabase, activer *Enable Custom SMTP* : hôte `smtp-relay.brevo.com`, port `587`, utilisateur et
      mot de passe = l'identifiant et une clé SMTP indiqués par Brevo (rubrique *SMTP & API*), expéditeur
      `noreply@halma-game.com`, nom `Halma`.

   La clé reste dans Supabase, jamais dans le dépôt ni dans `.env`. Ensuite, ajuster *Authentication → Rate
   Limits → emails sent per hour*. La réception (`contact@halma-game.com`) passe par Cloudflare Email Routing,
   qui transfère vers la boîte du projet : rien à faire dans Supabase.
3. **Modèles multilingues** (français, anglais, allemand, espagnol) : *Authentication → Email Templates*,
   coller le sujet de `docs/emails/multilingue/sujets.md` et le HTML de `docs/emails/multilingue/` dans
   *Confirm signup*, *Change Email Address* et *Reset Password* (voir `docs/emails/README.md` : la langue vient
   des métadonnées du compte, le français par défaut).
4. **Durée des liens** : *Authentication → Providers → Email*, *Email OTP Expiration* à `3600` secondes (une heure,
   comme l'annoncent les e-mails).
5. **Essai** : s'inscrire dans l'application sur le téléphone et ouvrir le lien sur l'ordinateur (l'appli doit
   avancer seule), puis « Mot de passe oublié ? » dans l'application et ouvrir le lien dans Gmail sur le
   téléphone : la page du site s'ouvre dans le navigateur, on y choisit le mot de passe, puis « Ouvrir
   l'application Halma ».

Captures : `docs/screenshots/auth-13-…` à `auth-22-…` (lien « Mot de passe oublié ? », demande et réponse
neutre, nouveau mot de passe, « Mot de passe modifié », lien expiré, « Compte validé ! », autre appareil, attente à
l'inscription, invité en attente de confirmation).

Les liens `halma://` ne sont pas cliquables dans certaines messageries (Gmail, notamment) : c'est pourquoi
l'application mobile envoie des liens https vers le site (`EXPO_PUBLIC_SITE_URL`). Amélioration possible plus
tard : les liens universels (iOS) et App Links (Android) sur `halma-game.com`, pour que ces mêmes liens ouvrent
directement l'application quand elle est installée.

### Changer de pseudo

Sur le profil, « Changer mon pseudo » ouvre un champ dans la carte (prérempli avec le pseudo actuel, vide pour
un invité). Mêmes règles et messages qu'à l'inscription, plus « déjà pris », « interdit » et le délai ; une
confirmation s'affiche (« C'est fait : ton pseudo est maintenant « Zoé ». ») et le profil est relu : le nouveau
pseudo apparaît partout (accueil, profil, classements, rooms, qui lisent `profiles`).

- **Délai de 7 jours** entre deux changements, imposé par la base : colonne `profiles.pseudo_changed_at` et
  fonction `change_pseudo(new_pseudo)` (`security definer`), qui nettoie, valide le format, refuse le préfixe
  `invite-`, vérifie l'unicité et le délai. Erreurs : `pseudo_invalid`, `pseudo_reserved`, `pseudo_taken`,
  `pseudo_too_soon` (le détail donne la date du prochain changement possible), traduites en français par
  `src/auth/auth-service.ts`. Redonner son pseudo actuel ne change rien et n'est pas daté.
- Un pseudo jamais changé depuis l'inscription peut l'être tout de suite ; le premier choix d'un invité
  (pseudo actuel `invite-…`) n'est pas soumis au délai.
- Pendant le délai, le bouton est désactivé et le profil annonce la date du prochain changement possible
  (`src/auth/pseudo-change.ts`) ; c'est seulement un affichage, la base tranche.
- Les clients n'ont plus le droit de modifier la colonne `pseudo` directement (l'avatar, si).

Code : `supabase/migrations/20261014120000_pseudo_accents_and_change.sql`, `src/components/change-pseudo.tsx`.

### Vérifier les migrations sans Supabase

`scripts/check-db.sh` applique les migrations sur un Postgres local (avec une imitation minimale du
schéma `auth` de Supabase) et vérifie le trigger, le format et l'unicité des pseudos (accents, apostrophes,
normalisation, unicité sans casse, accents ni apostrophes, en locale C), le changement de pseudo (délai,
premier choix d'un invité) et la RLS. La base
temporaire utilise la locale `C`, la plus stricte :

```bash
DATABASE_URL=postgres://postgres@localhost:5432/postgres scripts/check-db.sh
```

Le script crée une base temporaire et la supprime à la fin. Ne jamais le lancer sur la base Supabase.
Il vérifie aussi la migration `rooms` (`supabase/checks/rooms-check.sql`) : lecture réservée aux joueurs
de la room, aucune écriture directe, salle d'attente, lancement, fin de partie, et la règle « une seule room
active » (deuxième création et deuxième jointure refusées, rejoindre sa propre room permis, l'hôte qui quitte
supprime la room avec ses participants, un simple joueur la quitte et elle reste ouverte, abandon puis nouvelle
room permise, rooms finies ignorées) ; et la migration
`player_stats` (`supabase/checks/stats-check.sql`) : aucune écriture par les clients, parties lancées,
victoires (niveau de l'IA la plus forte, idempotence, forfaits et abandons exclus), séries de connexion,
classements (cinq, sans les parties lancées ; départage, top 50, ligne du joueur ; invités exclus et refusés,
invité devenu compte e-mail classé avec ses scores d'invité) ; enfin
`supabase/checks/account-check.sql` : suppression de compte (hôte en pleine partie, salles d'attente,
statistiques et classements), limite d'essais de codes, nettoyage des rooms abandonnées ; et
`supabase/checks/public-profile-check.sql` : profil public (relations, invité refusé, joueur inconnu, aucune donnée
privée) et anciennes colonnes inchangées des classements, des amis et des demandes (voir « Profil d'un joueur »).

## Plateau : une seule zone tactile

Les 121 cases ne portent plus chacune un `onPress` : sur le web, `react-native-svg` transmettait les
gestionnaires de touche des cercles tels quels au DOM, d'où l'avertissement React « Unknown event handler
property `onResponderTerminate` ». Une seule zone tactile (`View` à gestionnaires de réponse, avec le libellé
« Plateau de jeu ») est posée au-dessus du dessin ; elle retrouve la case touchée avec `cellAt`
(`src/components/board/layout.ts`, l'inverse de `toPoint` : arrondi à l'hexagone le plus proche, `null` hors des
cases). Un doigt qui a glissé de plus de 10 points n'est pas une touche. Le même code marche sur iOS, Android et
le web ; le plateau de l'accueil, en lecture seule, n'a pas de zone tactile. Testé par `layout.test.ts` (les 121
cases, à plusieurs tailles, sur toute la surface du cercle, hors plateau) et `board.test.tsx`.

## Tour et branche d'arrivée

Retours des parties de test : on ne voyait pas assez vite à qui c'était le tour ni où aller.

- **Joueur courant** (`PlayerChip` avec `turn`) : dans la pastille « Au tour de » et dans la barre des joueurs en
  ligne, son avatar est entouré d'un anneau noir épais et d'un halo pastel qui pulse lentement ; les autres
  joueurs sont atténués (avatar pâli, nom en gris `inkSoft`, toujours lisible). Dans la barre, le joueur courant
  est aussi écrit (« joue ») : la couleur n'est jamais le seul indice.
- **Cadre du plateau** : teinté de la couleur pâle (`tint`) du joueur dont c'est le tour.
- **En ligne** : quand c'est ton tour, une bannière « À toi de jouer ! » dans ta couleur remplace « Au tour de » ;
  sinon « En attente de » suivi du joueur. Sur le web, le titre de l'onglet suit (« ● À toi de jouer ! · Halma »,
  « En attente de Camille · Halma », « Partie terminée · Halma ») avec `expo-router/head` (rendu seulement sur
  le web). Textes dans `src/rooms/turn-display.ts`.
- **Branche d'arrivée** : celle du joueur dont c'est le tour en local, toujours la tienne en ligne (aucune pour
  un spectateur, un joueur parti ou une partie finie ; `goalPlayer` dans `src/components/board/goal.ts`). Ses
  cases sont simplement teintées plus fort que les branches de départ (couleur `piece`, opacité
  `GoalTintOpacity`), sous les pions ; ni le calcul du plateau ni la zone tactile ne changent.
- **Réduire les animations** : le halo reste immobile (pleinement visible) ; seul le mouvement disparaît, les
  indices (anneau, texte) restent.
- Tests : `goal.test.ts` (qui voit sa branche), `board.test.tsx` (les 10 cases teintées de la branche visée, de
  2 à 6 joueurs, branches vides comprises ; même zone tactile), `turn-display.test.ts`, `turn-highlight.test.tsx`.

Captures : `docs/screenshots/tour-*.png`.

## Mutateurs de partie

Deux options de partie, activables ou non, réglées avant le lancement (`src/mutators/mutators.ts`) :

| Mutateur | Par défaut | Effet |
| -------- | ---------- | ----- |
| **Toucher c'est jouer** | désactivé | Un pion sélectionné qui **peut** bouger doit être joué : impossible d'en sélectionner un autre ou d'annuler. Un pion bloqué ne verrouille rien (on peut en choisir un autre). |
| **Clairvoyance** | activée (comportement d'avant) | Les cases où le pion sélectionné peut aller sont en pointillés. Désactivée, elles sont masquées ; une touche sur une case où le pion ne peut pas aller ne joue rien et garde la sélection. |

- **Options d'interface, pas règles** : le moteur `src/game/` et l'Edge Function `game-action` ne changent pas.
  Le réducteur calcule toujours les coups légaux avec le moteur (affichés ou non), et en ligne le serveur valide
  chaque coup comme avant. **Les mutateurs ne sont donc pas vérifiés côté serveur** : un client modifié pourrait
  les ignorer. Ils ne changent rien aux statistiques ni aux classements.
- **Décision d'une touche** : `resolveTap`, partagée par les parties locales (`src/hooks/local-game-reducer.ts`)
  et en ligne (`src/rooms/online-game-reducer.ts`). Une touche refusée donne un retour discret à la place de la
  consigne (« Ce pion ne peut pas aller là. », « Toucher c'est jouer : joue le pion choisi. »), sans montrer les
  cases possibles.
- **Parties locales** : deux interrupteurs avec une phrase d'explication sur les écrans de réglage (contre l'IA,
  entre amis), transmis dans l'URL : `/game?players=2&touch=1&clairvoyance=0`. Valeurs acceptées : `1`, `true`,
  `on`, `oui`… et `0`, `false`, `off`, `non`… ; une valeur absente ou invalide garde la valeur par défaut.
  « Nouvelle partie » garde les mêmes mutateurs.
- **Parties en ligne** : l'hôte les règle dans la salle d'attente, les autres joueurs les voient en lecture
  seule (mises à jour en direct par Realtime). Ils sont stockés dans `rooms.settings` (jsonb, migration
  `20261012120000_room_settings.sql`), écrits seulement par la fonction SQL `set_room_settings` (`security
  definer`) : hôte d'une room **en attente** uniquement (`not_host`, `room_started`), booléens des clés connues
  `touch_move` et `clairvoyance` uniquement (`bad_request`, et une contrainte CHECK sur la colonne). Figés au
  lancement, ils s'appliquent pareil chez tous les joueurs. Lisibles par les membres comme le reste de la room.
- **Pendant la partie** : de petits badges sous la consigne indiquent les mutateurs actifs.
- **Interrupteur** : dessiné dans la DA (`src/components/mutator-settings.tsx`), rôle `switch` pour les lecteurs
  d'écran, état écrit à côté (« Activé » / « Désactivé ») ; en lecture seule, le rail est en pointillés.
- Tests : `src/mutators/__tests__/mutators.test.ts` (paramètres d'URL, `rooms.settings`, badges, consigne),
  `local-game-reducer.test.ts` (sélection verrouillée, pion bloqué, cases masquées, coup illégal ignoré),
  `online-game-reducer.test.ts`, `room-service.test.ts` (réglage en ligne), `local-game-screen.test.tsx`,
  `mutator-settings.test.tsx`, et `supabase/checks/rooms-check.sql` (réglage par l'hôte, refus d'un autre joueur
  et après le lancement, valeurs invalides).

Captures : `docs/screenshots/mutateurs-*.png`.

## Parties hors ligne

Deux modes, sur l'accueil (carte « Hors ligne ») :

- **Contre l'IA** (`/ai-setup`) : de 1 à 5 IA, niveau au choix pour chacune ; le joueur est en bas.
- **Entre amis** (`/local-setup`) : de 2 à 6 joueurs humains sur le même appareil, choisis avec un stepper ; l'écran
  montre l'ordre du tour et la couleur de chacun, dans l'ordre du moteur (Rose, Bleu, Menthe, Citron, Lavande,
  Pêche ; à 5, une branche reste vide). La partie s'ouvre sur `/game?players=N`. L'écran de jeu, la pastille « Au
  tour de » et l'écran de victoire (couleur du vainqueur) fonctionnent de 2 à 6 joueurs, sur téléphone comme sur
  grand écran.

### Quitter ou recommencer une partie en cours

Tant qu'une partie locale est **en cours** (au moins un coup joué, partie pas terminée), l'application demande
confirmation avant de la perdre, dans une fenêtre dessinée (`src/components/confirm-dialog.tsx`) :

- « Nouvelle partie » → « Nouvelle partie ? » : **Continuer la partie** ou **Recommencer** ;
- « ‹ Accueil », geste de retour (iOS), bouton retour d'Android, retour du navigateur → « Quitter la partie ? » :
  **Continuer la partie** ou **Quitter**.

Sur une partie pas encore commencée ou terminée, rien n'est demandé. La fenêtre n'utilise pas `Alert` (absent du
web) : `Modal` de React Native, rôle « alertdialog », reste de l'écran masqué aux lecteurs d'écran, focus sur
« Continuer la partie » et gardé dans la fenêtre (web), Échap et le bouton retour d'Android ferment sans rien faire.

Côté code : `usePreventRemove` (Expo Router) bloque les retraits d'écran (boutons, gestes, retour Android) ; sur le
web, le retour du navigateur ne passe pas par là (le routeur remplace toute la pile), il est donc intercepté avant
le routeur par `src/navigation/web-back-guard.ts`, importé par le layout racine (`src/hooks/use-leave-guard.ts`).

**Que devient une partie locale quand on quitte l'écran ?** Elle est supprimée : son état n'existe que dans le
`useReducer` de l'écran de jeu (`useLocalGame`), rien n'est écrit (ni AsyncStorage, ni serveur). Quitter l'écran
le retire de la pile et le démonte : l'état est perdu, et le calcul d'une IA en cours est annulé
(`AbortController`). Revenir sur `/game` (y compris avec le bouton « suivant » du navigateur) démarre une partie
neuve. Vérifié par `src/hooks/__tests__/local-game-screen.test.tsx`.

Tests : `local-game-screen.test.tsx` (écran de jeu avec le vrai routeur d'Expo Router et un faux plateau :
confirmations, retour en arrière, partie supprimée, partie à 4), `leave-guard.test.ts` (quand demander),
`game-setup.test.ts` (paramètres `players` et `ai`), `src/components/__tests__/confirm-dialog.test.tsx` et
`victory-overlay.test.tsx`, `src/navigation/__tests__/web-back-guard.test.ts` (retour du navigateur). Les tests
d'écran utilisent `@testing-library/react-native` et `expo-router/testing-library`.

Les parties hors ligne ne comptent pas dans les statistiques ni les classements (voir « Statistiques et
classements »).

## Jeu en ligne

### Parcours

- **Accueil → Jouer en ligne** (`/online`) : il faut être connecté (un compte invité suffit). Sans room active,
  on **trouve une partie** (matchmaking, voir plus bas), on crée une room ou on en rejoint une avec son code. Avec une room active, l'écran la montre (« Ta room » :
  « Ouvrir » ou « Reprendre », et « Quitter la room » dans une salle d'attente) et ne propose ni création ni
  jointure : voir « Une seule room active ».
- **Salle d'attente** (`/room/[id]`) : code à 6 caractères (sans I, L, O, 0 ni 1) à partager, liste des
  participants avec leur pseudo, l'hôte et les joueurs déconnectés. L'hôte ajoute ou retire des IA et règle
  leur niveau, de 2 à 6 participants en tout, puis lance la partie. « Quitter la room » : un joueur quitte et
  la room reste ouverte pour les autres ; l'**hôte** la **supprime** (avec ses participants), après une
  confirmation s'il y a d'autres joueurs, et ceux-ci sont renvoyés à l'accueil avec « L'hôte a fermé la room. ».
  « ‹ Retour » ou « Accueil » laissent la room existante : on la reprend depuis « Jouer en ligne ».
- **Partie** (même écran une fois lancée) : l'ordre des places donne l'ordre du tour et les couleurs. Chaque
  joueur ne peut toucher que ses pions pendant son tour ; le coup s'affiche aussitôt puis est confirmé (ou
  annulé) par le serveur. Les coups des autres arrivent par Realtime et sont animés. Bouton « Abandonner » (en
  partie, on ne « quitte » pas).

### Matchmaking (« Trouver une partie »)

Bouton **« Trouver une partie »** sur « Jouer en ligne » → écran `/matchmaking` (sans barre). Connecté (invité
compris) et sans room active ; **être en file compte comme être dans une room active** : pas de room en parallèle.

1. **Recherche** : « Recherche d'un adversaire… », durée de la recherche, bouton « Annuler ». Après une minute,
   une fenêtre propose « Continuer d'attendre » (la question revient une minute plus tard) ou « Annuler la
   recherche ». Quitter l'écran sans partie annule aussi la recherche.
2. **Appariement** : dès que 2 joueurs cherchent, le serveur les place dans une même room (créée en attente,
   `rooms.matchmaking`), **premier arrivé, premier servi**. Départ prévu **15 s** plus tard (`rooms.starts_at`,
   heure du serveur) : « Adversaire trouvé ! », compte à rebours dans un grand pion pastel, liste des joueurs.
   Pendant ces 15 s, les joueurs qui arrivent en file rejoignent cette room, jusqu'à **6**. Le compte à rebours
   suit l'heure du serveur (chaque réponse donne `server_now` : l'écart avec l'horloge du téléphone est corrigé).
3. **Départ** : à la fin du compte à rebours, chaque client demande le départ à `game-action` (action `start`) ;
   le serveur refuse avant l'heure prévue (`start_too_early`, l'application redemande une seconde plus tard),
   lance la partie une seule fois (de 2 à 6 participants) et renvoie la même partie aux demandes suivantes. Tous
   les joueurs passent alors sur `/room/[id]`.
4. Pas d'IA, pas de réglage des mutateurs (valeurs par défaut) et pas d'hôte à gérer : `add_ai`, `set_ai_level`,
   `remove_ai` et `set_room_settings` refusent (`not_host`), et une room de matchmaking ne se rejoint pas par son
   code. Les **points** s'appliquent comme pour toute partie en ligne avec au moins 2 humains (les invités ont
   leurs points, mais n'apparaissent au classement qu'avec un compte e-mail).

**Départs et absences** : un joueur qui quitte pendant le compte à rebours (« Annuler », `leave_matchmaking` ou
`leave_room`) sort de la room ; s'il reste **moins de 2 joueurs**, la room est dissoute et les restants sont
**remis en file automatiquement**, à leur rang. Un joueur sans signe de vie depuis **20 s** (en file ou en compte à
rebours) est retiré ; l'application envoie `matchmaking_heartbeat` toutes les 4 s.

**Serveur** (migration `20261020120000_matchmaking.sql`) :

| Élément | Rôle |
| ------- | ---- |
| `matchmaking_queue` (joueur, arrivée, dernier signe de vie) | file d'attente ; chacun ne lit que sa ligne (RLS), aucune écriture par les clients ; publiée pour Realtime |
| `rooms.matchmaking`, `rooms.starts_at` | room de matchmaking et départ prévu |
| `join_matchmaking()` | entre en file (idempotent) ; `already_in_room` si le joueur est dans une room active |
| `leave_matchmaking()` | quitte la file ou la room en compte à rebours (dissolution sous 2 joueurs) |
| `matchmaking_heartbeat()` | signe de vie, fait avancer les appariements, renvoie l'état |
| `get_matchmaking_status()` | lecture seule de l'état : `idle`, `searching`, `matched` (room, départ, joueurs) ou `started`, avec `server_now` |
| `create_room`, `join_room` | refusent pendant une recherche (`already_searching`) |
| `begin_game` | room de matchmaking : lancée par n'importe lequel de ses joueurs, pas avant `starts_at` |
| `cleanup_abandoned_rooms` | supprime aussi les rooms de matchmaking jamais lancées (10 min après l'heure prévue) et vide la file des absents |

Tout se passe sous un **verrou global** (`pg_advisory_xact_lock`) : les appariements sont sérialisés et aucune
course ne place un joueur dans deux rooms (verrou par joueur, puis verrou global, puis la room, toujours dans cet
ordre). Constantes : `matchmaking_countdown()` (15 s), `matchmaking_stale_after()` (20 s),
`matchmaking_max_players()` (6), et côté application `src/rooms/matchmaking.ts`.

Côté application : `src/rooms/matchmaking.ts` (appels, compte à rebours sur l'heure du serveur, attente longue),
`src/rooms/use-matchmaking.ts` (file, signes de vie et relecture de secours toutes les 4 s, Realtime sur sa ligne
de file et ses places en room, départ), `src/app/matchmaking.tsx`. Une room de matchmaking ouverte avant son départ
renvoie vers `/matchmaking`. Vérifications : `src/rooms/__tests__/matchmaking.test.ts`,
`src/online/__tests__/matchmaking-start.test.ts`, `src/components/__tests__/matchmaking-screen.test.tsx` et
`supabase/checks/matchmaking-check.sql`. Captures : `docs/screenshots/matchmaking-1-jouer-en-ligne.png`,
`matchmaking-2-recherche.png`, `matchmaking-3-attente-longue.png`, `matchmaking-4-compte-a-rebours.png`.

### Une seule room active

Un joueur ne peut être que dans **une** room à la fois (migration `20261008120000_single_active_room.sql`, qui
remplace la limite de 5 salles d'attente). Sa room est **active** s'il a une place dans :

- une salle d'attente, ou
- une partie en cours qu'il n'a pas abandonnée (son identifiant de joueur n'est pas dans `games.forfeited` : un
  abandon et un forfait par déconnexion libèrent donc le joueur).

Les rooms finies ne comptent pas. Côté serveur :

- `create_room` et `join_room` refusent avec le code `already_in_room` (« Tu es déjà dans une room… ») si le
  joueur est dans une autre room active ; rejoindre la room dont on fait déjà partie reste permis (reprise de
  partie). Un verrou par joueur (`pg_advisory_xact_lock`) empêche deux appels simultanés d'en créer deux ;
- `leave_room` : hôte d'une salle d'attente → room supprimée (cascade sur `room_players` et `games`) ; autre
  joueur → il quitte, la room reste ; pendant la partie → `room_started` (on abandonne) ; room finie → il la
  quitte de sa liste. Le passage de l'hôte à un autre joueur n'existe plus qu'à la suppression d'un compte
  (`prepare_account_deletion`, inchangé) ;
- `my_active_room()` renvoie la room active de l'utilisateur connecté (écran « Jouer en ligne ») ;
  `active_rooms_of(uuid)` est réservée au serveur ;
- `cleanup_abandoned_rooms` ne change pas. Des joueurs qui avaient plusieurs rooms avant la migration les
  gardent : `my_active_room()` montre la plus récente, et il faut les quitter une à une.

Côté application : `describeOnlineError` traduit `already_in_room` ; quand la room disparaît pendant qu'on est
dans la salle d'attente (événement Realtime de suppression, ou relecture qui ne la trouve plus), l'écran renvoie à
l'accueil avec le message « L'hôte a fermé la room. » (`src/lib/flash-notice.ts`, `FlashNoticeBanner`), sans erreur
ni écran blanc ; si l'on n'avait jamais vu la room (lien ou code périmé), l'écran « Room introuvable » reste.

### Qui écrit quoi

Les clients **ne peuvent rien écrire** dans `rooms`, `room_players` ni `games` (aucun droit `insert`,
`update` ni `delete`, et la RLS ne leur montre que leurs rooms) :

| Action | Passe par | Vérifications |
| ------ | --------- | ------------- |
| Créer, rejoindre, quitter une room ; ajouter, régler, retirer une IA ; régler les mutateurs ; signe de vie | fonctions SQL `create_room`, `join_room`, `leave_room`, `add_ai`, `set_ai_level`, `remove_ai`, `set_room_settings`, `heartbeat` (`security definer`) | membre, hôte, room en attente, 6 places au plus, une seule room active ; réglages : booléens connus |
| Lancer la partie, jouer un coup, faire jouer une IA, déclarer forfait, abandonner | Edge Function `game-action` (clé `service_role`) | voir ci-dessous |

L'Edge Function (`supabase/functions/game-action/index.ts`) authentifie le jeton, puis passe la demande à
`src/online/server.ts`, indépendant de Supabase (et donc testé avec Jest) :

1. lecture de la room, des participants et de la partie ;
2. décision de l'arbitre (`src/online/referee.ts`), qui s'appuie sur le moteur `src/game/` : l'utilisateur
   joue-t-il dans cette partie, n'a-t-il pas abandonné, est-ce son tour, a-t-il vu le dernier coup (numéro
   `turn`), et surtout `validateMove` du moteur, qui accepte n'importe quel chemin de sauts valide ;
3. écriture seulement si la version de la partie n'a pas changé depuis la lecture (verrou optimiste) ; sinon
   la demande est rejouée sur l'état frais (un coup envoyé deux fois est alors refusé).

Pour que Deno (et la CLI Supabase, qui suit les imports pour empaqueter la fonction) puisse lire
`src/game/` et `src/online/` tels quels, ces deux dossiers importent leurs voisins avec l'extension `.ts`
(`tsconfig.json` : `allowImportingTsExtensions`) et n'utilisent pas l'alias `@/`.

### IA : côté serveur

Les IA jouent **dans l'Edge Function**, pas chez l'hôte :

- l'hôte n'est pas un point de panne : s'il se déconnecte, les IA continuent de jouer pour les autres ;
- personne ne peut choisir le coup d'une IA à sa place (un hôte pourrait sinon la faire mal jouer) ;
- un seul code et un seul chemin d'écriture pour tous les coups, validés de la même façon.

Le calcul reste court : un seul coup d'IA par appel (niveau difficile limité à 600 ms), dans la limite de
temps de calcul d'une Edge Function. Le coup est demandé par une action `tick` : le premier joueur humain
connecté (dans l'ordre des places) l'envoie 0,7 s après la fin de l'animation, pour laisser voir le coup
précédent ; les autres ne l'envoient qu'en secours au bout de 4 s. Le serveur ignore les demandes en
double grâce au verrou de version.

### Déconnexion, reprise et forfait

- Tant que la room est ouverte, l'application envoie un signe de vie toutes les 10 s (`heartbeat`). Au-delà
  de 25 s sans signe de vie, le joueur apparaît « déconnecté », avec le temps restant avant forfait.
- **Reprise** : revenir dans l'application (ou rouvrir la room depuis « Tes parties en cours ») relit la
  room et la partie, et relance le signe de vie. Si Realtime est coupé, l'application relit la room toutes
  les 5 s en attendant la reconnexion.
- **Forfait** après **2 minutes** sans signe de vie (`FORFEIT_AFTER_MS` dans `src/online/constants.ts`) :
  les autres clients envoient `tick`, et le serveur, qui revérifie le délai lui-même, déclare
  forfait. Les pions du joueur sont retirés (ils ne bloquent plus la branche d'arrivée d'un autre) et le
  moteur saute désormais son tour. Abandonner a le même effet, immédiatement.
- Fin de partie : un joueur qui remplit sa branche gagne ; s'il ne reste qu'un participant, il gagne par
  forfait ; s'il ne reste que des IA, la partie est arrêtée sans vainqueur.

### Tests

- `src/online/__tests__/stats.test.ts` : victoires comptées (IA la plus forte, forfaits, idempotence, panne des
  statistiques rattrapée).
- `src/online/__tests__/` : validation côté serveur. `server.test.ts` passe par `handleGameRequest` (le
  code de l'Edge Function) avec une base en mémoire : demandes mal formées, coups hors tour, pion adverse,
  sauts invalides, chemins de sauts non minimaux acceptés, coup rejoué, écritures concurrentes, victoire,
  IA, forfaits et abandons. `referee.test.ts` et `protocol.test.ts` testent l'arbitre et la lecture des
  demandes.
- `src/rooms/__tests__/` : côté application (affichage optimiste et annulation, animation des coups reçus,
  choix du joueur qui demande le coup de l'IA, appels à Supabase).
- `scripts/check-db.sh` : RLS et fonctions SQL (voir plus haut).
- La fonction se vérifie avec Deno : `deno check supabase/functions/game-action/index.ts`.

## Statistiques et classements

### Ce qui est compté

| Statistique | Quand | Par qui |
| ----------- | ----- | ------- |
| Parties lancées (profil seulement, pas de classement) | +1 pour chaque joueur humain de la room quand l'hôte lance une partie en ligne | `begin_game` (appelée par l'Edge Function), dans la transaction du lancement |
| Victoires (toutes confondues) | un humain gagne une partie en ligne en remplissant sa branche (`end_reason = 'win'`) | `record_game_win` (appelée par l'Edge Function après l'écriture de la partie) |
| Victoires contre une IA facile, moyenne, difficile (comptées, plus de classement depuis la migration `rating`) | même victoire, si la partie contenait au moins une IA : rangée au niveau de l'**IA la plus forte** présente (et comptée aussi dans « toutes victoires ») | idem |
| Points (MMR) | après chaque partie en ligne **classée** (voir « Points (MMR) ») | `record_game_rating` (appelée par l'Edge Function, montants calculés par `src/online/rating.ts`) |
| Série de connexion, meilleure série | à l'ouverture de l'application (et au retour au premier plan), une fois par jour | `record_daily_login`, appelée par l'application |

- **Ne comptent pas** : une victoire par forfait ou abandon des autres joueurs (`end_reason = 'forfeit'`), une partie
  arrêtée faute d'humains (`abandoned`), une victoire d'IA, et **les parties locales hors ligne**. Ces dernières se
  jouent entièrement sur l'appareil : le serveur n'en voit ni les coups ni le résultat, n'importe qui pourrait donc
  en déclarer autant qu'il veut. Seules les parties en ligne, dont chaque coup est validé par le moteur dans
  l'Edge Function, entrent dans un classement public. **Décision confirmée** : les parties hors ligne (contre l'IA
  ou entre amis sur le même appareil) ne comptent pas et ne sont envoyées nulle part (ni fonction serveur, ni file
  d'attente locale). L'application reste discrète sur ces règles : l'écran de classement n'affiche qu'une phrase
  d'accroche, « Seules les légendes apparaissent ici. », et les descriptions des onglets ne parlent pas de parties
  en ligne ou hors ligne ; c'est ce README qui les documente.
- **Invités** : leurs statistiques sont comptées comme celles de tout joueur (victoires en ligne, parties lancées,
  série de connexion), mais un compte invité (connexion anonyme, `auth.users.is_anonymous`) **n'apparaît dans aucun
  classement et ne peut pas les consulter**. Quand il crée son compte avec un e-mail, son identifiant ne change pas
  et Supabase passe `is_anonymous` à `false` : il apparaît aussitôt avec toute sa progression d'invité.
- **Une victoire par partie** : `record_game_win` relit la partie dans la base (statut, raison de fin, vainqueur,
  participants) et note la partie dans `stats_wins` (clé primaire) ; un deuxième appel ne change rien. L'Edge
  Function l'appelle juste après avoir enregistré un coup gagnant ; si cet appel échoue, la prochaine demande sur
  la partie (par exemple un `tick`) le refait. La même règle existe en TypeScript (`src/online/stats.ts`, testée
  avec Jest) pour décider s'il faut appeler la base.
- **Série de connexion** : le jour est le jour calendaire de **Paris** (`Europe/Paris`), donné par l'horloge du
  serveur ; aucun paramètre n'est accepté du client. Même jour : rien ; jour suivant : série + 1 ; au moins un
  jour manqué : retour à 1. La meilleure série suit. Les invités ont aussi leur série. L'appel se fait en
  arrière-plan depuis le contexte d'authentification : il ne bloque pas l'affichage et un échec (hors ligne) est
  simplement réessayé au prochain retour dans l'application.
- **Parties lancées** : toujours comptées et affichées sur le profil, mais sans classement (retiré par simplicité,
  migration `20261004120000_leaderboards_without_games_started.sql`).
- **Limite assumée** (victoires et séries) : ces classements ne sont pas protégés contre les scripts ni contre les
  comptes qui s'entraident. Les **points** ont, eux, des garde-fous (10 coups d'humains au moins, 3 parties classées
  par jour au plus entre deux mêmes comptes) : voir « Points (MMR) ».

### Intégrité

- Table `player_stats` (une ligne par joueur, supprimée avec le compte) : les clients n'ont **aucun** droit
  `insert`, `update` ni `delete`, et ne lisent que leur propre ligne (profil). `stats_wins` leur est invisible.
- `record_game_win` et `advance_login_streak` ne sont pas appelables par les clients (seulement la clé
  `service_role` de l'Edge Function pour la première, rien pour la seconde).
- `get_leaderboards()` (comptes e-mail seulement) renvoie, pour chacun des 3 classements (points, victoires, série), les
  50 premiers et la ligne du joueur lui-même, même plus loin : **pseudo, avatar, score, rang**, `is_me` et
  l'identifiant du joueur (`user_id`, en dernière colonne depuis la migration `public_profile` : il ouvre son
  profil public), rien d'autre. L'avatar est `profiles.avatar`, ou à défaut l'identifiant du joueur, qui sert de graine à son avatar
  par défaut (les profils sont de toute façon lisibles par les joueurs connectés). Victoires et série : seuls les
  scores positifs sont classés ; points : tout joueur qui a joué au moins une partie classée, points négatifs
  compris. À score égal, le premier à l'avoir atteint passe devant, puis l'ordre alphabétique du pseudo.
- Invités (migration `20261007120000_leaderboards_without_guests.sql`) : les lignes des utilisateurs anonymes sont
  exclues de tous les classements, et un appelant anonyme est refusé avec l'erreur courte `guest_not_ranked`,
  traduite par l'application (`describeLeaderboardError`, `src/stats/leaderboard.ts`). L'application n'envoie de
  toute façon aucune requête de classement pour un invité.

### Écrans

- **Classements** (`/leaderboard`) : trois onglets, **Points** (par défaut), **Victoires** (total) et **Série** (plus
  haute série de connexion), chargés en un seul appel et relus à chaque retour sur l'écran. Les classements par
  niveau d'IA (débutants, confirmés, pros) ont été retirés (leurs colonnes restent comptées). Un score négatif
  s'affiche avec son signe (« -15 »). Chaque ligne :
  numéro de position (« 1er », « 2e », « 12e »… sur **toutes** les lignes ; pour les trois premiers, au-dessous du
  podium dessiné : marche de la bonne hauteur et pion), avatar, pseudo, score. Sa propre ligne est teintée, marquée
  de « C'est toi », et répétée en bas quand on est hors du top 50 (ou pas encore classé) : ce bloc annonce alors la
  position en clair (« Tu es 61e »), ou « Tu n'es pas encore classé ici. ». **Toucher une ligne ouvre le profil du
  joueur** (`/player/[id]`, voir « Profil d'un joueur ») ; la ligne « C'est toi » ouvre son propre profil. États de chargement, d'erreur (« Réessayer ») et de classement vide ;
  message clair sans configuration Supabase. Sous le titre, une seule phrase d'accroche : « Seules les légendes
  apparaissent ici. »
- **Invité ou non connecté** : à la place de la liste, « Rejoins les légendes » (il faut se connecter à son compte
  pour apparaître dans les classements et les consulter), avec « Créer mon compte » (invité, vers `/upgrade`) ou
  « Se connecter » (non connecté), et un lien secondaire. Aucune requête de classement n'est envoyée ; la barre de
  navigation reste affichée.
- **Profil** : points et rang aux points (`get_my_rating` ; « — » pour un invité ou avant la première partie
  classée, avec une phrase qui l'explique), victoires, parties lancées, série actuelle et meilleure série, chacune
  précédée d'une petite icône dessinée en SVG dans la DA (`src/components/stat-icons.tsx` : pion entre deux
  flèches, podium, coupe, drapeau de départ et pion, flamme, flamme et étoile). Les icônes sont masquées aux
  lecteurs d'écran : chaque case est lue « Victoires : 12 ».
- **Fin d'une partie en ligne classée** : sous le message, la variation dans une pastille au trait (« +27 points »,
  « -15 points » ; le signe porte le sens, la couleur menthe ou rose n'est qu'un appoint) et le nouveau total.
  Pendant le calcul : « Calcul des points… » (relecture toutes les 1,5 s par `get_game_rating`, l'écran reste
  utilisable) ; au-delà de 45 s, « retrouve-les bientôt sur ton profil ». Une partie non classée n'affiche rien.

### Points (MMR)

Chaque joueur a des **points**, 0 à la création du compte, qui peuvent devenir négatifs avec un **plancher à -999**.
Ils évoluent après chaque partie en ligne **classée**. Les points d'avant cette version repartent de 0 (pas de
calcul rétroactif).

**Partie classée** : une partie en ligne (rooms, et plus tard matchmaking) avec **au moins 2 joueurs humains au
lancement**, avec ou sans IA. Aucune partie hors ligne ni aucune partie avec un seul humain ne compte. Seuls les
points des humains changent : les IA n'ont pas de points et ne comptent dans aucune moyenne. Un compte supprimé en
cours de partie n'est plus un humain classé.

| Fin de la partie | Gagnant | Humains restants | Humains partis (abandon, forfait) |
| ---------------- | ------- | ---------------- | --------------------------------- |
| Un humain gagne (fin par victoire) | gagne, contre la **moyenne des autres humains** | chacun perd, contre le **gagnant** | chacun perd, contre le **gagnant** |
| Une IA gagne | — | **rien** (ni gain ni perte) | chacun perd, contre la **moyenne des autres humains** |
| Abandons : un seul humain reste, et il gagne (victoire ou dernier en jeu) | gagne, contre la **moyenne des humains partis** | — | chacun perd, contre le **gagnant** |
| Abandons : un seul humain reste, et il perd contre une IA | — | **rien** | chacun perd, contre la **moyenne des autres humains** |
| Plus aucun humain en jeu (partie arrêtée, abandonnée) | partie **non classée** | | |

**Formule** (variante d'Elo, `src/online/rating.ts`) : E = 1 / (1 + 10^((adversaire − moi) / S)) ;
gain = 2 × 30 × (1 − E), perte = 2 × 15 × E, arrondis, **au moins 1 point** dans les deux cas. À niveau égal :
**+30** et **-15**. Contre un adversaire bien plus faible, la victoire rapporte peu et la défaite coûte cher ; contre
un adversaire bien plus fort, l'inverse. Avec plus de 2 humains, le gagnant se mesure à la moyenne des autres
humains et chaque perdant au gagnant. Exemples avec S = 200 : contre un adversaire plus fort de 200 points, victoire
+55 et défaite -3 ; contre un adversaire plus faible de 200 points, victoire +5 et défaite -27.

| Constante (`src/online/rating.ts`) | Valeur | Rôle |
| ---------------------------------- | ------ | ---- |
| `RATING_START` | 0 | points à la création du compte |
| `RATING_FLOOR` | -999 | plancher (aussi dans la base : `rating_floor()`, contrainte `player_stats_mmr_floor`) |
| `RATING_SCALE` (S) | 200 | échelle : un écart de S points donne au plus fort environ 10 chances contre 1 ; plus S est grand, moins les écarts comptent |
| `WIN_POINTS`, `LOSS_POINTS` | 30, 15 | gain et perte à niveau égal |
| `MIN_POINTS` | 1 | gain ou perte minimal |
| `MIN_HUMAN_MOVES` | 10 | coups joués **par des humains** (au total, les coups d'IA ne comptent pas) pour qu'une partie soit classée (aussi `rating_min_human_moves()`) |
| `MAX_RANKED_GAMES_PER_PAIR_PER_DAY` | 3 | parties classées par jour (jour de Paris) entre deux mêmes comptes ; une partie qui dépasserait ce plafond pour une paire de ses humains n'est pas classée (vérifié par la base, `rating_max_pair_games_per_day()`) |

Pour changer une constante partagée avec la base, modifier `src/online/rating.ts` **et** ajouter une migration qui
redéfinit la fonction SQL correspondante, puis redéployer `game-action`.

**Côté serveur uniquement, idempotent** (migration `20261016120000_rating.sql`) :

- l'Edge Function `game-action`, à la fin d'une partie (comme pour `record_game_win`), décide qui gagne ou perd
  (`ratingOutcome`), lit les points actuels, calcule les variations (`ratingChanges`) et appelle
  `record_game_rating(partie, variations)` ; une partie non classée est enregistrée avec sa raison ;
- `record_game_rating` (rôle `service_role` seulement) ne décide **qu'une fois par partie** (table `rating_games`,
  clé primaire), revérifie le nombre d'humains, les coups d'humains (historique de la partie), les joueurs concernés
  et le plafond par paire, **verrouille** les lignes `player_stats` des joueurs (toujours dans le même ordre), puis
  écrit `rating_events` (avant, après, variation ; clé unique partie + joueur) et `player_stats.mmr` ;
- deux parties qui finissent en même temps : si les points ont changé depuis leur lecture, la fonction refuse
  (`rating_conflict`) et l'Edge Function relit et recalcule (3 essais) ; un échec est rattrapé à la demande suivante ;
- les clients ne peuvent rien écrire (ni `player_stats`, ni `rating_events`, ni `rating_games`) ; ils lisent le
  résultat d'une partie (`get_game_rating`, réservé aux joueurs de la partie), leurs points et leur rang
  (`get_my_rating`) et leurs propres variations (`rating_events`, RLS).

Vérifications : `src/online/__tests__/rating.test.ts` (formule, règles, Edge Function) et
`supabase/checks/rating-check.sql` (idempotence, conflits, garde-fous, plancher, lectures, aucune écriture par un
client).

Code : `supabase/migrations/20261003120000_player_stats.sql`, `20261004120000_leaderboards_without_games_started.sql`,
`20261007120000_leaderboards_without_guests.sql` et `20261016120000_rating.sql`, `src/online/rating.ts`, `src/stats/` (appels à Supabase, mise en forme
des classements, jour de Paris et séries, connexion du jour), `src/app/(main)/leaderboard.tsx`,
`src/components/profile-stats.tsx`, `src/components/online/rating-result.tsx`, `src/rooms/use-game-rating.ts`.

Captures : `docs/screenshots/points-1-classement.png` (classement des points, score négatif),
`points-2-profil.png` (points et rang), `points-3-fin-victoire.png` et `points-4-fin-defaite.png` (fin de partie classée).

## Amis

Onglet **Amis** de la barre (`src/app/(main)/friends.tsx`), réservé aux **comptes e-mail**.

- **Liste d'amis** (par défaut) : triée par points, le plus haut d'abord. Chaque ligne : avatar, pseudo, points
  (avec leur signe s'ils sont négatifs) et rang parmi tous les joueurs classés (`points_ranking`) ; un ami sans
  partie classée a un tiret. États de chargement, d'erreur (« Réessayer ») et de liste vide dans la DA.
- **Ajouter un ami** : un champ où l'on saisit un pseudo ; il n'existe aucune liste de tous les joueurs. La recherche
  utilise la clé d'unicité des pseudos (`pseudo_key` après `clean_pseudo`) : « zoe » trouve « Zoé ». Messages :
  pseudo inconnu, c'est toi, déjà amis, demande déjà envoyée, joueur invité, refus récent, trop de demandes
  envoyées. Si l'autre m'avait déjà demandé, la demande croisée nous rend amis tout de suite.
- **Boîte aux lettres** (bouton dessiné : boîte au trait noir, drapeau pastel, enveloppe ; pastille du nombre de
  demandes, « 9+ » au-delà) : les demandes reçues, de la plus récente à la plus ancienne, avec « Accepter » et
  « Refuser » ; « ‹ Mes amis » revient à la liste. Une nouvelle demande, ou une demande acceptée par l'autre,
  apparaît **sans recharger** (Realtime sur `friend_requests` et `friendships`, filtré par la RLS), et tout est relu
  au retour sur l'écran.
- **Retirer un ami** : bouton « × » de la ligne, confirmation avec `ConfirmDialog`.
- **Profil d'un ami** : toucher la ligne d'un ami, ou celle d'une demande reçue, ouvre le profil du joueur (voir
  « Profil d'un joueur ») ; la croix, « Accepter » et « Refuser » sont à côté de la zone tactile et gardent leur
  action.
- **Invité** : « Tes amis t'attendent » et « Créer mon compte » (vers `/upgrade`) ; aucune requête d'amis n'est
  envoyée. Non connecté : « Se connecter ».

**Serveur** (migration `20261018120000_friends.sql`) :

| Règle | Où |
| ----- | -- |
| Comptes e-mail seulement, expéditeur et destinataire (`guest_not_allowed`, `not_eligible`) | `require_email_player`, `send_friend_request` |
| Pas à soi-même, pas de doublon, pas entre amis | `send_friend_request` (+ contraintes `friend_requests_not_self`, `friend_requests_unique`) |
| Demande croisée : amitié | `send_friend_request` (renvoie `accepted`) |
| **10** demandes en attente au plus par destinataire : la plus ancienne est supprimée, la nouvelle arrive en tête | `send_friend_request`, avec verrou des deux profils (`friend_max_pending_received()`) |
| **20** demandes envoyées en attente au plus par joueur (`too_many_sent`) | `send_friend_request` (`friend_max_pending_sent()`) |
| Après un refus, **24 heures** avant de redemander la même personne (`recently_refused`) | `respond_friend_request` note le refus (`friend_request_refusals`), `send_friend_request` le vérifie (`friend_refusal_cooldown()`) |
| Amitié : une ligne par paire, dans l'ordre canonique (`user_a < user_b`) | `friendships` |

- **Lecture** (RLS) : chacun lit les demandes et amitiés qui le concernent ; les refus ne sont lisibles par personne.
  **Aucune écriture directe** : tout passe par `send_friend_request(pseudo)`, `respond_friend_request(id, accepter)`,
  `remove_friend(id)`, `get_friends()` et `get_friend_requests()` (`security definer`, identité vérifiée).
- `get_friends` renvoie l'identifiant de l'amitié (pour la retirer), pseudo, avatar, points, rang et, depuis la
  migration `public_profile`, l'identifiant de l'ami (`user_id`, pour ouvrir son profil) : jamais l'e-mail.
  `get_friend_requests` : identifiant de la demande, pseudo, avatar, date et identifiant de l'expéditeur.
- Suppression du compte : amitiés, demandes et refus suivent (cascade depuis `profiles`).

Code : `src/friends/` (appels, messages, tri, données en direct), `src/components/friends/mailbox-button.tsx`.
Vérifications : `src/friends/__tests__/`, `src/components/__tests__/friends-screen.test.tsx` et
`supabase/checks/friends-check.sql` (RLS, aucune écriture directe, invités refusés, recherche sans accents,
demande croisée, limite de 10 et remplacement, limite de 20, délai après refus, suppression du compte).
Captures : `docs/screenshots/amis-1-liste.png`, `amis-2-demandes.png`, `amis-3-ajout.png`, `amis-4-invite.png`.

## Profil d'un joueur

Écran **`/player/[id]`** (`src/app/player/[id].tsx`), par-dessus le groupe `(main)` : sans barre de navigation,
avec un seul bouton « ‹ Retour », comme `/profile`. On l'ouvre en touchant une ligne :

- du **classement** (toutes les lignes ; la ligne « C'est toi » mène directement à `/profile`) ;
- de la **liste d'amis** et des **demandes d'ami reçues** (la croix, « Accepter » et « Refuser » gardent leur action).

Chaque ligne cliquable est un bouton d'au moins 44 points de haut (toute la ligne au classement, avatar et pseudo
chez les amis), libellé « Profil de Zoé » pour les lecteurs d'écran, suivi du détail (« 3e place, Zoé, 120 points »).
Elle se teinte de citron pâle quand on la touche. Si le serveur n'envoie pas encore d'identifiant (migration pas
appliquée), la ligne reste affichée mais ne s'ouvre pas. Logique : `src/navigation/player.ts`.

**Contenu** (`src/components/player/public-profile-view.tsx`, mêmes cartes et cases que le profil :
`StatsCard`, `StatTile`) : avatar, pseudo, puis **un seul** bouton d'amitié selon la relation :

| Relation | Bouton | Après |
| -------- | ------ | ----- |
| pas amis, aucune demande | « Envoyer une demande d'ami » (`send_friend_request` avec son pseudo ; messages d'erreur habituels : refus récent de 24 h, trop de demandes…) | « Demande envoyée » (ou amis tout de suite si l'autre avait déjà demandé) |
| demande envoyée par moi | « Demande envoyée » (désactivé) | — |
| demande reçue de lui | « Accepter » et « Refuser » (`respond_friend_request`) | amis, ou pas amis |
| déjà amis | « Retirer des amis », avec confirmation (`ConfirmDialog`) | pas amis |

Après chaque action, le profil est relu (relation à jour, de l'autre côté aussi) ; si la relecture échoue, l'écran
passe à l'état attendu. Puis les statistiques publiques : **points, rang aux points, victoires, plus longue série**.

- **Rien de privé** : ni « Se déconnecter », ni « Supprimer mon compte », ni changement de pseudo, ni éditeur
  d'avatar, ni « Créer mon compte », ni parties lancées ou série actuelle.
- **Son propre identifiant** : redirection vers `/profile` (`Redirect` d'Expo Router).
- **Invité** (par un lien) : « Crée ton compte » et le bouton « Créer mon compte » (vers `/upgrade`), sans requête ;
  il n'a de toute façon ni classement ni amis. Non connecté : « Se connecter ».
- **Joueur inconnu ou invité** : « Joueur introuvable ». Erreur réseau : « Réessayer ».

**Serveur** (migration `20261022120000_public_profile.sql`) :

- `get_public_profile(p_user uuid)` (`security definer`, réservée aux comptes e-mail connectés : `guest_not_allowed`
  pour un invité, refusée à `anon`) renvoie pseudo, avatar, points, rang (null avant la première partie classée),
  victoires, plus longue série et la relation : `self`, `friends` (avec `friendship_id`), `request_sent`,
  `request_received` (avec `request_id`) ou `none`. Joueur inconnu ou invité : `player_not_found`, la même erreur
  dans les deux cas. **Jamais** l'e-mail, les parties lancées ni aucune autre donnée privée.
- **Pas d'énumération** : la fonction ne liste ni ne cherche de joueurs ; elle lit un identifiant déjà connu (venu
  du classement, de la liste d'amis ou d'une demande).
- `get_leaderboards`, `get_friends` et `get_friend_requests` renvoient en plus `user_id`, **en dernière colonne** :
  les anciennes colonnes gardent leur nom et leur ordre, l'application déjà installée continue de fonctionner. Changer
  le type de retour d'une fonction impose de la supprimer puis de la recréer : les `revoke` et `grant` d'origine sont
  refaits. Les clients ne peuvent toujours rien écrire directement.

Code : `src/players/` (appel à `get_public_profile`, relation, état de l'écran), `src/navigation/player.ts`.
Vérifications : `src/components/__tests__/player-screen.test.tsx` (chaque relation, boutons privés absents,
redirection, invité, joueur introuvable), `src/players/__tests__/`, `src/navigation/__tests__/player.test.ts`, les
tests des écrans Amis et Classements (lignes cliquables, croix, Accepter et Refuser intacts, numéro de position) et
`supabase/checks/public-profile-check.sql`.
Captures : `docs/screenshots/joueur-1-profil.png` (pas amis), `joueur-2-demande-envoyee.png`,
`joueur-3-demande-recue.png`, `joueur-4-amis-retirer.png` (confirmation), `joueur-5-classement.png` (numéro sur
chaque ligne, podium compris), `joueur-6-classement-bas.png` (« Tu es 61e »), `joueur-7-invite.png` (invité).

## Barre de navigation

Une barre dessinée en bas de l'écran, dans la DA (trait noir épais, ombre franche) :

- à gauche **Amis** : deux silhouettes au trait noir, épaule contre épaule, têtes en pions pastel ; l'écran
  `/friends` est décrit dans « Amis » ;
- au milieu **Accueil** : le logo (l'étoile de `assets/icon-source/icon.svg`, redessinée en SVG avec un pion pastel
  par branche), un peu plus grand et qui dépasse de la barre ;
- à droite **Classements** : une montagne au trait noir, un pion pastel sur chaque sommet.

L'entrée active a son icône entourée d'un trait et son libellé en gras souligné : elle se repère sans la couleur.
Zones touchables d'au moins 44 points, libellés « Amis », « Accueil », « Classements » (rôle « onglet » et état
« sélectionné »), zone sûre du bas prise en compte (la barre la gère, les écrans au-dessus ne la comptent pas). Sur
grand écran, la barre reste en bas, centrée, 440 points au plus. Sur Android, elle se cache clavier ouvert.

**Profil par l'avatar** : la barre n'a plus d'entrée Profil. En haut à droite de l'accueil, des amis et des
classements, l'avatar du joueur (`<Avatar />` dans un cercle au trait noir, ombre franche, zone tactile d'au
moins 44 points, libellé « Profil » ; `src/components/profile-button.tsx`) ouvre `/profile` par-dessus ; non
connecté, une silhouette dessinée ouvre la connexion. Un invité qui touche son avatar voit son profil (carte
« Créer mon compte »…). Pas d'avatar pendant les parties ni dans les rooms (ni barre ni accès au profil).

**Routes** : les écrans avec la barre sont dans le groupe `src/app/(main)/` : accueil, jouer en ligne, contre l'IA,
entre amis (local), amis et classements (le layout empile une pile Expo Router au-dessus de la barre). Tout le reste
est dans la pile principale, **par-dessus** le groupe, donc sans barre (rien à maintenir pour la masquer) :

- les parties (`/game`) et les rooms (`/room/[id]`), avec leurs propres boutons ;
- le profil (`/profile`), le profil d'un autre joueur (`/player/[id]`), les écrans de compte (`/sign-in`, `/sign-up`, `/upgrade`, `/forgot-password`,
  `/reset-password`, et `/auth/confirmed` sans bouton de retour), l'éditeur d'avatar
  (`/avatar`) et les pages d'information (`/credits`, `/privacy`, `/terms`) : **un seul bouton, « ‹ Retour »**
  (`src/components/back-button.tsx`).

Le bouton de retour revient à l'écran d'où l'on vient (historique de navigation, `goBack`). Sans historique (page
rechargée, lien direct), `src/navigation/back.ts` utilise un écran de secours : le **profil** pour l'éditeur
d'avatar, les écrans de compte et les pages d'information, l'accueil sinon (profil compris). « Amis » et
« Classements » ne sont actives que sur leur écran ; toucher une entrée revient à l'accueil (`dismissTo`), empile
depuis l'accueil, ou remplace l'écran courant d'une entrée à l'autre (`src/navigation/nav-bar.ts`, testé, avec des
tests qui vérifient quels écrans sont dans `(main)`, lesquels sont par-dessus, lesquels ont l'avatar, et le retour
de secours).

### Se déconnecter

Le profil a un bouton « Se déconnecter » (`DrawnButton`), l'accueil garde « Déconnexion » : les deux passent par
le même hook, `useSignOut` (`src/auth/use-sign-out.ts`, testé). Après la déconnexion : retour à l'accueil, non
connecté. Un compte **e-mail** se déconnecte aussitôt. Pour un compte **invité**, la déconnexion est définitive
(on ne le retrouve pas) : une confirmation (`ConfirmDialog`, avec un troisième choix facultatif) l'explique et
propose « Créer mon compte » pour garder la progression, « Rester connecté » ou « Se déconnecter quand même ».
Une erreur (réseau…) donne un message en français ; le joueur reste connecté et l'écran n'est pas bloqué.

### Champ de mot de passe

`DrawnTextInput` a une option `revealable` (connexion, inscription et création de compte d'un invité, via
`AccountForm`) : mot de passe masqué par défaut, avec à droite un œil (`src/components/eye-icon.tsx`, SVG au trait
noir épais arrondi et pupille pastel, comme les icônes de la barre ; œil ouvert = « Afficher », barré =
« Masquer »). C'est un vrai bouton : zone d'au moins 44 points, rôle bouton, libellé « Afficher le mot de passe » /
« Masquer le mot de passe » qui suit l'état. Il ne valide pas le formulaire ; sur le web, `mousedown` est annulé
pour que le champ garde le focus et le curseur, et sur mobile le focus et la sélection sont rétablis après le
changement de mode. `autoComplete` et `textContentType` ne sont pas touchés (gestionnaires de mots de passe), et
la correction automatique, la majuscule et le correcteur orthographique sont coupés.

## Avatars (Humation)

Chaque joueur a un avatar dessiné au trait noir, dans le style de l'application, tiré du jeu d'illustrations
[Humation 1](https://github.com/humation-labs/humation) (licence MIT) : 24 coiffures, 8 hauts, 43
accessoires et 3 paires de lunettes.

### `@humation/react` ou `@humation/core` ?

`@humation/react` **ne fonctionne pas en React Native** : son composant `<Avatar>` rend une balise DOM `<svg>`
et injecte le dessin avec `dangerouslySetInnerHTML`, deux choses qui n'existent qu'avec un navigateur. Ses
couleurs passent en outre par des variables CSS (`fill="var(--hm-hair, #000000)"`), que `react-native-svg`
ne sait pas lire.

On utilise donc **`@humation/core`** (le moteur, sans dépendance) et **`@humation/assets-humation-1`**
(les illustrations, embarquées dans l'application : aucun accès réseau) :

1. `@humation/core` compose le SVG de l'avatar à partir des morceaux choisis (`src/avatar/avatar.ts`) ;
2. on remplace les variables CSS par les couleurs choisies et on retire ce qui ne sert pas (attributs
   `data-hm-*`, styles) ;
3. le composant `<Avatar />` (`src/components/avatar.tsx`) affiche ce SVG avec `SvgXml` de
   `react-native-svg`, qui fonctionne sur iOS, Android et le web.

Les versions sont fixées (`1.0.3`) : un avatar tiré d'une graine dépend de la liste des morceaux du paquet.
Les illustrations ajoutent environ 0,8 Mo au bundle Hermes.

### Ce qui est en place

- **Profil** (`/profile`, en touchant son avatar en haut à droite de l'accueil, des amis ou des classements) :
  avatar, pseudo (et son changement), type de compte et statistiques.
- **Éditeur** (`/avatar`) : coiffure, haut, accessoire, lunettes (chaque vignette montre l'option sur
  son propre avatar), couleurs de la peau, des cheveux, du haut et du fond, boutons « Au hasard » et
  « Par défaut ». Le bas (pantalons, jupes) existe dans Humation mais se trouve sous le cadrage « buste »
  des avatars : il n'est donc pas proposé.
- **Enregistrement** dans `profiles.avatar`, en JSON :
  `{"v":1,"selections":{"head":"hm1-p-000020",…},"colors":{"skin":"F3C9A6",…},"background":"FDECF1"}`
  (identifiants canoniques des morceaux, couleurs hexadécimales sans « # »). Une simple graine est aussi
  acceptée. Sans avatar enregistré, il est tiré de l'identifiant du joueur : chacun en a un dès l'inscription.
- **Affichage** : accueil, profil, salle d'attente, bandeau des joueurs et « Au tour de » pendant une partie
  en ligne (avatar sur fond de la couleur des pions du joueur), et partie locale contre l'IA. Les IA ont
  un avatar tiré au hasard, toujours avec des antennes.
- **Sécurité** : l'avatar d'un autre joueur est relu avec prudence (morceaux inconnus et couleurs non
  hexadécimales ignorés), rien de ce qu'il contient n'est injecté tel quel dans le SVG. La base limite
  sa taille à 1 000 caractères.

Tests : `src/avatar/__tests__/` vérifie la relecture de l'avatar, le rendu des couleurs, et fait lire chacun
des 86 morceaux par le parseur XML de `react-native-svg`, celui qu'utilise `SvgXml` sur mobile.

## Traductions

L'application parle **français** (langue de référence), **anglais**, **allemand** et **espagnol**. Ton des textes :
tutoiement en français, et l'équivalent décontracté ailleurs (« you » familier, « du », « tú »).

### Comment ça marche

- **Bibliothèque** : aucune, une solution maison de quelques fonctions (`src/i18n/`). Raisons : clés et variables
  vérifiées par `tsc` sans configuration, aucun `Intl.PluralRules` (absent de Hermes : i18next demanderait un
  polyfill), rien à ajouter au paquet, compatible React Native Web, rendu statique et React Compiler.
- **Messages** : un fichier par langue, `fr.ts`, `en.ts`, `de.ts`, `es.ts`, des clés à plat (`'game.move'`).
  **Le français est la source** : le type des autres langues (`Messages`) vient de `fr.ts`, donc une clé manquante
  ou en trop dans `en.ts`, `de.ts` ou `es.ts` est une erreur de `tsc`. Un test vérifie en plus que chaque langue a
  exactement les mêmes variables (`{n}`, `{name}`…) et balises (`<link>…</link>`) que le français
  (`src/i18n/__tests__/messages.test.ts`).
- **Dans un écran** : `const t = useT();` puis `t('game.move', { n: 3 })`. Les variables sont typées : oublier `n`
  ne compile pas. Chaque composant qui affiche du texte appelle `useT()` lui-même : l'identité de `t` change avec la
  langue, et les fonctions qui le reçoivent (`formatRank(t, rang)`) sont recalculées même mémoïsées par le React
  Compiler. Pas de `t` global dans les composants.
- **Pluriels** : `{ one: '{count} victoire', other: '{count} victoires' }`, appelé avec `{ count }`. Français : 0
  et 1 au singulier ; anglais, allemand, espagnol : 1 seulement (`pluralForm`).
- **Nombres, rangs, dates** : les nombres des variables sont écrits par `Intl.NumberFormat` dans la locale active
  (« 1 500 », « 1,500 », « 1.500 ») ; les rangs par `formatOrdinal` (« 1er », « 1st », « 1. », « 1.º ») ; les dates
  par `formatDay` et `formatTime` (`Intl.DateTimeFormat`, « 1er » en français).
- **Messages gardés pour plus tard** (notice affichée sur l'écran suivant, erreur de champ) : `msg('clé', {…})`,
  traduit à l'affichage par `t.msg(…)`. Les erreurs du serveur sont gardées brutes et traduites à l'affichage à
  partir de leur **code** (`describeOnlineError(t, e)`, `describeAuthError(t, e)`, `describeFriendError(t, e)`,
  `describeLeaderboardError(t, e)`) : un changement de langue les traduit aussi, et aucun texte du serveur n'est
  affiché. Les fonctions SQL lèvent des codes courts ; les Edge Functions renvoient `{ ok: false, code, message }` :
  `message` (en français, pour les journaux et les versions déjà installées de l'application) n'est plus affiché.
- **Texte avec un lien** : `rich(t('signIn.guestWarning'), { link: (texte) => <Link …>{texte}</Link> })`.
- **Choix de la langue** (`src/i18n/language.ts`) : préférence enregistrée par le joueur (AsyncStorage,
  `halma.language`), sinon langue de l'appareil ou du navigateur (`expo-localization`, la première que
  l'application parle), sinon le français. Sur mobile, l'écran de démarrage attend la relecture de la préférence ;
  la langue de l'appareil est relue au retour au premier plan (Android permet de la changer sans relancer).
- **Sélecteur** (`src/components/language-picker.tsx`) : sur le profil (connecté, invité ou non) et sur l'écran de
  connexion ; chaque langue écrite dans sa propre langue. Le changement s'applique tout de suite, sans redémarrer.
- **Web** : le HTML exporté est en français (`<html lang="fr">`) ; l'hydratation se fait en français (pas d'écart),
  puis l'application passe à la langue du joueur et met à jour `document.documentElement.lang`, le titre de
  l'onglet, la description et `og:locale` (`PageHead`).
- **Compte** : la langue affichée est enregistrée sur le compte connecté (invité compris) dès qu'elle diffère :
  colonne privée `profiles.language` (migration `profile_language`, fonctions `set_my_language` et `my_language` ;
  les autres joueurs ne la voient pas) et métadonnée `user_metadata.language`, que lisent les modèles d'e-mails
  (voir « E-mails d'authentification » et `docs/emails/README.md`).
- **Pages légales** : une version par langue (`PRIVACY_DOCS`, `TERMS_DOCS` dans `src/legal/`), même structure ; le
  français fait foi, les traductions sont à faire relire (champs `[TO BE COMPLETED]`, `[ZU ERGÄNZEN]`,
  `[POR COMPLETAR]`).
- **Tests** : l'appareil simulé est en français (`jest.setup.ts`) ; les tests d'autres langues prennent
  `translator('en')` ou changent la langue (`applyLanguage('de')`, voir `src/i18n/__tests__/screens.test.tsx`).

### Ajouter une clé

1. L'ajouter dans `src/i18n/fr.ts` (au bon endroit, par écran).
2. `npx tsc --noEmit` signale les trois autres fichiers : y ajouter la traduction (mêmes variables).
3. L'utiliser avec `t('ma.cle', { … })`.

### Ajouter une langue

1. L'ajouter à `LANGUAGES`, `LANGUAGE_NAMES` (son nom dans sa langue) et `LANGUAGE_LOCALES` (`src/i18n/types.ts`).
2. Créer `src/i18n/<code>.ts` (`export const xx: Messages = { … }`, `tsc` guide jusqu'à la dernière clé), et
   l'ajouter à `MESSAGES` (`translate.ts`), avec ses règles dans `pluralForm` et `formatOrdinal` si besoin.
3. Pages légales : une version dans `src/legal/privacy.ts` et `terms.ts`, et sa marque dans `PLACEHOLDER_MARKERS`
   et `PLACEHOLDER` (`document.ts`).
4. E-mails : les trois sources `docs/emails/<modèle>.<code>.html`, la langue dans `OTHER_LANGUAGES`
   (`scripts/email-templates.cjs`), puis `node scripts/email-templates.cjs`.
5. Base : la liste des langues de `profiles_language_check` et de `set_my_language` (nouvelle migration).

### Ce qui n'est pas traduit

- Pseudos, codes de room, noms de licences et de bibliothèques, textes des licences (en anglais d'origine).
- Les raisons détaillées d'un coup refusé par le moteur (`src/game/`) et les messages des Edge Functions : ils ne
  servent qu'aux journaux (l'écran affiche le texte du code d'erreur).
- Les messages pour développeurs (`EXPO_PUBLIC_SUPABASE_URL` manquante…).

## Interface : conventions

- **Police** : [Fredoka](https://github.com/hafontia/Fredoka-One) (SIL Open Font License 1.1), ronde et ludique
  comme les avatars, lisible en petit avec tous les accents. Trois graisses (400, 600, 700), environ 50 Ko
  chacune, chargées avec `expo-font` depuis `@expo-google-fonts/fredoka` (une importation par graisse, pour ne pas
  embarquer les cinq). L'écran de démarrage reste affiché jusqu'au chargement ; en cas d'échec ou au-delà de
  4 s, l'application s'affiche avec la police système (`src/hooks/use-app-fonts.ts`). Chaque graisse est une
  famille à part : on change de graisse avec `Fonts.bold` et non `fontWeight` (le web inventerait un faux
  gras). Candidats écartés : Baloo 2 (420 Ko par graisse, interligne très haut) et Nunito (très lisible mais
  moins ludique).

- **DA** : noir et blanc, trait noir épais, ombres franches décalées ; seuls les pions (et les avatars) sont
  en couleurs pastel. Toutes les couleurs, tailles et durées viennent de `src/constants/theme.ts`.
- **Boutons** (`DrawnButton`) : `busy` pendant une action (roue d'attente, pas de double envoi) et
  `disabled` (trait en pointillés, texte gris lisible : jamais de transparence qui ferait chuter le
  contraste). Au survol de la souris, le bouton se soulève un peu.
- **Chargement et erreurs** : `LoadingState` (trois pions qui sautent) et `ErrorState` (message et
  « Réessayer ») dans `src/components/state-view.tsx`, utilisés par les écrans qui lisent le serveur
  (profil, avatar, jeu en ligne, room, classements). Un profil illisible (réseau) se réessaie depuis l'accueil.
- **Erreur inattendue** : `src/app/_layout.tsx` exporte un `ErrorBoundary` (écran « Oups, un pion est tombé »,
  `src/components/error-screen.tsx`) avec « Réessayer » et « Retour à l'accueil » : jamais d'écran blanc.
- **Animations** (Reanimated) : fondu et zoom de l'écran de fin, fondu des messages, arrivée et départ des
  joueurs dans la salle d'attente, changement de tour, pion animé le long de son chemin, halo du joueur courant.
  Toutes suivent le réglage « Réduire les animations » du système (le pion arrive alors directement, le halo
  reste immobile).
- **Accessibilité** :
  - zones touchables d'au moins 44 points (`TouchTarget`) : boutons, choix de niveau, onglets et couleurs de l'éditeur d'avatar ;
  - contrastes vérifiés par un test (`src/constants/__tests__/theme.test.ts`) : texte noir sur blanc et sur tous
    les pastels (≥ 7:1), texte gris sur blanc et sur les teintes pâles (≥ 4,5:1) ;
  - libellés et rôles pour les lecteurs d'écran (boutons, onglets, choix, joueurs de la partie, chargement) ;
  - web : `lang` de la page selon la langue active (voir « Traductions »), anneau de focus noir bien visible au
    clavier (`src/app/+html.tsx`).
  - Limite connue : le plateau lui-même n'est pas jouable au lecteur d'écran (121 cases sans libellé).
- **Grand écran** (à partir de 900 points de large : tablette, ordinateur) : l'accueil passe en deux colonnes
  (plateau à gauche), les parties affichent un panneau latéral (tour, joueurs, actions) à côté d'un grand
  plateau (`src/components/game-layout.tsx`), l'éditeur d'avatar garde l'aperçu à gauche. Les formulaires
  restent sur une colonne centrée.

## Publication (EAS Build)

La compilation se fait dans le cloud avec [EAS Build](https://docs.expo.dev/build/introduction/) : ni Xcode
ni Android Studio en local.

### Profils (`eas.json`)

| Profil | Pour quoi | Sortie |
| ------ | --------- | ------ |
| `development` | développement avec le client de développement (`expo-dev-client`) | simulateur iOS, APK Android |
| `development-device` | idem, sur un iPhone réel | build iOS interne (appareil enregistré) |
| `preview` | faire tester l'application (distribution interne) | APK Android, build iOS interne |
| `production` | publication sur l'App Store et Google Play | AAB Android, build iOS de l'App Store |

Le numéro de build est géré par EAS (`appVersionSource: remote`) et augmenté à chaque build de production.

### Première fois

```bash
npx eas-cli@latest login
npx eas-cli@latest init            # crée le projet EAS et ajoute son identifiant dans app.json
```

Les identifiants de l'application sont `com.matth.halma` (iOS `bundleIdentifier`, Android `package`,
dans `app.json`). **Les changer avant la première publication** si besoin : ils sont définitifs sur les stores.

Les variables Supabase et `EXPO_PUBLIC_SITE_URL` sont lues au moment de la compilation. Les définir pour chaque environnement EAS
(`development`, `preview`, `production`), avec la visibilité « plaintext » puisqu'elles sont publiques :

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://….supabase.co --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value … --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SITE_URL --value https://halma-game.com --visibility plaintext
```

### Compiler et publier

```bash
npx eas-cli@latest build --profile development --platform all   # client de développement
npx eas-cli@latest build --profile preview --platform android    # APK à partager
npx eas-cli@latest build --profile production --platform all     # versions des stores
npx eas-cli@latest submit --profile production --platform all    # envoi aux stores
```

Pour l'envoi, EAS demande les accès (compte Apple Developer, clé de service Google Play) à la première
utilisation ; rien n'est stocké dans le dépôt.

### Icônes

Icône, icône adaptative Android (premier plan, fond blanc, version monochrome pour les icônes à thème),
écran de démarrage et favicon sont dans `assets/images/`. Leurs sources SVG sont dans `assets/icon-source/` :
l'étoile au trait noir avec trois pions pastel dans chaque branche, dessinée plus simplement que le plateau
pour rester lisible à 48 pixels.

## Déploiement du site (Cloudflare Pages)

Le site `https://halma-game.com` est la version web de l'application (export statique d'Expo Router,
`web.output: "static"` dans `app.json`), hébergée sur [Cloudflare Pages](https://pages.cloudflare.com) et
reliée au dépôt GitHub : chaque poussée sur la branche de production le reconstruit. Il sert à jouer dans le
navigateur, aux pages légales publiques et aux **liens des e-mails** (validation du compte, mot de passe oublié).

### Réglages du projet Cloudflare Pages

*Workers & Pages → Create → Pages → Connect to Git*, choisir le dépôt, puis :

| Réglage | Valeur |
| ------- | ------ |
| Framework preset | `None` |
| Build command | `npx expo export --platform web` |
| Build output directory | `dist` |
| Root directory | (vide : racine du dépôt) |
| Node.js | 22 (fichier `.node-version` du dépôt ; sinon variable `NODE_VERSION=22`) |

Variables d'environnement (*Settings → Variables and Secrets*, pour *Production* et *Preview*), lues au moment
de la compilation et intégrées dans le site (valeurs publiques, en texte simple) :

| Variable | Valeur |
| -------- | ------ |
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase (`https://….supabase.co`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clé `anon` ou `publishable` (**jamais** la clé `service_role`) |
| `EXPO_PUBLIC_SITE_URL` | `https://halma-game.com` (sans barre finale) |

Sans les deux variables Supabase, le site se construit mais les comptes et les liens des e-mails affichent
« Comptes indisponibles ». Les mêmes valeurs vont dans l'environnement EAS `production` (avec
`EXPO_PUBLIC_SITE_URL`) pour que l'application mobile envoie des liens https.

**Domaine** : *Custom domains → Set up a custom domain*, `halma-game.com` (la zone est déjà chez Cloudflare :
l'enregistrement DNS est créé tout seul) ; ajouter aussi `www.halma-game.com` si on veut, avec une redirection
vers `halma-game.com` (*Rules → Redirect Rules*). Ne pas toucher aux enregistrements MX d'Email Routing ni à
ceux de Brevo.

**Supabase** : *Authentication → URL Configuration*, *Site URL* `https://halma-game.com` et *Redirect URLs*
`https://halma-game.com/**` (détails dans « E-mails d'authentification : réglages Supabase »). Les modèles
d'e-mails de `docs/emails/` ne changent pas : `{{ .RedirectTo }}` vaut désormais l'adresse https du site.

### Ce que produit l'export

`npx expo export --platform web` écrit `dist/` (ignoré par git) : une page HTML par route, déjà remplie (texte,
styles, titre et description), le JavaScript dans `_expo/static/js/web/entry-<empreinte>.js`, les polices et
images dans `assets/…<empreinte>.ttf|png`, et une copie du dossier `public/`. Routes générées :

| Adresse | Fichier |
| ------- | ------- |
| `/` | `index.html` (accueil) |
| `/online`, `/friends`, `/leaderboard`, `/ai-setup`, `/local-setup` | `online.html`… (aussi en double sous `(main)/`, le groupe de la barre de navigation) |
| `/game`, `/matchmaking`, `/profile`, `/avatar` | `game.html`… |
| `/sign-in`, `/sign-up`, `/upgrade`, `/forgot-password` | `sign-in.html`… |
| `/reset-password`, `/auth/confirmed` | `reset-password.html`, `auth/confirmed.html` (liens des e-mails) |
| `/privacy`, `/terms`, `/credits` | `privacy.html`, `terms.html`, `credits.html` (pages publiques, sans compte) |
| `/room/:id`, `/player/:id` | l'accueil (repli monopage), puis Expo Router affiche la bonne route (`room/[id].html` et `player/[id].html` existent dans `dist/` mais ne sont pas servis à ces adresses) |
| (route inconnue) | `+not-found.html` ; `_sitemap.html` (liste des routes, générée par Expo Router) |

Cloudflare Pages sert `privacy.html` à l'adresse `/privacy` (et redirige `/privacy.html` vers `/privacy`).

### Fichiers de `public/`

Copiés tels quels dans `dist/` par l'export, lus par Cloudflare Pages :

- **Pas de `_redirects`** : une règle de réécriture vers `room/[id]` est renvoyée par Cloudflare en redirection
  vers `/room/%5Bid%5D`, qui boucle (les crochets du nom de fichier). Les adresses dynamiques
  (`/room/ABC123`, `/player/<id>`) passent par le repli « application monopage » de `wrangler.jsonc`.
- **`_headers`** : pages HTML revalidées à chaque visite (`Cache-Control: no-cache`, réponse 304 si rien n'a
  changé), ressources versionnées (`/_expo/static/*`, `/assets/*`, empreinte dans le nom) en cache un an
  (`immutable`), `X-Frame-Options: DENY`, et `X-Robots-Tag: noindex` sur les adresses de prévisualisation
  `*.pages.dev`.

Le fichier **`wrangler.jsonc`** (à la racine) règle le déploiement : dossier `dist/`, et
`not_found_handling: "single-page-application"` : pour une adresse sans page exportée, Cloudflare sert
l'accueil (code 200), et Expo Router affiche la bonne route (room, joueur, ou sa page « introuvable ») une fois
chargé. Dans Cloudflare (*Workers & Pages → halma → Settings → Build*), la commande de déploiement est
`npx wrangler deploy`. Pour une vraie réponse 404, on pourra utiliser comme commande de build
`npx expo export --platform web && cp dist/+not-found.html dist/404.html` et `"404-page"` à la place du mode
monopage.

### Titre, description et aperçus de liens

`src/app/+html.tsx` donne `lang="fr"` et les balises communes (`og:site_name`, `og:type`, `og:locale`,
`twitter:card`). Le titre, la description, `og:title`, `og:description`, `og:url`, `og:image` (l'icône
`assets/images/icon.png`) et le lien canonique viennent de `<PageHead>` (`src/components/page-head.tsx`, avec
`<Head>` d'Expo Router, écrit dans le HTML statique en SDK 57) : valeurs par défaut dans la mise en page racine,
remplacées par chaque écran de compte et page de texte (« Politique de confidentialité · Halma »…). Les
adresses absolues demandent `EXPO_PUBLIC_SITE_URL`.

### Vérifier en local

```bash
npx expo export --platform web --clear
npx expo serve
```

Pour essayer aussi `_headers` et le repli monopage comme sur Cloudflare, l'émulateur de Cloudflare :
`npx wrangler dev` (lit `wrangler.jsonc`).

## Production

Checklist de publication complète : [`docs/PUBLICATION.md`](docs/PUBLICATION.md).

### Suppression de compte

Obligatoire sur l'App Store et Google Play : **Profil → Compte → Supprimer mon compte**, avec une confirmation
qui détaille ce qui sera perdu. L'application appelle l'Edge Function `delete-account`
(`supabase/functions/delete-account/`, logique dans `src/online/account.ts`), qui ne lit que le jeton : on ne
peut supprimer que son propre compte.

1. Le joueur abandonne chacune de ses parties en cours (comme avec « Abandonner »).
2. Le compte est supprimé avec la clé `service_role` (`auth.admin.deleteUser`) ; si un abandon échoue (base
   indisponible), rien n'est supprimé et le joueur peut réessayer.
3. La base fait le reste (trigger `before delete` sur `profiles`, migration `account_deletion_and_limits`), même
   pour une suppression faite depuis le tableau de bord Supabase :

| Donnée | Ce qui se passe |
| ------ | --------------- |
| Profil, avatar, e-mail | supprimés |
| `player_stats`, `stats_wins` | supprimés : le joueur disparaît des classements |
| Salle d'attente | le joueur la quitte ; s'il était hôte, l'hôte passe au joueur humain suivant ; sans autre humain, la room est supprimée |
| Partie en cours ou finie | sa place reste (ordre du tour, couleurs) avec « Compte supprimé » (`user_id` null) ; il est forfait (l'arbitre déclare aussi forfait une telle place au prochain `tick`) ; l'hôte passe au joueur humain suivant, ou la room est supprimée s'il n'en reste aucun |
| Victoires des autres | inchangées ; une partie gagnée par un compte supprimé ne compte pour personne |

### Pages légales

`/privacy` (politique de confidentialité) et `/terms` (conditions d'utilisation), accessibles depuis le profil
(connecté ou non) et depuis la page des crédits (lien « Crédits » à côté du titre de l'accueil). Sur le site, elles
s'ouvrent sans compte à une adresse stable (`https://halma-game.com/privacy`, `/terms`, `/credits`), utilisable
dans les fiches des stores. **Ce sont des brouillons à faire relire** : un bandeau le signale. Il reste deux
champs `[À COMPLÉTER : …]` : le nom complet et le statut de l'éditeur (« Matth » pour l'instant), et les pays où
Brevo et Cloudflare traitent les données (transferts hors de l'UE). Le contact est `contact@halma-game.com`
(`src/legal/contact.ts`), l'âge minimum est de 15 ans, la région Supabase est eu-west-1 (Irlande) ; la politique
nomme les trois prestataires (Supabase : données ; Brevo : envoi des e-mails ; Cloudflare : site et réception des
e-mails). Un test vérifie qu'aucune autre coordonnée n'y est inventée.

### Crédits et licences

`/credits`, depuis l'accueil (lien « Crédits » à côté du titre) et le profil : Humation (projet, auteurs, dépôt, texte complet de la licence MIT
avec son avis de copyright : la licence exige de les joindre aux copies, et les illustrations sont embarquées),
la police Fredoka (licence SIL OFL 1.1 et son avis de copyright) et les principales bibliothèques. Les données
viennent de `src/credits/licenses.json`, généré depuis `node_modules` :

```bash
npm run licenses              # régénère le fichier (après une mise à jour des dépendances)
npm run licenses -- --check   # échoue s'il n'est plus à jour (aussi vérifié par npm test)
```

### Nettoyage des rooms abandonnées

`cleanup_abandoned_rooms()` (migration `cleanup_abandoned_rooms`) supprime les salles d'attente sans signe de vie
d'un humain depuis 1 jour, les parties en cours sans signe de vie depuis 7 jours et les rooms finies depuis
30 jours (les statistiques déjà comptées restent). Depuis la migration `matchmaking`, elle supprime aussi les rooms
de matchmaking jamais lancées (10 minutes après l'heure prévue) et retire de la file les joueurs absents. La migration la planifie toutes les heures avec **pg_cron**
(tâche `halma-cleanup-abandoned-rooms`, à la minute 17). Si l'extension n'était pas disponible (message
« pg_cron indisponible » à l'exécution), l'activer dans *Integrations → Cron* du tableau de bord, puis :

```sql
select cron.schedule('halma-cleanup-abandoned-rooms', '17 * * * *', 'select public.cleanup_abandoned_rooms()');
select * from cron.job;                                            -- vérifier
select * from cron.job_run_details order by start_time desc limit 5; -- dernières exécutions
```

### Limites d'abus

Ce que fait le code :

- 10 codes de room inconnus au plus par joueur en 10 minutes (`join_room`, table `room_join_failures`),
  puis « Trop de codes essayés » ;
- une seule room active par joueur (`create_room`, `join_room`), puis « Tu es déjà dans une room » (voir
  « Une seule room active ») ;
- toutes les écritures passent par des fonctions SQL ou des Edge Functions qui vérifient chaque demande.

À régler dans le tableau de bord Supabase (rien dans le dépôt ; les noms de menus peuvent changer) :

- **Limites de débit** : *Authentication → Rate Limits* ; baisser en particulier *Anonymous sign-ins* (connexions
  invité par heure et par adresse IP), et garder des valeurs basses pour les connexions et inscriptions.
- **Captcha** : *Authentication → Attack Protection → Enable Captcha protection* (hCaptcha ou Cloudflare
  Turnstile). Attention : une fois activé, Supabase exige un jeton de captcha pour l'inscription, la connexion
  et la connexion invité ; il faut alors ajouter le widget dans l'application (`options.captchaToken` de
  `signUp`, `signInWithPassword` et `signInAnonymously`), ce qui n'est pas encore fait.

Les classements restent sans garde-fou (choix assumé, voir « Statistiques et classements »).

### Dépendances

- Retirées car inutilisées : `@expo/ui`, `expo-device`, `expo-glass-effect`, `expo-image`, `expo-symbols`,
  `expo-web-browser`. `depcheck` signale encore `expo-dev-client` (builds de développement),
  `expo-system-ui` (applique `userInterfaceStyle` sur Android), `react-native-worklets` (requis par Reanimated)
  et `typescript` : ils servent, mais sans `import`.
- `npm audit` : 14 alertes « modérées », toutes issues de deux paquets tirés par le SDK Expo : `uuid` < 11.1.1
  (par `xcode`, outil de compilation, jamais embarqué dans l'application) et `decode-uri-component` 0.2.2 (par
  `query-string`, utilisé par expo-router pour lire les liens ; risque : un lien malformé très long pourrait
  ralentir l'application). La version corrigée (0.5.0) n'existe qu'en ESM et ne peut pas remplacer celle
  qu'attend `query-string` 7 ; `npm audit fix --force` installerait des versions d'Expo incompatibles. À
  revoir à la prochaine mise à jour du SDK.
- Android : `app.json` bloque les permissions ajoutées par défaut et inutiles (stockage, superposition, vibreur) ;
  la version de production ne demande plus qu'`INTERNET`.

## Scripts utiles

```bash
npm test             # tests unitaires (Jest via jest-expo)
npx expo lint        # lint
npx tsc --noEmit     # vérification des types
npx expo-doctor      # diagnostic des dépendances
npm run licenses     # régénère src/credits/licenses.json (page Crédits)
```

Toujours installer les paquets Expo avec `npx expo install <paquet>` pour obtenir des versions compatibles.

## Organisation

- `src/app/` : routes Expo Router. Avec la barre de navigation, dans `(main)/` : `index.tsx` (accueil), `ai-setup.tsx` (réglage d'une partie contre l'IA), `local-setup.tsx` (réglage d'une partie entre amis), `online.tsx` (créer, rejoindre, reprendre ou quitter sa room), `profile.tsx` et `leaderboard.tsx` (classements). Sans la barre, par-dessus : `game.tsx` (la partie ; `/game?players=4` pour 2 à 6 amis sur le même appareil, `/game?ai=medium,hard` contre des IA, `/game` seul à deux), `room/[id].tsx` (salle d'attente puis partie en ligne), et avec un bouton « ‹ Retour » : `profile.tsx`, `player/[id].tsx` (profil d'un autre joueur), `sign-in.tsx`, `sign-up.tsx`, `upgrade.tsx`, `avatar.tsx`, `credits.tsx`, `privacy.tsx`, `terms.tsx`.
- `src/navigation/` : logique de la barre de navigation et du profil ouvert depuis une ligne (`player.ts`) ;
  `src/components/nav-bar/` : la barre et ses icônes.
- `src/players/` : profil public d'un autre joueur (`get_public_profile`) ; `src/app/player/[id].tsx` et
  `src/components/player/` : son écran.
- `src/stats/` : statistiques, classements et séries de connexion (voir « Statistiques et classements »).
- `src/credits/` : données de la page Crédits (générées par `scripts/generate-licenses.mjs`) ; `src/legal/` : textes
  de la politique de confidentialité et des conditions d'utilisation (brouillons).
- `src/lib/flash-notice.ts` : message à usage unique affiché sur l'écran suivant (room fermée par l'hôte).
- `src/i18n/` : traductions (fr, en, de, es), langue active et sélecteur (voir « Traductions »).
- `src/components/` : composants d'affichage, dont `board/` (plateau SVG, pion animé, calcul de mise en page), `game-layout.tsx` (mise en page des parties, téléphone et grand écran) et `state-view.tsx` (chargement, erreurs).
- `src/mutators/` : mutateurs de partie (options d'interface, URL, `rooms.settings`, décision d'une touche) ; `src/components/mutator-settings.tsx` : interrupteurs et badges.
- `src/hooks/` : état d'interface de la partie (sélection, animation, tour des IA), qui délègue règles et IA à `src/game/` ; paramètres de partie (`game-setup.ts`) ; confirmation avant de quitter ou recommencer une partie locale (`leave-guard.ts`, `use-leave-guard.ts`).
- `src/constants/theme.ts` : couleurs, couleurs pastel des joueurs, police et typographie, traits, espacements ; `src/constants/fonts.ts` : fichiers de la police.
- `src/auth/` et `src/lib/supabase.ts` : comptes (voir « Comptes (Supabase) »).
- `src/avatar/` : avatars Humation (configuration, rendu SVG, libellés) ; `src/components/avatar.tsx` : composant `<Avatar />` ; `src/app/(main)/profile.tsx` et `src/app/(main)/avatar.tsx` : profil et éditeur.
- `src/online/` : jeu en ligne partagé avec les Edge Functions (types, arbitre, traitement des demandes, suppression de compte) ; `src/rooms/` : côté application (appels à Supabase, Realtime, état de la partie en ligne) ; `src/components/online/` : salle d'attente et écran de partie.
- `public/` : fichiers copiés tels quels dans l'export web (`_headers` de Cloudflare, voir « Déploiement du site ») ; `src/components/page-head.tsx` : titre, description et aperçus de liens des pages web.
- `supabase/migrations/` : schéma SQL ; `supabase/checks/` : vérifications locales des migrations ; `supabase/functions/game-action/` : Edge Function du jeu en ligne ; `supabase/functions/delete-account/` : suppression de compte.
- `src/game/` : moteur de règles (voir ci-dessous).

Aucune règle de jeu dans les composants : ils affichent l'état et transmettent les touches.

## Moteur de règles (`src/game/`)

Tout s'importe depuis `src/game` (`import { createGame, applyMove } from '@/game'`).

**Plateau.** Étoile à six branches de 121 cases, en coordonnées axiales `{ q, r }`
(la 3e coordonnée cubique vaut `s = -q - r`). C'est l'union de deux grands triangles
(`q, r, s ≥ -4` et `q, r, s ≤ 4`) ; l'hexagone central compte 61 cases, chaque branche 10.
Les branches sont numérotées dans le sens horaire depuis le haut (disposition « pointe en haut ») :
0 haut, 1 haut-droite, 2 bas-droite, 3 bas, 4 bas-gauche, 5 haut-gauche. La branche opposée à `c` est `(c + 3) % 6`.

**Placements de départ** (10 pions par joueur, ordre du tour = sens horaire) :

| Joueurs | Branches de départ | Remarque |
| ------- | ------------------ | -------- |
| 2 | 3, 0 | bas contre haut |
| 3 | 3, 5, 1 | une branche sur deux ; chacun vise une branche vide |
| 4 | 4, 5, 1, 2 | deux paires face à face, haut et bas vides |
| 5 | 3, 4, 5, 0, 1 | la branche bas-droite reste vide |
| 6 | 3, 4, 5, 0, 1, 2 | toutes les branches |

**Coups.**
- pas simple vers une case voisine libre ;
- saut par-dessus un pion adjacent (le sien ou celui d'un autre) vers la case libre juste derrière, en ligne droite ;
- sauts enchaînés : on peut continuer à sauter depuis la case d'arrivée, sans repasser par une case déjà visitée ;
- un pas simple termine le coup (pas de pas simple suivi d'un saut) ; les pions sautés ne sont pas capturés.

**Victoire.** Un joueur gagne dès que ses 10 pions occupent la branche opposée à sa branche de départ ;
la partie s'arrête alors. Un joueur qui n'a aucun coup possible passe son tour.

**Règle anti-blocage** (activée par défaut). Pour qu'un adversaire ne puisse pas empêcher la victoire en
laissant des pions dans la branche d'arrivée d'un joueur, ce joueur gagne aussi dès que sa branche
d'arrivée est pleine et contient au moins un de ses pions. Le coup qui complète la branche peut venir
de n'importe quel joueur. On la désactive avec `createGame(n, { antiBlocking: false })` ; le choix est
enregistré dans `state.rules`.

**API principale.**

| Fonction | Rôle |
| -------- | ---- |
| `createGame(n, rules?)` | nouvelle partie de 2 à 6 joueurs (`rules` : `{ antiBlocking }`) |
| `getLegalMoves(state, cell)` | coups légaux d'un pion, un par destination, avec le chemin complet (le plus court) |
| `getAllLegalMoves(state, player)` | tous les coups d'un joueur |
| `validateMove(state, move)` | `{ ok: true }` ou `{ ok: false, reason }` ; accepte tout chemin valide (validation serveur) |
| `applyMove(state, move)` | renvoie le nouvel état (fonction pure) ; lève `IllegalMoveError` si le coup est illégal |
| `hasWon(state, player)` | le joueur a-t-il rempli sa branche d'arrivée (selon `state.rules`) ? |

Un coup s'écrit `{ from, path }` : `path` liste les cases traversées, la dernière étant la destination.

**État sérialisable.** `GameState` ne contient que des objets, tableaux, nombres et chaînes :
`JSON.parse(JSON.stringify(state))` donne un état identique et jouable. Le plateau est un objet
`board` qui associe la clé `"q,r"` de chaque case occupée au joueur propriétaire ; l'état garde
aussi les règles choisies, le joueur courant, le nombre de coups, le statut, le vainqueur et l'historique des coups.

## IA hors ligne (`src/game/ai.ts`)

Trois niveaux, en TypeScript pur comme le reste du moteur :

| Niveau | Principe |
| ------ | -------- |
| Facile (`easy`) | coup tiré au hasard, pondéré pour préférer ceux qui avancent |
| Moyen (`medium`) | meilleur coup immédiat selon la distance à l'objectif (à égalité : le pion le plus en retard) |
| Difficile (`hard`) | minimax avec élagage alpha-bêta, profondeur 5 au plus, approfondissement itératif |

L'évaluation d'une position est l'écart entre le coût moyen des adversaires et celui de l'IA ;
le coût d'un joueur est la somme des distances de ses pions à la pointe de sa branche d'arrivée
(plus un terme pour le pion le plus en retard). À plus de deux joueurs, le niveau difficile utilise
la variante « meilleure réponse » (Best-Reply Search) : les niveaux de recherche alternent entre un coup
de l'IA et une seule réponse, la plus gênante parmi tous les adversaires. À deux joueurs, c'est le
minimax classique.

- `chooseMove(state, level, options?)` : calcul d'un seul tenant (serveur, tests).
- `chooseMoveAsync(state, level, options?)` : calcul découpé en tranches d'environ 12 ms séparées par
  un `setTimeout(0)`, pour ne jamais figer l'interface ; annulable avec `signal`.
- `timeLimitMs` (800 ms par défaut) borne la réflexion du niveau difficile : à la limite, il garde
  le meilleur coup de la dernière profondeur terminée.

## Feuille de route

1. ~~Module de règles : plateau, déplacements, sauts en chaîne, victoire (avec tests).~~ Fait.
2. ~~Plateau en SVG, partie locale à deux sur le même téléphone.~~ Fait.
3. ~~IA hors ligne à trois niveaux, de 1 à 5 adversaires.~~ Fait.
4. ~~Comptes et parties en ligne avec Supabase.~~ Fait.
5. ~~Finitions de l'interface, EAS Build.~~ Fait.
6. ~~Barre de navigation, statistiques et cinq classements (comptés côté serveur).~~ Fait.
7. ~~Préparation à la production : police, crédits, suppression de compte, pages légales (brouillons),
   nettoyage des rooms, limites d'abus.~~ Fait.
8. ~~Retouches : confirmations dans les parties locales, parties entre amis de 2 à 6, barre de navigation des
   invités, invités hors des classements.~~ Fait.
9. ~~Retouches après les tests du mode en ligne : plateau à une seule zone tactile, une seule room active par
   joueur, écrans de compte sans barre avec « ‹ Retour », déconnexion depuis le profil, œil des mots de passe.~~
   Fait.
10. ~~Tour bien visible (halo, « À toi de jouer ! », titre de l'onglet), branche d'arrivée mise en évidence,
    icônes des statistiques du profil.~~ Fait.
11. ~~Mutateurs de partie : « Toucher c'est jouer » et « Clairvoyance » (local et en ligne).~~ Fait.
12. ~~Profil ouvert par l'avatar (barre Amis, Accueil, Classements), pseudos avec é, è, É, È et apostrophe,
    changement de pseudo tous les 7 jours au plus.~~ Fait.
13. ~~Mot de passe oublié, validation d'e-mail détectée toute seule, modèles d'e-mails en français.~~ Fait.
14. ~~Points (MMR) des parties en ligne classées, classements Points, Victoires et Série.~~ Fait.
15. ~~Amis : demandes par pseudo, boîte aux lettres, liste triée par points avec le rang.~~ Fait.
16. ~~Matchmaking : « Trouver une partie », compte à rebours de 15 s sur l'heure du serveur, 2 à 6 joueurs.~~ Fait.
17. ~~Profil d'un autre joueur (depuis le classement, les amis et les demandes), numéro de position sur chaque ligne
    du classement.~~ Fait.
18. Publication sur les stores (voir `docs/PUBLICATION.md`), notifications « c'est ton tour », invitation d'un
    ami dans une room, classement entre amis.

## Inspiration

Voir le dossier `inspiration/`.
