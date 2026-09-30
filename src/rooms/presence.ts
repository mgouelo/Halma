// Qui est connecté, et quand demander au serveur de faire avancer la partie
// (coup d'une IA, forfait d'un joueur déconnecté). Le serveur revérifie tout :
// ces calculs ne servent qu'à l'affichage et à éviter les appels inutiles.

import {
  aiToPlay,
  FORFEIT_AFTER_MS,
  isGameOver,
  OFFLINE_AFTER_MS,
  parseTimestamp,
  type Participant,
  type StoredGame,
} from '@/online';

/** Délai avant de demander le coup d'une IA : le temps de voir le coup précédent. */
export const AI_TURN_DELAY_MS = 700;
/** Délai de secours, pour les autres joueurs, si celui qui devait le demander ne l'a pas fait. */
export const AI_TURN_FALLBACK_MS = 4000;
/** Intervalle des demandes de forfait tant qu'un joueur semble parti. */
export const FORFEIT_CHECK_INTERVAL_MS = 10_000;

/** Vrai si le participant a donné signe de vie récemment (une IA est toujours là). */
export function isOnline(participant: Participant, now: number): boolean {
  if (participant.userId === null) return true;
  const seen = parseTimestamp(participant.lastSeenAt);
  return Number.isNaN(seen) || now - seen < OFFLINE_AFTER_MS;
}

/** Secondes restantes avant le forfait d'un joueur déconnecté (null s'il est connecté). */
export function secondsBeforeForfeit(participant: Participant, now: number): number | null {
  if (isOnline(participant, now)) return null;
  const left = parseTimestamp(participant.lastSeenAt) + FORFEIT_AFTER_MS - now;
  return Math.max(0, Math.ceil(left / 1000));
}

export interface TickPlan {
  /** Délai avant de demander le coup de l'IA dont c'est le tour, ou null. */
  aiDelay: number | null;
  /** Vrai si un joueur semble déconnecté depuis assez longtemps pour être déclaré forfait. */
  checkForfeits: boolean;
}

/**
 * Ce que ce client doit demander au serveur. Pour le coup d'une IA, un seul
 * joueur s'en charge vite : le premier humain connecté encore en jeu, dans
 * l'ordre des places ; les autres ne le font qu'en secours.
 */
export function planTicks(game: StoredGame, participants: readonly Participant[], userId: string, now: number): TickPlan {
  if (isGameOver(game)) return { aiDelay: null, checkForfeits: false };
  const inGame = participants.filter((p) => p.playerIndex !== null && !game.forfeited.includes(p.playerIndex));
  const humans = inGame.filter((p) => p.userId !== null);
  const driver = humans.find((p) => p.userId === userId || isOnline(p, now));
  const aiDelay = aiToPlay(game, participants)
    ? driver?.userId === userId
      ? AI_TURN_DELAY_MS
      : AI_TURN_FALLBACK_MS
    : null;
  const checkForfeits = humans.some(
    (p) => p.userId !== userId && now - parseTimestamp(p.lastSeenAt) > FORFEIT_AFTER_MS,
  );
  return { aiDelay, checkForfeits };
}
