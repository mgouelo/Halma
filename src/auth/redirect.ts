import { Platform } from 'react-native';

import { authRedirectUrl, type AuthLinkPath } from './auth-links';

/**
 * Adresse publique du site (`https://halma-game.com`, sans barre finale), lue à
 * la compilation. Expo ne remplace que les accès écrits en toutes lettres
 * (`process.env.EXPO_PUBLIC_…`) : lue à chaque appel pour que les tests puissent la changer.
 */
export function siteUrl(): string | null {
  return process.env.EXPO_PUBLIC_SITE_URL?.trim() || null;
}

/**
 * Adresse de redirection des e-mails pour cette plateforme : la route du site
 * ouvert sur le web ; sur mobile, la route du site public (`EXPO_PUBLIC_SITE_URL`),
 * ou `halma://…` si elle n'est pas définie (développement local).
 */
export function redirectUrl(path: AuthLinkPath): string {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : null;
  return authRedirectUrl(path, Platform.OS === 'web' ? 'web' : 'native', origin, siteUrl());
}
