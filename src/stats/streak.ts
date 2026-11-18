// Série de connexion : jour calendaire de Paris et série à afficher.
// Le serveur fait foi : seule la fonction SQL advance_login_streak (appelee par
// record_daily_login, jour de Paris lu sur l'horloge du serveur) fait avancer
// la série. Ce module sert seulement à afficher une série à jour même si la
// connexion du jour n'a pas encore été enregistrée (hors ligne, par exemple).

/** Fuseau des jours de connexion : un jour commence à minuit, heure de Paris. */
const STREAK_TIME_ZONE = 'Europe/Paris';

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
 * Série actuelle à afficher le jour `today` : la série enregistrée tient
 * encore si la dernière connexion date d'aujourd'hui ou d'hier ; sinon elle est
 * rompue (0 en attendant la prochaine connexion enregistrée).
 */
export function displayedStreak(state: StreakState, today: string): number {
  if (state.lastLoginDay === null) return 0;
  const gap = daysBetween(state.lastLoginDay, today);
  return gap <= 1 ? state.currentStreak : 0;
}
