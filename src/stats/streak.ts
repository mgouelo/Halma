// Série de connexion : jour calendaire de Paris et série à afficher.
// Le serveur fait foi (fonction SQL record_daily_login, même règle) ; ce module
// sert à afficher une série à jour même si la connexion du jour n'a pas encore
// été enregistrée (hors ligne, par exemple).

/** Fuseau des jours de connexion : un jour commence à minuit, heure de Paris. */
export const STREAK_TIME_ZONE = 'Europe/Paris';

/** Jour calendaire à Paris (AAAA-MM-JJ) de l'instant `date`. */
export function parisDay(date: Date): string {
  try {
    // « en-CA » écrit les dates au format AAAA-MM-JJ.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: STREAK_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    // Moteur sans fuseaux horaires : à un jour près autour de minuit, c'est l'affichage seul qui se trompe.
    return date.toISOString().slice(0, 10);
  }
}

/** Nombre de jours de `from` à `to` (dates AAAA-MM-JJ). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export interface StreakState {
  currentStreak: number;
  bestStreak: number;
  /** Dernier jour de connexion enregistré (AAAA-MM-JJ), ou null. */
  lastLoginDay: string | null;
}

/**
 * Série suivante après une connexion le jour `today` (règle du serveur) :
 * même jour = rien ; jour suivant = série + 1 ; plus d'un jour manqué (ou
 * première fois) = retour à 1. La meilleure série suit.
 */
export function nextStreak(state: StreakState, today: string): StreakState {
  if (state.lastLoginDay !== null && daysBetween(state.lastLoginDay, today) <= 0) return state;
  const current = state.lastLoginDay !== null && daysBetween(state.lastLoginDay, today) === 1 ? state.currentStreak + 1 : 1;
  return { currentStreak: current, bestStreak: Math.max(state.bestStreak, current), lastLoginDay: today };
}

/**
 * Série actuelle à afficher le jour `today` : la série enregistrée tient
 * encore si la dernière connexion date d'aujourd'hui ou d'hier ; sinon elle est
 * rompue (0 en attendant la prochaine connexion enregistrée).
 */
export function displayedStreak(state: StreakState, today: string): number {
  if (state.lastLoginDay === null) return 0;
  const gap = daysBetween(state.lastLoginDay, today);
  return gap <= 1 ? state.currentStreak : 0;
}
