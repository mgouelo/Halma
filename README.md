# Halma (dames chinoises)

Application mobile de dames chinoises (Halma) jouable à distance, de 2 à 6 joueurs.

## Stack

- **Client :** Expo (React Native) + TypeScript, avec Expo Router. Cibles : iOS, Android et web.
- **Comptes :** Supabase Auth (e-mail et invité anonyme) et table `profiles` dans Postgres. Multijoueur en ligne (Realtime) à venir.
- **Règles :** module TypeScript pur (sans React ni Expo) partagé entre le client et le serveur, dans `src/game/`.

## Démarrer

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npx expo start
```

Ensuite : scanner le QR code avec l'appli Expo Go sur le téléphone, ou appuyer sur `w` pour ouvrir la version web.

Sans configuration Supabase, l'application fonctionne hors ligne (contre l'IA ou à deux) ; seuls les comptes sont indisponibles.

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

### Ce qui est en place

- Écrans `/sign-in` (connexion, bouton « Jouer en invité ») et `/sign-up` (pseudo, e-mail, mot de passe).
  L'accueil affiche le pseudo du joueur connecté, ou un bouton « Se connecter ».
- Table `profiles` (`id`, `pseudo` unique sans tenir compte de la casse, `avatar`, `created_at`),
  remplie automatiquement à l'inscription par un trigger : le pseudo vient du formulaire, ou
  `invite-xxxxxx` pour un invité.
- Row Level Security : les joueurs connectés (invités compris) lisent les profils ; chacun ne modifie que
  son pseudo et son avatar ; personne ne crée ni ne supprime de profil directement (la suppression suit
  celle du compte). La fonction `is_pseudo_available` permet de tester un pseudo avant l'inscription.
- Le code : `src/lib/supabase.ts` (client, session enregistrée avec AsyncStorage), `src/auth/`
  (validation, appels à Supabase, messages d'erreur en français, contexte `useAuth()`).

Un compte invité est lié à l'appareil : après déconnexion, il ne peut pas être retrouvé.

### Vérifier les migrations sans Supabase

`scripts/check-db.sh` applique les migrations sur un Postgres local (avec une imitation minimale du
schéma `auth` de Supabase) et vérifie le trigger, l'unicité des pseudos et la RLS :

```bash
DATABASE_URL=postgres://postgres@localhost:5432/postgres scripts/check-db.sh
```

Le script crée une base temporaire et la supprime à la fin. Ne jamais le lancer sur la base Supabase.

## Scripts utiles

```bash
npm test             # tests unitaires (Jest via jest-expo)
npx expo lint        # lint
npx tsc --noEmit     # vérification des types
npx expo-doctor      # diagnostic des dépendances
```

Toujours installer les paquets Expo avec `npx expo install <paquet>` pour obtenir des versions compatibles.

## Organisation

- `src/app/` : routes Expo Router : `index.tsx` (accueil), `ai-setup.tsx` (réglage d'une partie contre l'IA) et `game.tsx` (la partie ; `/game` à deux sur le même appareil, `/game?ai=medium,hard` contre des IA).
- `src/components/` : composants d'affichage, dont `board/` (plateau SVG, pion animé, calcul de mise en page).
- `src/hooks/` : état d'interface de la partie (sélection, animation, tour des IA), qui délègue règles et IA à `src/game/`.
- `src/constants/theme.ts` : couleurs, couleurs pastel des joueurs, typographie, traits, espacements.
- `src/auth/` et `src/lib/supabase.ts` : comptes (voir « Comptes (Supabase) »).
- `supabase/migrations/` : schéma SQL ; `supabase/checks/` : vérifications locales des migrations.
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
4. Comptes et parties en ligne avec Supabase.
5. Notifications « c'est ton tour », classement, publication sur les stores.

## Inspiration

Voir le dossier `inspiration/`.
