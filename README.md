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

Sans configuration Supabase, l'application fonctionne hors ligne (contre l'IA ou à deux) ; seuls les comptes et
le jeu en ligne sont indisponibles.

## Comptes (Supabase)

### Variables d'environnement

Copier `.env.example` en `.env` (ignoré par git) et le remplir :

| Variable | Contenu |
| -------- | ------- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet, par exemple `https://abcdefghijklmnop.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clé publique du projet : clé `anon` ou nouvelle clé `publishable` (`sb_publishable_…`) |

Elles se trouvent dans le tableau de bord Supabase, rubrique *Project Settings → API* (ou *API Keys*).
Le préfixe `EXPO_PUBLIC_` les intègre dans l'application : ce sont des valeurs publiques, la sécurité
repose sur la Row Level Security. **Ne jamais mettre la clé `service_role` (ou *secret key*) dans l'application
ni dans un fichier commité.** Après un changement de `.env`, relancer avec `npx expo start --clear`.
Pour une compilation EAS, définir les mêmes variables dans l'environnement EAS du projet.

### Mise en place du projet Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Appliquer les migrations de `supabase/migrations/` : avec la CLI Supabase (`supabase link` puis
   `supabase db push`), ou en collant le fichier SQL dans l'éditeur SQL du tableau de bord.
3. Dans *Authentication → Sign In / Providers* :
   - laisser **Email** activé ; en développement, on peut désactiver *Confirm email* pour se connecter
     tout de suite (sinon l'application affiche « vérifie tes e-mails ») ;
   - activer **Allow anonymous sign-ins** pour le mode invité ;
   - mettre la longueur minimale des mots de passe à 8, comme l'application.
4. Dans *Authentication → URL Configuration*, régler *Site URL* (page ouverte par le lien de confirmation).
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

### Ce qui est en place

- Écrans `/sign-in` (connexion, bouton « Jouer en invité »), `/sign-up` (pseudo, e-mail, mot de passe)
  et `/upgrade` (un invité crée son compte). L'accueil affiche le pseudo du joueur connecté, ou un bouton
  « Se connecter ».
- Table `profiles` (`id`, `pseudo`, `avatar`, `created_at`), remplie automatiquement à l'inscription par un
  trigger : le pseudo vient du formulaire, ou `invite-xxxxxx` pour un invité.
- Pseudos : 3 à 20 caractères parmi les lettres sans accent, les chiffres, « _ », « - » et « . », dont
  au moins 3 lettres (par exemple `Jean.Dupont-2` ; `...` ou `12345` sont refusés). Uniques sans tenir
  compte de la casse : `Jean.Dupont` et `jean.dupont` sont le même pseudo. La même règle est vérifiée par
  l'application et imposée par la base.
- Row Level Security : les joueurs connectés (invités compris) lisent les profils ; chacun ne modifie que
  son pseudo et son avatar ; personne ne crée ni ne supprime de profil directement (la suppression suit
  celle du compte). La fonction `is_pseudo_available` permet de tester un pseudo avant l'inscription.
- Le code : `src/lib/supabase.ts` (client, session enregistrée avec AsyncStorage), `src/auth/`
  (validation, appels à Supabase, messages d'erreur en français, contexte `useAuth()`).

### Du compte invité au compte e-mail

Un compte invité est lié à l'appareil : après déconnexion, il ne peut pas être retrouvé. Depuis l'accueil,
« Créer mon compte » (écran `/upgrade`) le transforme en compte e-mail **sans changer d'identifiant** : le
profil, et plus tard les parties, sont conservés.

1. Le pseudo choisi remplace `invite-xxxxxx` (mise à jour du profil ; l'index unique refuse un pseudo pris).
2. L'e-mail et le mot de passe sont ajoutés au compte (`supabase.auth.updateUser`).
   - Si *Confirm email* est désactivé, le compte devient aussitôt un compte e-mail.
   - Sinon, le mot de passe est enregistré mais le compte reste invité jusqu'au clic sur le lien reçu
     (« Confirm email change »). L'accueil l'indique et propose « J'ai confirmé » ; sur mobile, le compte
     est aussi relu au retour dans l'application. Ensuite, la connexion par e-mail et mot de passe fonctionne.

Le lien de confirmation renvoie vers la *Site URL* du projet.

### Vérifier les migrations sans Supabase

`scripts/check-db.sh` applique les migrations sur un Postgres local (avec une imitation minimale du
schéma `auth` de Supabase) et vérifie le trigger, le format et l'unicité des pseudos et la RLS. La base
temporaire utilise la locale `C`, la plus stricte :

```bash
DATABASE_URL=postgres://postgres@localhost:5432/postgres scripts/check-db.sh
```

Le script crée une base temporaire et la supprime à la fin. Ne jamais le lancer sur la base Supabase.
Il vérifie aussi la migration `rooms` (`supabase/checks/rooms-check.sql`) : lecture réservée aux joueurs
de la room, aucune écriture directe, salle d'attente, lancement, fin de partie.

## Jeu en ligne

### Parcours

- **Accueil → Jouer en ligne** (`/online`) : il faut être connecté (un compte invité suffit). On y crée une
  room, on en rejoint une avec son code, et on retrouve ses parties en cours (« Reprendre »).
- **Salle d'attente** (`/room/[id]`) : code à 6 caractères (sans I, L, O, 0 ni 1) à partager, liste des
  participants avec leur pseudo, l'hôte et les joueurs déconnectés. L'hôte ajoute ou retire des IA et règle
  leur niveau, de 2 à 6 participants en tout, puis lance la partie. Si l'hôte quitte la salle, le joueur
  suivant devient hôte ; une room sans humain est supprimée.
- **Partie** (même écran une fois lancée) : l'ordre des places donne l'ordre du tour et les couleurs. Chaque
  joueur ne peut toucher que ses pions pendant son tour ; le coup s'affiche aussitôt puis est confirmé (ou
  annulé) par le serveur. Les coups des autres arrivent par Realtime et sont animés. Bouton « Abandonner ».

### Qui écrit quoi

Les clients **ne peuvent rien écrire** dans `rooms`, `room_players` ni `games` (aucun droit `insert`,
`update` ni `delete`, et la RLS ne leur montre que leurs rooms) :

| Action | Passe par | Vérifications |
| ------ | --------- | ------------- |
| Créer, rejoindre, quitter une room ; ajouter, régler, retirer une IA ; signe de vie | fonctions SQL `create_room`, `join_room`, `leave_room`, `add_ai`, `set_ai_level`, `remove_ai`, `heartbeat` (`security definer`) | membre, hôte, room en attente, 6 places au plus |
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

- `src/online/__tests__/` : validation côté serveur. `server.test.ts` passe par `handleGameRequest` (le
  code de l'Edge Function) avec une base en mémoire : demandes mal formées, coups hors tour, pion adverse,
  sauts invalides, chemins de sauts non minimaux acceptés, coup rejoué, écritures concurrentes, victoire,
  IA, forfaits et abandons. `referee.test.ts` et `protocol.test.ts` testent l'arbitre et la lecture des
  demandes.
- `src/rooms/__tests__/` : côté application (affichage optimiste et annulation, animation des coups reçus,
  choix du joueur qui demande le coup de l'IA, appels à Supabase).
- `scripts/check-db.sh` : RLS et fonctions SQL (voir plus haut).
- La fonction se vérifie avec Deno : `deno check supabase/functions/game-action/index.ts`.

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

- **Profil** (`/profile`, en touchant son avatar sur l'accueil) : avatar, pseudo, type de compte.
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

## Scripts utiles

```bash
npm test             # tests unitaires (Jest via jest-expo)
npx expo lint        # lint
npx tsc --noEmit     # vérification des types
npx expo-doctor      # diagnostic des dépendances
```

Toujours installer les paquets Expo avec `npx expo install <paquet>` pour obtenir des versions compatibles.

## Organisation

- `src/app/` : routes Expo Router : `index.tsx` (accueil), `ai-setup.tsx` (réglage d'une partie contre l'IA), `game.tsx` (la partie ; `/game` à deux sur le même appareil, `/game?ai=medium,hard` contre des IA), `online.tsx` (créer, rejoindre, reprendre) et `room/[id].tsx` (salle d'attente puis partie en ligne).
- `src/components/` : composants d'affichage, dont `board/` (plateau SVG, pion animé, calcul de mise en page).
- `src/hooks/` : état d'interface de la partie (sélection, animation, tour des IA), qui délègue règles et IA à `src/game/`.
- `src/constants/theme.ts` : couleurs, couleurs pastel des joueurs, typographie, traits, espacements.
- `src/auth/` et `src/lib/supabase.ts` : comptes (voir « Comptes (Supabase) »).
- `src/avatar/` : avatars Humation (configuration, rendu SVG, libellés) ; `src/components/avatar.tsx` : composant `<Avatar />` ; `src/app/profile.tsx` et `src/app/avatar.tsx` : profil et éditeur.
- `src/online/` : jeu en ligne partagé avec l'Edge Function (types, arbitre, traitement des demandes) ; `src/rooms/` : côté application (appels à Supabase, Realtime, état de la partie en ligne) ; `src/components/online/` : salle d'attente et écran de partie.
- `supabase/migrations/` : schéma SQL ; `supabase/checks/` : vérifications locales des migrations ; `supabase/functions/game-action/` : Edge Function du jeu en ligne.
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
5. Notifications « c'est ton tour », classement, publication sur les stores.

## Inspiration

Voir le dossier `inspiration/`.
