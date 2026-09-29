# Halma (dames chinoises)

Application mobile de dames chinoises (Halma) jouable à distance, de 2 à 6 joueurs.

## Stack

- **Client :** Expo (React Native) + TypeScript, avec Expo Router. Cibles : iOS, Android et web.
- **Multijoueur :** Supabase (Auth, Postgres, Realtime), à venir.
- **Règles :** module TypeScript partagé entre le client et le serveur, à venir dans `src/game/`.

## Démarrer

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npx expo start
```

Ensuite : scanner le QR code avec l'appli Expo Go sur le téléphone, ou appuyer sur `w` pour ouvrir la version web.

## Scripts utiles

```bash
npx expo lint        # lint
npx tsc --noEmit     # vérification des types
npx expo-doctor      # diagnostic des dépendances
```

Toujours installer les paquets Expo avec `npx expo install <paquet>` pour obtenir des versions compatibles.

## Feuille de route

1. Module de règles : plateau, déplacements, sauts en chaîne, victoire (avec tests).
2. Plateau en SVG, partie locale à deux sur le même téléphone.
3. IA simple pour jouer seul.
4. Comptes et parties en ligne avec Supabase.
5. Notifications « c'est ton tour », classement, publication sur les stores.

## Inspiration

Voir le dossier `inspiration/`.
