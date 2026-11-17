// Messages d'erreur des échecs d'authentification, traduits au moment de
// l'affichage à partir du code de l'erreur (Supabase Auth, base, application).

import { FunctionsFetchError, isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

import { formatDay, formatTime, type MessageKey, type Translator } from '@/i18n';

export type AuthFailureCode =
  | 'pseudo_taken'
  | 'pseudo_invalid'
  | 'pseudo_reserved'
  | 'pseudo_too_soon'
  | 'not_configured'
  | 'profile_missing'
  | 'not_confirmed'
  | 'delete_failed'
  | 'delete_signed_out'
  | 'link_invalid';

/** Échec connu côté application (avant même d'appeler Supabase), ou refus traduit de la base. */
export class AuthFailure extends Error {
  constructor(
    readonly code: AuthFailureCode,
    /** Précisions : date du prochain changement de pseudo possible, code d'erreur d'un lien. */
    readonly detail: { next?: Date | null; linkCode?: string | null } = {},
    /** Pour les journaux seulement : l'écran fabrique son propre texte à partir du code. */
    message: string = code,
  ) {
    super(message);
    this.name = 'AuthFailure';
  }
}

/** Codes d'erreur de Supabase Auth qui ont un message dédié. */
const AUTH_CODES: Record<string, MessageKey> = {
  invalid_credentials: 'error.auth.invalid_credentials',
  email_not_confirmed: 'error.auth.email_not_confirmed',
  user_already_exists: 'error.auth.user_already_exists',
  email_exists: 'error.auth.user_already_exists',
  weak_password: 'error.auth.weak_password',
  email_address_invalid: 'error.auth.email_address_invalid',
  signup_disabled: 'error.auth.signup_disabled',
  email_provider_disabled: 'error.auth.email_provider_disabled',
  anonymous_provider_disabled: 'error.auth.anonymous_provider_disabled',
  over_request_rate_limit: 'error.auth.over_request_rate_limit',
  over_email_send_rate_limit: 'error.auth.over_email_send_rate_limit',
  same_password: 'error.auth.same_password',
  otp_expired: 'error.auth.otp_expired',
  session_expired: 'error.auth.session_expired',
  session_not_found: 'error.auth.session_expired',
  refresh_token_not_found: 'error.auth.session_expired',
  user_not_found: 'error.auth.session_expired',
};

/** Message d'un lien inutilisable (erreur dans le lien, ou refus à la vérification). */
export function linkErrorMessage(t: Translator, code: string | null | undefined): string {
  switch (code) {
    case 'otp_expired':
    case 'access_denied':
    case 'flow_state_expired':
    case 'flow_state_not_found':
      return t('error.link.expired');
    default:
      return t('error.link.invalid');
  }
}

/** Délai de changement de pseudo pas encore écoulé (avec la date du prochain changement si on la connaît). */
export function tooSoonMessage(t: Translator, delayDays: number, next: Date | null, now: Date = new Date()): string {
  const base = t('pseudo.tooSoon', { count: delayDays });
  if (!next) return base;
  return `${base} ${t('pseudo.nextChange', { day: formatDay(t, next, now), time: formatTime(t, next) })}`;
}

/** Délai d'envoi des e-mails (« you can only request this after 37 seconds »). */
function rateLimitSeconds(message: string): number | null {
  const match = /after (\d+) seconds?/i.exec(message);
  return match ? Number(match[1]) : null;
}

/** Même valeur que PSEUDO_CHANGE_DELAY_DAYS (pseudo-change.ts), qui importe ce module. */
const PSEUDO_DELAY_DAYS = 7;

function describeFailure(t: Translator, error: AuthFailure): string {
  switch (error.code) {
    case 'pseudo_too_soon':
      return tooSoonMessage(t, PSEUDO_DELAY_DAYS, error.detail.next ?? null);
    case 'link_invalid':
      return linkErrorMessage(t, error.detail.linkCode);
    default:
      return t(`error.auth.${error.code}`);
  }
}

/** Texte à afficher pour une erreur d'authentification, dans la langue de `t`. */
export function describeAuthError(t: Translator, error: unknown): string {
  if (error instanceof AuthFailure) return describeFailure(t, error);
  // supabase-js range dans la même classe les coupures réseau (statut 0) et les erreurs 5xx du serveur.
  if (isAuthRetryableFetchError(error)) {
    if (!error.status) return t('error.network');
    if (/database error saving new user/i.test(error.message)) return t('error.auth.profile_creation');
    return t('error.server');
  }
  if (isAuthError(error)) {
    const wait = rateLimitSeconds(error.message);
    if (wait !== null) return t('error.auth.email_wait', { count: wait });
    if (error.code && AUTH_CODES[error.code]) return t.msg({ key: AUTH_CODES[error.code] });
    if (error.status === 429) return t('error.auth.over_request_rate_limit');
  }
  if (error instanceof FunctionsFetchError) return t('error.network');
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) return t('error.network');
  return t('error.generic');
}
