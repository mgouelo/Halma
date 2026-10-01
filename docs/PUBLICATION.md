# Checklist de publication

À suivre dans l'ordre avant la première publication sur l'App Store et Google Play. Les cases non cochées sont
à faire à la main ; rien de ce qui suit ne doit finir dans le dépôt (clés, mots de passe, accès aux stores).

## 1. Identifiants de l'application (définitifs)

- [ ] Relire `app.json` : `ios.bundleIdentifier` et `android.package` valent **`com.matth.halma`**. Une fois
      l'application publiée, ils ne peuvent **plus jamais** changer (changer d'identifiant = publier une autre
      application). Les modifier maintenant si besoin.
- [ ] Nom affiché (`name` : « Halma »), `description`, `version` (`1.0.0`). Le numéro de build est géré par EAS
      (`appVersionSource: remote`, augmenté à chaque build de production).
- [ ] Vérifier que le nom « Halma » est disponible sur les deux stores (sinon, un nom d'affichage plus long).

## 2. Comptes développeur

- [ ] **Apple Developer Program** (payant, annuel) ; pour une personne morale, numéro D-U-N-S.
- [ ] **Google Play Console** (frais uniques) ; vérification d'identité, et pour un compte personnel récent, test
      fermé obligatoire avec des testeurs pendant plusieurs jours avant la production (règles Google en vigueur).
- [ ] Compte **Expo** : `npx eas-cli@latest login`, puis `npx eas-cli@latest init` (ajoute l'identifiant du projet
      EAS dans `app.json`).

## 3. Supabase (production)

- [ ] Projet Supabase de production, région choisie (à reporter dans la politique de confidentialité).
- [ ] Migrations appliquées, **dans l'ordre**, avec `supabase db push` (ou dans l'éditeur SQL) :
  1. `20260930120000_create_profiles.sql`
  2. `20261001120000_create_rooms.sql`
  3. `20261002120000_profile_avatar.sql`
  4. `20261003120000_player_stats.sql`
  5. `20261004120000_leaderboards_without_games_started.sql`
  6. `20261005120000_account_deletion_and_limits.sql`
  7. `20261006120000_cleanup_abandoned_rooms.sql`
- [ ] Edge Functions déployées **depuis la racine du dépôt** (après les migrations) :
      ```bash
      supabase functions deploy game-action --project-ref <référence>
      supabase functions deploy delete-account --project-ref <référence>
      ```
- [ ] pg_cron : `select * from cron.job;` montre `halma-cleanup-abandoned-rooms` (sinon, voir le README,
      « Nettoyage des rooms abandonnées »).
- [ ] *Authentication* : e-mail activé avec *Confirm email*, connexion invité activée, mots de passe de 8
      caractères au moins, *Site URL* réglée, limites de débit revues (surtout les connexions invité), captcha
      décidé (voir README, « Limites d'abus » : l'activer demande d'ajouter le widget dans l'application).
- [ ] Modèles d'e-mails d'authentification traduits en français (*Authentication → Emails*) et expéditeur SMTP
      personnalisé (l'expéditeur par défaut de Supabase est très limité en nombre d'envois).
- [ ] Sauvegardes : vérifier ce que l'offre Supabase choisie inclut.

## 4. Variables EAS

Pour chaque environnement EAS (`development`, `preview`, `production`), en visibilité « plaintext » (ce sont des
valeurs publiques) :

