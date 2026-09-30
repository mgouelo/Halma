// Délais du jeu en ligne (millisecondes).

/** Intervalle entre deux signes de vie (heartbeat) d'un client dans une room. */
export const HEARTBEAT_INTERVAL_MS = 10_000;

/** Sans signe de vie depuis ce délai, un joueur est affiché comme déconnecté. */
export const OFFLINE_AFTER_MS = 25_000;

/**
 * Sans signe de vie depuis ce délai, un joueur est déclaré forfait : ses pions
 * sont retirés et la partie continue sans lui. Revenir avant suffit à reprendre
 * la partie.
 */
export const FORFEIT_AFTER_MS = 120_000;

/** Temps de réflexion maximal d'une IA « difficile » côté serveur. */
export const SERVER_AI_TIME_LIMIT_MS = 600;

/** Nombre de participants (humains et IA) d'une partie en ligne. */
export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 6;
