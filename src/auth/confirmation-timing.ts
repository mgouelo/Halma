// Rythme de la détection automatique d'une validation d'e-mail faite ailleurs.

import { msg } from '@/i18n';

/**
 * Inscription : on retente la connexion. Supabase limite les connexions par
 * adresse IP (environ 30 toutes les 5 minutes) : une tentative toutes les 15 s
 * laisse de la marge.
 */
export const SIGNUP_POLL_MS = 15_000;

/** Invité qui a ajouté un e-mail : simple relecture du compte, peu coûteuse. */
export const GUEST_POLL_MS = 5_000;

/** Message montré sur l'accueil une fois le compte validé (traduit à l'affichage). */
export const CONFIRMED_NOTICE = msg('confirmed.notice');
