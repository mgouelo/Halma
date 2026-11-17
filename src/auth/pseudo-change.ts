// Changement de pseudo depuis le profil : délai entre deux changements. Le
// délai est imposé par la base (change_pseudo) ; ce module sert seulement à
// l'annoncer à l'avance (le message est dans src/auth/errors.ts).

import { GUEST_PSEUDO_PREFIX } from './validation';

/** Délai minimal entre deux changements de pseudo (même valeur que change_pseudo côté base). */
export const PSEUDO_CHANGE_DELAY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Profil tel que lu par l'application (seulement ce qui compte pour le délai). */
export interface PseudoState {
  pseudo: string;
  pseudo_changed_at: string | null;
}

/**
 * Date à partir de laquelle le joueur pourra changer de pseudo, ou null s'il
 * le peut déjà. Le premier choix d'un invité (pseudo « invite-… ») et un
 * pseudo jamais changé depuis l'inscription ne sont pas soumis au délai.
 */
export function nextPseudoChange(profile: PseudoState, now: Date = new Date()): Date | null {
  if (profile.pseudo.startsWith(GUEST_PSEUDO_PREFIX) || !profile.pseudo_changed_at) return null;
  const changedAt = Date.parse(profile.pseudo_changed_at);
  if (Number.isNaN(changedAt)) return null;
  const next = new Date(changedAt + PSEUDO_CHANGE_DELAY_DAYS * DAY_MS);
  return next.getTime() > now.getTime() ? next : null;
}
