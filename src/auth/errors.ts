// Messages d'erreur en français pour les échecs d'authentification.

import { FunctionsFetchError, isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

/** Échec connu côté application (avant même d'appeler Supabase). */
export class AuthFailure extends Error {
  constructor(
    readonly code: 'pseudo_taken' | 'not_configured' | 'profile_missing' | 'not_confirmed' | 'delete_failed',
    message: string,
  ) {
    super(message);
    this.name = 'AuthFailure';
  }
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou mot de passe incorrect.',
  email_not_confirmed: 'Confirme d’abord ton adresse e-mail (regarde tes messages).',
  user_already_exists: 'Un compte existe déjà avec cette adresse e-mail.',
  email_exists: 'Un compte existe déjà avec cette adresse e-mail.',
  weak_password: 'Ce mot de passe est trop faible.',
  email_address_invalid: 'Cette adresse e-mail n’est pas acceptée.',
  signup_disabled: 'Les inscriptions sont fermées pour le moment.',
  email_provider_disabled: 'La connexion par e-mail n’est pas activée sur le serveur.',
  anonymous_provider_disabled: 'Le mode invité n’est pas activé sur le serveur.',
  over_request_rate_limit: 'Trop de tentatives. Réessaie dans quelques minutes.',
  over_email_send_rate_limit: 'Trop d’e-mails envoyés. Réessaie dans quelques minutes.',
};

/** Le trigger de création de profil a échoué : en pratique, le pseudo a été pris entre-temps. */
export const PROFILE_CREATION_ERROR =
  'Impossible de créer le compte : ce pseudo vient sans doute d’être pris. Essaies-en un autre.';

export const GENERIC_ERROR = 'Une erreur est survenue. Réessaie.';
export const NETWORK_ERROR = 'Impossible de joindre le serveur. Vérifie ta connexion.';
export const SERVER_ERROR = 'Le serveur rencontre un problème. Réessaie dans un moment.';

export function describeAuthError(error: unknown): string {
  if (error instanceof AuthFailure) return error.message;
  // supabase-js range dans la même classe les coupures réseau (statut 0) et les erreurs 5xx du serveur.
  if (isAuthRetryableFetchError(error)) {
    if (!error.status) return NETWORK_ERROR;
    if (/database error saving new user/i.test(error.message)) return PROFILE_CREATION_ERROR;
    return SERVER_ERROR;
  }
  if (isAuthError(error) && error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error instanceof FunctionsFetchError) return NETWORK_ERROR;
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) return NETWORK_ERROR;
  return GENERIC_ERROR;
}
