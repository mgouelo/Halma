// Changement de pseudo depuis le profil : délai entre deux changements et
// messages d'erreur. Le délai est imposé par la base (change_pseudo) ; ce
// module sert seulement à l'annoncer à l'avance et à traduire les refus.

import { GUEST_PSEUDO_PREFIX } from './validation';

/** Délai minimal entre deux changements de pseudo (même valeur que change_pseudo côté base). */
export const PSEUDO_CHANGE_DELAY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** « 21 novembre » (avec l'année si elle n'est pas celle de `now`), à l'heure de l'appareil. */
export function formatDay(date: Date, now: Date = new Date()): string {
  const day = date.getDate() === 1 ? '1er' : String(date.getDate());
  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${day} ${MONTHS[date.getMonth()]}${year}`;
}

/** « à 15 h 38 », à l'heure de l'appareil. */
function formatTime(date: Date): string {
  return `${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
}

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

/** Message affiché quand le délai n'est pas écoulé. */
export function tooSoonMessage(next: Date | null, now: Date = new Date()): string {
  const base = `Tu ne peux changer de pseudo qu’une fois tous les ${PSEUDO_CHANGE_DELAY_DAYS} jours.`;
  if (!next) return base;
  return `${base} Prochain changement possible le ${formatDay(next, now)} à ${formatTime(next)}.`;
}

/** Messages des refus de change_pseudo (codes renvoyés par la base). */
export const PSEUDO_ERROR_MESSAGES = {
  pseudo_taken: 'Ce pseudo est déjà pris.',
  pseudo_invalid: 'Ce pseudo n’est pas autorisé.',
  pseudo_reserved: 'Ce début de pseudo est réservé aux invités.',
} as const;
