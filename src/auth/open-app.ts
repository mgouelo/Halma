// Pages des liens reçus par e-mail ouvertes dans un navigateur : savoir si c'est
// celui d'un téléphone, pour proposer d'ouvrir l'application (lien halma://).

import { Platform } from 'react-native';

import { useIsClient } from '@/hooks/use-is-client';

import { APP_SCHEME } from './auth-links';

/** Ouvre l'application (son accueil) depuis le navigateur du téléphone. */
export const OPEN_APP_URL = `${APP_SCHEME}://`;

/** Vrai pour le navigateur d'un téléphone Android ou d'un iPhone. */
export function isPhoneUserAgent(userAgent: string | null | undefined): boolean {
  return /Android|iPhone|iPod/i.test(userAgent ?? '');
}

/**
 * Où s'affiche l'écran : dans l'application (`app`), ou sur le site web, dans le
 * navigateur d'un téléphone (`phone`) ou d'un ordinateur (`desktop`).
 * Sur le web, `desktop` pendant le rendu statique et l'hydratation (le
 * navigateur n'est connu qu'ensuite).
 */
export type ScreenHost = 'app' | 'phone' | 'desktop';

export function useScreenHost(): ScreenHost {
  const isClient = useIsClient();
  if (Platform.OS !== 'web') return 'app';
  if (!isClient || typeof navigator === 'undefined') return 'desktop';
  return isPhoneUserAgent(navigator.userAgent) ? 'phone' : 'desktop';
}

/** Ouvre l'application installée (web : navigation vers halma://). */
export function openApp() {
  if (typeof window !== 'undefined') window.location.href = OPEN_APP_URL;
}
