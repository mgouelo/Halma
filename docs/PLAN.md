# Plan de développement

Objectif : une app mobile (et web) de dames chinoises jouable à distance, avec rooms, IA, comptes et avatars.

## Fonctionnalités cibles

- Créer ou rejoindre une room pour jouer avec d'autres joueurs (2 à 6).
- Dans la room, l'hôte peut ajouter des IA (avec niveau de difficulté) pour compléter les joueurs.
- Mode hors ligne contre une ou plusieurs IA, avec niveau de difficulté au choix.
- Comptes utilisateur et avatars, générés avec [Humation](https://docs.humation.app/) (style dessin noir et blanc, licence MIT).
- DA : interface en majorité noir et blanc, trait de dessin noir sur fond blanc ; pions en couleurs pastel douces.
- Plus tard : système d'amis et classement (victoires, etc.).

## Méthode de travail

- Une étape = une session cloud = une pull request. Relire, tester, fusionner, puis passer à la suivante.
- Chaque session commence par lire `AGENTS.md`, `README.md`, ce plan et le code existant.
- Tester en local après chaque fusion : `git pull` puis `npx expo start`.
- Ne jamais commiter de secret (clés Supabase, `.env`).

## Étape 1 : moteur de règles

```text
Lis AGENTS.md et README.md. Implémente le moteur de règles des dames chinoises
(Halma) dans src/game/, en TypeScript pur, sans dépendance à React ni à Expo :
- plateau en étoile à 121 cases (coordonnées axiales), 2, 3, 4 ou 6 joueurs
  avec les placements de départ standard
- coups : pas simple vers une case adjacente libre, saut par-dessus un pion
  (le sien ou celui d'un autre), sauts enchaînés
- fonction qui liste tous les coups légaux d'un pion et les chemins complets
- application d'un coup, gestion du tour, détection de victoire
  (tous les pions dans le coin opposé)
- l'état de la partie doit être sérialisable en JSON
Ajoute des tests unitaires (Jest via jest-expo) couvrant les sauts en chaîne,
les cas limites et la victoire. Mets à jour le README. Ouvre une pull request.
```

## Étape 2 : plateau et partie locale

```text
Lis AGENTS.md et le module src/game/. Construis l'écran de jeu :
- plateau dessiné en SVG (react-native-svg), qui fonctionne sur mobile et sur web
- sélection d'un pion, affichage des cases atteignables, animation du déplacement
- partie locale à 2 joueurs sur le même appareil, avec écran de victoire
- DA : interface noir et blanc, trait de dessin noir sur fond blanc, pions en
  couleurs pastel douces. Centralise les couleurs et la typo dans un fichier
  de thème (src/constants/theme.ts).
Supprime les écrans d'exemple du modèle Expo et mets en place une navigation
propre : accueil, jeu. Pas de logique de règles dans les composants.
Ouvre une pull request avec des captures ou une description de ce qui a été fait.
```

## Étape 3 : IA hors ligne avec difficulté

```text
Ajoute dans src/game/ un module d'IA utilisable hors ligne :
- 3 niveaux : facile (coups quasi aléatoires avec préférence pour l'avancée),
  moyen (heuristique de distance à l'objectif), difficile (minimax avec
  élagage alpha-bêta, profondeur limitée)
- le calcul ne doit pas bloquer l'interface (limite de temps par coup)
- tests unitaires
Ajoute à l'accueil un mode « Jouer contre l'IA » : choix du nombre d'IA (1 à 5),
du niveau de chacune, puis partie. Ouvre une pull request.
```

## Étape 4 : comptes (Supabase)

Avant : créer un projet Supabase, puis mettre l'URL et la clé `anon` dans un fichier `.env` local (jamais commité).

```text
Intègre Supabase (@supabase/supabase-js) pour l'authentification :
- inscription et connexion par e-mail, plus une connexion invité anonyme
- table profiles (id, pseudo unique, avatar, créé le) avec Row Level Security
- écrans de connexion et d'inscription dans la même DA
- les clés sont lues depuis des variables d'environnement Expo
  (EXPO_PUBLIC_...), documente-les dans .env.example et dans le README
Écris les migrations SQL dans supabase/migrations/. Ne commite aucun secret.
Ouvre une pull request.
```

## Étape 5 : rooms et multijoueur en ligne

```text
Ajoute le jeu en ligne avec Supabase Realtime :
- tables rooms, room_players, games avec Row Level Security
- créer une room (code court à partager), rejoindre par code, salle d'attente
  avec la liste des joueurs, l'hôte lance la partie
- l'hôte peut ajouter ou retirer des IA (avec niveau) pour compléter jusqu'à
  2 à 6 participants
- chaque coup est validé côté serveur avec le module src/game/ dans une Edge
  Function ; les clients ne peuvent pas écrire l'état directement
- les IA jouent côté serveur ou côté hôte (explique ton choix dans la PR)
- gestion de la déconnexion : reprise de partie, forfait après un délai
Écris des tests pour la validation des coups côté serveur. Ouvre une pull request.
```

## Étape 6 : avatars Humation

Note : `@humation/react` vise React web. En React Native, il faudra probablement utiliser `@humation/core` (SVG brut) affiché avec `react-native-svg`. À vérifier au début de l'étape.

```text
Intègre les avatars Humation (doc : https://docs.humation.app/, licence MIT) :
- vérifie d'abord si @humation/react fonctionne en React Native ; sinon utilise
  @humation/core (SVG brut) affiché avec react-native-svg. Explique ton choix.
- écran de création d'avatar permettant de personnaliser les options disponibles
  et de sauvegarder le résultat dans profiles.avatar (seed ou options JSON)
- composant <Avatar /> réutilisable, affiché dans la salle d'attente, sur le
  plateau (joueurs) et dans le profil
Vérifie que tout marche sur mobile et sur web. Ouvre une pull request.
```

## Étape 7 : finitions UI et publication

```text
Passe de finition sur toute l'appli : cohérence de la DA (noir et blanc,
pions pastel), animations, états de chargement et d'erreur, accessibilité
(contrastes, tailles tactiles), adaptation grand écran pour le web.
Configure EAS Build (eas.json) pour Android et iOS. Ouvre une pull request.
```

## Étape 8 : barre de navigation, statistiques et classements (fait)

- Barre de navigation du bas (profil, accueil, classements), masquée pendant les parties et sur les écrans de
  connexion : groupe de routes `(main)` avec un layout personnalisé.
- Table `player_stats` écrite uniquement côté serveur : parties lancées (`begin_game`), victoires
  (`record_game_win`, appelée par l'Edge Function `game-action`), série de connexion (`record_daily_login`).
- Cinq classements (`get_leaderboards`) : victoires, halls des débutants, des confirmés et des pros, série de
  connexion. Les parties lancées restent comptées et affichées sur le profil, sans classement.
- Écran `/leaderboard`, statistiques sur le profil.
- Pas de garde-fou contre les scripts ou les comptes qui s'entraident (ni nombre minimal de coups, ni plafond
  journalier) : choix assumé pour cette version.
- Les parties locales ne comptent pas (non vérifiables par le serveur).

## Étape 9 : préparation à la mise en production (fait)

- Police Fredoka (SIL OFL), trois graisses, chargée par `expo-font` avec écran de démarrage et secours système.
- Page `/credits` (Humation et sa licence MIT complète, police, bibliothèques ; `npm run licenses`).
- Suppression de compte dans l'application (Edge Function `delete-account`, trigger de préparation, place
  « Compte supprimé » dans les parties lancées).
- Pages `/privacy` et `/terms` : brouillons à faire relire, champs à compléter.
- Nettoyage des rooms abandonnées (pg_cron), limites d'essais de codes et de rooms en attente.
- Dépendances inutilisées retirées, permissions Android inutiles bloquées, `ErrorBoundary` globale.
- Checklist de publication : `docs/PUBLICATION.md`.

## Plus tard : amis

- Table `friendships` (demande, acceptation), liste d'amis, invitation directe dans une room.
- Classement entre amis.