- [ ] `EXPO_PUBLIC_SUPABASE_URL`
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clé `anon` ou `publishable`, **jamais** la clé `service_role`)

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://….supabase.co --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value … --visibility plaintext
```

## 5. Textes légaux

- [ ] Faire relire `src/legal/privacy.ts` et `src/legal/terms.ts`, relire les textes, tous complétés
      (éditeur, contact, région Supabase eu-west-1 / Irlande, base légale, âge minimum de 15 ans, droit applicable),
      puis passer `draft` à `false` (le bandeau « Brouillon » disparaît).
- [ ] Publier la politique de confidentialité à une **adresse web publique** (exigée par les deux stores) : par
      exemple la version web de l'application (`/privacy`), hébergée avec `npx expo export -p web`.
- [ ] Adresse e-mail de support et page (ou adresse) d'aide pour les fiches des stores.

## 6. Fiches de confidentialité des stores

À remplir d'après la politique de confidentialité (et à garder cohérentes avec elle) :

- [ ] **App Store — App Privacy** : données liées à l'utilisateur, non utilisées pour le suivi publicitaire :
      adresse e-mail (comptes e-mail), identifiant utilisateur, contenu créé (pseudo, avatar), données de jeu
      (parties, statistiques, classements). Pas de suivi (*tracking*), pas de publicité, pas de mesure d'audience.
- [ ] **Google Play — Sécurité des données** : mêmes données ; chiffrées en transit (HTTPS) ; suppression possible
      **dans l'application** (Profil → Supprimer mon compte) **et** via une adresse web ou un e-mail à indiquer
      (Google demande aussi un moyen de demander la suppression hors de l'application).
- [ ] Déclarations Google Play : public cible et contenu (jeu tous publics ?), questionnaire de classification
      du contenu (IARC), application sans publicité.
- [ ] App Store : classification par âge, catégorie (Jeux → Plateau), et `ITSAppUsesNonExemptEncryption: false`
      (déjà dans `app.json` : seulement du HTTPS).

## 7. Captures et visuels

- [ ] Captures iPhone (6,9" et 6,5"), iPad (13") puisque `supportsTablet` est activé, téléphone Android, et
      tablette Android si on la vise. Prendre : accueil, partie en cours, contre l'IA, salle d'attente en ligne,
      classements, éditeur d'avatar (`docs/screenshots/` contient des captures web pour s'inspirer).
- [ ] Icône 1024 × 1024 sans transparence (`assets/images/icon.png`), image de présentation Google Play
      (1024 × 500).
- [ ] Textes des fiches : titre, sous-titre, description courte et longue, mots-clés.

## 8. Tests sur de vrais téléphones

Compiler une version de test : `npx eas-cli@latest build --profile preview --platform all`, puis sur **au moins un
Android et un iPhone réels** :

- [ ] Premier lancement : écran de démarrage, police Fredoka chargée, pas d'écran blanc.
- [ ] Inscription par e-mail (e-mail de confirmation reçu), connexion, connexion invité, invité → compte e-mail.
- [ ] Partie contre l'IA (les trois niveaux), partie entre amis (2 à 6 joueurs), confirmations « Quitter » et « Nouvelle partie », écran de victoire.
- [ ] En ligne sur deux téléphones : créer une room, rejoindre avec le code, ajouter une IA, jouer jusqu'à la
      victoire, classement mis à jour ; couper le réseau d'un téléphone (forfait au bout de 2 minutes) ; reprise.
- [ ] Mauvais code de room dix fois : message « Trop de codes essayés ».
- [ ] Suppression de compte, y compris en pleine partie : l'autre joueur continue, la place affiche « Compte
      supprimé » ; le compte ne peut plus se connecter.
- [ ] Pages Crédits, Confidentialité et Conditions ; liens externes ouverts dans le navigateur.
- [ ] Lecteur d'écran (VoiceOver, TalkBack) sur l'accueil, la barre de navigation et les classements ; texte
      agrandi dans les réglages du système ; mode sombre du système (l'application reste en clair).
- [ ] Mode avion : les parties hors ligne marchent, les écrans en ligne affichent une erreur avec « Réessayer ».

## 9. Compiler et envoyer

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform all
```

EAS demande les accès aux stores (compte Apple, clé de service Google Play) à la première utilisation ; rien n'est
stocké dans le dépôt.

- [ ] iOS : description « réseau local » (`NSLocalNetworkUsageDescription`) ajoutée par `expo-dev-client` : vérifier
      qu'elle n'est pas dans le build de production ; si elle y est, préparer une réponse pour la revue d'Apple.
- [ ] Après publication : garder les mêmes migrations et fonctions sur le projet Supabase de production à chaque
      mise à jour (migrations d'abord, puis fonctions, puis application).
