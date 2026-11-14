import { useLinkingURL } from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { useIsClient } from '@/hooks/use-is-client';

import { authLinkFromParams, linkMatchesPath, parseAuthLink, stripAuthParams, type AuthLink, type AuthLinkPath } from './auth-links';

/**
 * Lien reçu par e-mail qui a ouvert cet écran : l'URL de la page sur le web,
 * le lien profond (expo-linking) sur mobile ; à défaut, les paramètres de la
 * route. `undefined` pendant le rendu statique du web (URL encore inconnue).
 */
export function useIncomingAuthLink(path: AuthLinkPath): AuthLink | undefined {
  const isClient = useIsClient();
  const linkingUrl = useLinkingURL();
  const params = useLocalSearchParams();
  // Sur le web, l'URL est lue une fois : les jetons en sont ensuite retirés.
  const [webUrl] = useState(() => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null));
  const paramsKey = JSON.stringify(params);

  return useMemo(() => {
    if (!isClient) return undefined;
    const url = Platform.OS === 'web' ? webUrl : linkingUrl;
    const fromUrl = url && linkMatchesPath(url, path) ? parseAuthLink(url) : null;
    if (fromUrl && fromUrl.kind !== 'none') return fromUrl;
    return authLinkFromParams(JSON.parse(paramsKey) as Record<string, string>);
  }, [isClient, webUrl, linkingUrl, path, paramsKey]);
}

/** Web : retire les jetons de la barre d'adresse (ils ne servent qu'une fois, et ne doivent pas rester visibles). */
export function useStripAuthParamsFromAddressBar(done: boolean) {
  useEffect(() => {
    if (!done || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const clean = stripAuthParams(window.location.href);
    if (clean !== window.location.href) window.history.replaceState(window.history.state, '', clean);
  }, [done]);
}

type Verification<T> = (
  | { status: 'pending' }
  | { status: 'ok'; value: T }
  | { status: 'error'; error: unknown }
) & {
  /** Recommence après une erreur de réseau. */
  retry: () => void;
};

// Un jeton ne sert qu'une fois : un écran monté deux fois (mode strict,
// retour sur l'écran) réutilise la même vérification au lieu de la refaire.
const verifications = new Map<string, Promise<unknown>>();

function linkKey(link: AuthLink): string | null {
  if (link.kind === 'otp') return `otp:${link.tokenHash}`;
  if (link.kind === 'session') return `session:${link.refreshToken}`;
  return null;
}

/** Vérifie le lien une seule fois (voir `verifications`) et suit le résultat. */
export function useLinkVerification<T>(
  link: AuthLink | undefined,
  verify: (link: AuthLink) => Promise<T>,
): Verification<T> {
  type State = { status: 'pending' } | { status: 'ok'; value: T } | { status: 'error'; error: unknown };
  const [state, setState] = useState<State>({ status: 'pending' });
  const [attempt, setAttempt] = useState(0);
  const key = link ? (linkKey(link) ?? `${link.kind}:${link.kind === 'error' ? link.code : ''}`) : null;

  useEffect(() => {
    if (!link || !key) return;
    let active = true;
    const cacheable = linkKey(link) !== null;
    let promise = cacheable ? (verifications.get(key) as Promise<T> | undefined) : undefined;
    if (!promise) {
      promise = verify(link);
      if (cacheable) {
        verifications.set(key, promise);
        // Échec (réseau…) : on pourra réessayer.
        promise.catch(() => verifications.delete(key));
      }
    }
    promise.then(
      (value) => active && setState({ status: 'ok', value }),
      (error: unknown) => active && setState({ status: 'error', error }),
    );
    return () => {
      active = false;
    };
    // `verify` est lu au moment de la vérification, qui n'a lieu qu'une fois par lien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return {
    ...state,
    retry: () => {
      setState({ status: 'pending' });
      setAttempt((n) => n + 1);
    },
  };
}

/** Pour les tests : oublie les vérifications déjà faites. */
export function resetLinkVerifications() {
  verifications.clear();
}
