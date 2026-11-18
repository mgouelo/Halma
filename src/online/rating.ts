// Points (MMR) des parties en ligne classées : quelles parties comptent, qui
// gagne ou perd des points, et combien (variante d'Elo). TypeScript pur,
// partagé par l'Edge Function `game-action` (qui calcule les variations) et
// par l'application (qui sait ainsi si une partie peut être classée).
//
// La fonction SQL `record_game_rating` (migration rating) applique le
// résultat de façon idempotente, revérifie le nombre d'humains, les coups des
// humains et le plafond quotidien par paire de joueurs, et verrouille les
// points des joueurs pour éviter les courses entre parties simultanées.

import type { PlayerId } from '../game/index.ts';

import type { OnlineGame, Participant } from './types.ts';

/** Points à la création du compte. */
export const RATING_START = 0;
/** Plancher : les points ne descendent jamais plus bas. */
export const RATING_FLOOR = -999;
/**
 * Échelle S de la formule : un écart de S points donne au plus fort environ
 * 10 chances contre 1 (attendu E ≈ 0,91). Plus S est grand, plus les écarts
 * comptent peu.
 */
export const RATING_SCALE = 200;
/**
 * Gain d'une victoire a niveau egal. Le systeme n'est pas a somme nulle : a
 * niveau egal le gagnant prend 30 points et le perdant n'en perd que 15, donc
 * la moyenne des points monte avec le nombre de parties classees.
 */
export const WIN_POINTS = 30;
/** Perte d'une défaite à niveau égal. */
export const LOSS_POINTS = 15;
/** Une victoire rapporte au moins ce nombre de points, et une défaite en coûte au moins autant. */
export const MIN_POINTS = 1;
/** Coups joués par des humains (au total) pour qu'une partie soit classée ; les coups d'IA ne comptent pas. */
export const MIN_HUMAN_MOVES = 10;
/** Parties classées par jour (jour de Paris) entre deux mêmes comptes, au plus (vérifié par la base). */
export const MAX_RANKED_GAMES_PER_PAIR_PER_DAY = 3;

/**
 * Résultat attendu de `me` contre `opponent` (entre 0 et 1) :
 * E = 1 / (1 + 10^((adversaire - moi) / S)).
 */
export function expectedScore(me: number, opponent: number, scale: number = RATING_SCALE): number {
  return 1 / (1 + 10 ** ((opponent - me) / scale));
}

/** Gain d'une victoire : 2 × 30 × (1 − E), arrondi, au moins 1. */
export function winPoints(me: number, opponent: number, scale: number = RATING_SCALE): number {
  return Math.max(MIN_POINTS, Math.round(2 * WIN_POINTS * (1 - expectedScore(me, opponent, scale))));
}

/** Perte d'une défaite (nombre positif) : 2 × 15 × E, arrondi, au moins 1. */
export function lossPoints(me: number, opponent: number, scale: number = RATING_SCALE): number {
  return Math.max(MIN_POINTS, Math.round(2 * LOSS_POINTS * expectedScore(me, opponent, scale)));
}

/** Points après une variation, plancher compris. */
export function applyRatingDelta(rating: number, delta: number): number {
  return Math.max(RATING_FLOOR, rating + delta);
}

