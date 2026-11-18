// Liens reçus par e-mail (confirmation de compte, changement d'e-mail,
// réinitialisation du mot de passe) : adresses de redirection et analyse des
// liens, sur le site web (https://…) comme dans l'application (schéma halma://,
// en développement). Logique pure, testée à part.
//
// Choix du flux : les modèles d'e-mails (docs/emails/) mènent directement à
// l'écran du lien avec `token_hash` et `type` ; l'écran vérifie le jeton
// lui-même (`auth.verifyOtp`). Pas de PKCE : son `code` ne peut être échangé
// que sur l'appareil (et dans le navigateur) qui a fait la demande, alors
// qu'on ouvre souvent l'e-mail ailleurs. Les liens des modèles par défaut de
// Supabase (flux implicite : jetons `access_token` et `refresh_token` après
// « # ») restent acceptés.

/** Schéma d'URL de l'application (app.json, `expo.scheme`). */
export const APP_SCHEME = 'halma';

/** Routes ouvertes par les liens des e-mails. */
export const AUTH_LINK_PATHS = {
  resetPassword: '/reset-password',
  confirmed: '/auth/confirmed',
} as const;

export type AuthLinkPath = (typeof AUTH_LINK_PATHS)[keyof typeof AUTH_LINK_PATHS];

/**
 * Adresse de redirection passée à Supabase, celle vers laquelle mènent les liens
 * des e-mails :
 * - web : la route du site ouvert (`https://exemple.fr/reset-password`) ;
 * - mobile, avec l'adresse du site (`EXPO_PUBLIC_SITE_URL`) : la même route sur
 *   le site (`https://halma-game.com/reset-password`), un lien https cliquable
 *   dans toutes les messageries, que le navigateur du téléphone ouvre et vérifie ;
 * - mobile, sans adresse du site (développement local, tests) : le schéma de
 *   l'application (`halma://reset-password`).
 */
export function authRedirectUrl(
  path: AuthLinkPath,
  platform: 'web' | 'native',
  webOrigin?: string | null,
  siteUrl?: string | null,
): string {
  if (platform === 'web' && webOrigin) return `${trimTrailingSlashes(webOrigin)}${path}`;
  const site = siteUrl?.trim();
  if (site) return `${trimTrailingSlashes(site)}${path}`;
  return `${APP_SCHEME}://${path.replace(/^\/+/, '')}`;
}

function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Types de jetons à usage unique que l'application sait vérifier. */
export type LinkOtpType = 'recovery' | 'email' | 'signup' | 'email_change';
const OTP_TYPES: readonly string[] = ['recovery', 'email', 'signup', 'email_change'];

export type AuthLink =
  /** Jeton à vérifier (`verifyOtp`) : modèles d'e-mails de docs/emails/. */
  | { kind: 'otp'; tokenHash: string; type: LinkOtpType }
  /** Session déjà ouverte par Supabase (flux implicite, modèles par défaut). */
  | { kind: 'session'; accessToken: string; refreshToken: string; type: string | null }
  /** Erreur renvoyée par Supabase dans le lien (lien expiré, déjà utilisé…). */
  | { kind: 'error'; code: string; description: string | null }
  /** Pas de jeton utilisable (lien incomplet, écran ouvert à la main, ou `code` PKCE). */
  | { kind: 'none' };

function paramsOf(text: string): URLSearchParams {
  return new URLSearchParams(text.replace(/^[?#]/, ''));
}

/**
 * Lit un lien reçu par e-mail. Les paramètres peuvent être dans la requête
 * (`?token_hash=…&type=recovery`) ou après « # » (flux implicite, erreurs).
 * Fonctionne avec `halma://…`, `exp://…` et `https://…`.
 */
export function parseAuthLink(url: string | null | undefined): AuthLink {
  if (!url) return { kind: 'none' };
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryIndex = beforeHash.indexOf('?');
  const query = paramsOf(queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '');
  const hash = paramsOf(fragment);
  // Le fragment l'emporte : Supabase y ecrit les erreurs et les jetons du flux
  // implicite ; la requete porte `token_hash` et `type` (modeles de docs/emails/).
  const get = (name: string) => hash.get(name) ?? query.get(name);

  // Une erreur passe avant tout jeton : Supabase la met dans la redirection
  // quand la verification a deja echoue chez lui (lien expire, deja utilise).
  const error = get('error_code') ?? get('error');
  if (error) return { kind: 'error', code: error, description: get('error_description') };

  const tokenHash = get('token_hash');
  const type = get('type');
  if (tokenHash && type && OTP_TYPES.includes(type)) return { kind: 'otp', tokenHash, type: type as LinkOtpType };

  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken, type };

  return { kind: 'none' };
}

/** Lien analysé à partir des paramètres de route (quand l'URL complète n'est pas disponible). */
export function authLinkFromParams(params: Record<string, string | string[] | undefined>): AuthLink {
  const query = Object.entries(params)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return parseAuthLink(query ? `?${query}` : null);
}

/** Retire les jetons de l'adresse affichée (web) : ils ne servent qu'une fois. */
export function stripAuthParams(url: string): string {
  const hashIndex = url.indexOf('#');
  const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = base.indexOf('?');
  return queryIndex >= 0 ? base.slice(0, queryIndex) : base;
}

/** Vrai si le lien mène bien à cette route (`halma://auth/confirmed`, `https://…/auth/confirmed`, `exp://…/--/auth/confirmed`). */
export function linkMatchesPath(url: string, path: AuthLinkPath): boolean {
  return stripAuthParams(url).replace(/\/+$/, '').endsWith(path);
}