function average(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Rôle de chaque humain dans le calcul :
 * - `win` : gagne, mesuré contre la moyenne des humains de `against` ;
 * - `loss` : perd, mesuré contre la moyenne des humains de `against` ;
 * - `none` : ni gain ni perte (mais la partie compte pour lui : elle est classée).
 */
export type RatingRole =
  | { userId: string; result: 'win' | 'loss'; against: string[] }
  | { userId: string; result: 'none' };

/** Raison pour laquelle une partie n'est pas classée. */
export type UnrankedReason =
  | 'not_finished'
  | 'not_enough_humans'
  | 'no_human_left'
  | 'too_few_human_moves'
  /** Décidé par la base : plafond de parties classées par jour pour une paire de joueurs. */
  | 'pair_daily_limit';

export type RatingOutcome = { ranked: true; roles: RatingRole[] } | { ranked: false; reason: UnrankedReason };

/** Humains de la partie au lancement (ceux qui ont un compte et une place dans le moteur). */
function humansOf(participants: readonly Participant[]): (Participant & { userId: string; playerIndex: PlayerId })[] {
  return participants.filter(
    (p): p is Participant & { userId: string; playerIndex: PlayerId } => p.userId !== null && p.playerIndex !== null,
  );
}

/** Coups joués par des humains (historique du moteur). */
export function humanMoveCount(game: OnlineGame, participants: readonly Participant[]): number {
  const humans = new Set(humansOf(participants).map((p) => p.playerIndex));
  return game.state.history.filter((entry) => humans.has(entry.player)).length;
}

/**
 * Qui gagne et qui perd des points dans une partie finie (sans les montants) :
 * - moins de 2 humains au lancement, aucun humain restant, ou moins de
 *   `MIN_HUMAN_MOVES` coups d'humains : partie non classée ;
 * - un humain gagne (fin par victoire, ou dernier en jeu après les abandons) :
 *   il gagne contre la moyenne des autres humains ; chacun des autres perd
 *   contre lui (ceux qui sont partis compris) ;
 * - sinon (une IA gagne) : les humains restants ne bougent pas ; ceux qui ont
 *   abandonné ou ont été déclarés forfait perdent contre la moyenne des autres humains.
 * Les IA n'ont pas de points et ne comptent dans aucune moyenne.
 */
export function ratingOutcome(game: OnlineGame, participants: readonly Participant[]): RatingOutcome {
  if (game.endReason === null || game.state.status !== 'finished') return { ranked: false, reason: 'not_finished' };
  const humans = humansOf(participants);
  if (humans.length < 2) return { ranked: false, reason: 'not_enough_humans' };
  const left = humans.filter((h) => game.forfeited.includes(h.playerIndex));
  if (left.length === humans.length) return { ranked: false, reason: 'no_human_left' };
  if (humanMoveCount(game, participants) < MIN_HUMAN_MOVES) return { ranked: false, reason: 'too_few_human_moves' };

  const others = (userId: string) => humans.filter((h) => h.userId !== userId).map((h) => h.userId);
  const winnerIndex = game.state.winner;
  const winner =
    winnerIndex === null || game.forfeited.includes(winnerIndex)
      ? undefined
      : humans.find((h) => h.playerIndex === winnerIndex);

  if (winner) {
    return {
      ranked: true,
      roles: humans.map((h) =>
        h.userId === winner.userId
          ? { userId: h.userId, result: 'win', against: others(h.userId) }
          : { userId: h.userId, result: 'loss', against: [winner.userId] },
      ),
    };
  }
  return {
    ranked: true,
    roles: humans.map((h) =>
      game.forfeited.includes(h.playerIndex)
        ? { userId: h.userId, result: 'loss', against: others(h.userId) }
        : { userId: h.userId, result: 'none' },
    ),
  };
}

/** Variation des points d'un joueur, telle qu'envoyée à `record_game_rating`. */
export interface RatingChange {
  userId: string;
  before: number;
  after: number;
  delta: number;
}

/**
 * Montants : chacun se mesure à la moyenne des points (avant la partie) des
 * humains de `against`. Un joueur sans points enregistrés part de `RATING_START`.
 */
export function ratingChanges(roles: readonly RatingRole[], ratings: Readonly<Record<string, number>>): RatingChange[] {
  const ratingOf = (userId: string) => ratings[userId] ?? RATING_START;
  // `against` n'est jamais vide pour un gain ou une perte : `ratingOutcome` ne
  // classe une partie qu'avec au moins deux humains. `delta` est la variation
  // reelle (apres plancher), pas le montant brut : c'est elle qui est envoyee a la base.
  return roles.map((role) => {
    const before = ratingOf(role.userId);
    let raw = 0;
    if (role.result !== 'none') {
      const opponent = average(role.against.map(ratingOf));
      raw = role.result === 'win' ? winPoints(before, opponent) : -lossPoints(before, opponent);
    }
    const after = applyRatingDelta(before, raw);
    return { userId: role.userId, before, after, delta: after - before };
  });
}
