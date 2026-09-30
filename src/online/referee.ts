// Arbitre des parties en ligne : règles propres au jeu en ligne (qui joue quel
// pion, forfaits, fin de partie sans vainqueur), au-dessus du moteur.
// Fonctions pures : l'Edge Function les appelle entre la lecture et
// l'écriture de la partie ; les tests les appellent directement.

import {
  applyMove,
  chooseMove,
  hasAnyLegalMove,
  validateMove,
  type AiOptions,
  type GameState,
  type Move,
  type PlayerId,
} from '../game/index.ts';

import { ONLINE_ERROR_MESSAGES } from './errors.ts';
import type { OnlineErrorCode, OnlineGame, Participant } from './types.ts';

export type Rejection = { ok: false; code: OnlineErrorCode; message: string };

export type Ruling = { ok: true; game: OnlineGame } | Rejection;

function reject(code: OnlineErrorCode, message: string = ONLINE_ERROR_MESSAGES[code]): Rejection {
  return { ok: false, code, message };
}

export function newOnlineGame(state: GameState): OnlineGame {
  return { state, forfeited: [], endReason: null };
}

export function isGameOver(game: OnlineGame): boolean {
  return game.endReason !== null || game.state.status !== 'playing';
}

export function participantOfUser<P extends Participant>(participants: readonly P[], userId: string): P | undefined {
  return participants.find((p) => p.userId === userId);
}

export function participantOfPlayer<P extends Participant>(participants: readonly P[], player: PlayerId): P | undefined {
  return participants.find((p) => p.playerIndex === player);
}

/**
 * Date d'un horodatage Postgres (ISO 8601, jusqu'à la microseconde), en
 * millisecondes. Les fractions au-delà de la milliseconde sont ignorées : tous
 * les moteurs JavaScript ne les acceptent pas. NaN si illisible.
 */
export function parseTimestamp(value: string): number {
  return Date.parse(value.replace(/(\.\d{3})\d+/, '$1'));
}

/** Joueur (identifiant du moteur) de l'utilisateur, s'il peut encore agir sur la partie. */
function activePlayerOf(
  game: OnlineGame,
  participants: readonly Participant[],
  userId: string,
): { ok: true; player: PlayerId } | Rejection {
  const participant = participantOfUser(participants, userId);
  if (!participant || participant.playerIndex === null) return reject('not_in_game');
  if (game.forfeited.includes(participant.playerIndex)) return reject('forfeited');
  if (isGameOver(game)) return reject('game_over');
  return { ok: true, player: participant.playerIndex };
}

function finish(game: OnlineGame, winner: PlayerId | null, endReason: 'forfeit' | 'abandoned'): OnlineGame {
  return { ...game, state: { ...game.state, status: 'finished', winner }, endReason };
}

/** Prochain joueur (après `player`, dans l'ordre du tour) qui a un coup possible, ou null. */
function nextPlayerAfter(state: GameState, player: PlayerId): PlayerId | null {
  const count = state.players.length;
  for (let i = 1; i <= count; i++) {
    const candidate = (player + i) % count;
    if (hasAnyLegalMove(state, candidate)) return candidate;
  }
  return null;
}

/**
 * Termine la partie si elle ne peut plus continuer après des forfaits :
 * - plus aucun humain en jeu : partie abandonnée (les IA ne jouent pas seules) ;
 * - un seul participant restant : il gagne par forfait ;
 * - personne ne peut plus bouger : partie abandonnée (cas extrême).
 * Sinon, s'assure que la main est à un joueur qui peut jouer.
 */
function settle(game: OnlineGame, participants: readonly Participant[]): OnlineGame {
  if (isGameOver(game)) return game;
  const active = participants.filter((p) => p.playerIndex !== null && !game.forfeited.includes(p.playerIndex));
  if (!active.some((p) => p.userId !== null)) return finish(game, null, 'abandoned');
  if (active.length === 1) return finish(game, active[0].playerIndex, 'forfeit');

  const { state } = game;
  if (hasAnyLegalMove(state, state.currentPlayer)) return game;
  const next = nextPlayerAfter(state, state.currentPlayer);
  if (next === null) return finish(game, null, 'abandoned');
  return { ...game, state: { ...state, currentPlayer: next } };
}

/**
 * Déclare forfait des joueurs : leurs pions sont retirés du plateau (ils ne
 * bloquent ni les passages ni les branches d'arrivée des autres) et le moteur
 * les saute désormais, puisqu'ils n'ont plus de coup possible. Si c'était le
 * tour de l'un d'eux, la main passe au suivant. Renvoie la partie inchangée
 * (même objet) s'il n'y a rien à faire.
 */
export function forfeitPlayers(
  game: OnlineGame,
  participants: readonly Participant[],
  players: readonly PlayerId[],
): OnlineGame {
  if (isGameOver(game)) return game;
  const count = game.state.players.length;
  const newcomers = [...new Set(players)].filter(
    (p) => Number.isInteger(p) && p >= 0 && p < count && !game.forfeited.includes(p),
  );
  if (newcomers.length === 0) return game;

  const board: GameState['board'] = {};
  for (const [key, owner] of Object.entries(game.state.board)) {
    if (!newcomers.includes(owner)) board[key] = owner;
  }
  let state: GameState = { ...game.state, board };
  if (newcomers.includes(state.currentPlayer)) {
    const next = nextPlayerAfter(state, state.currentPlayer);
    if (next !== null) state = { ...state, currentPlayer: next };
  }
  const forfeited = [...game.forfeited, ...newcomers].sort((a, b) => a - b);
  return settle({ ...game, state, forfeited }, participants);
}

/** Partie après un coup appliqué par le moteur. */
function afterMove(game: OnlineGame, state: GameState): OnlineGame {
  return { ...game, state, endReason: state.status === 'finished' ? 'win' : null };
}

/**
 * Valide et applique le coup d'un joueur humain. Refuse si l'utilisateur ne
 * joue pas dans la partie, a abandonné, si ce n'est pas son tour, si la partie
 * a avancé depuis le coup qu'il a vu (`turn`), ou si le moteur juge le coup
 * illégal (n'importe quel chemin valide est accepté).
 */
export function submitMove(
  game: OnlineGame,
  participants: readonly Participant[],
  userId: string,
  move: Move,
  turn: number,
): Ruling {
  const seat = activePlayerOf(game, participants, userId);
  if (!seat.ok) return seat;
  const { state } = game;
  if (turn !== state.turn) return reject('stale_turn');
  if (state.currentPlayer !== seat.player) return reject('not_your_turn');
  const validation = validateMove(state, move);
  if (!validation.ok) return reject('illegal_move', `Coup refusé : ${validation.reason}.`);
  return { ok: true, game: afterMove(game, applyMove(state, move)) };
}

/** Le joueur abandonne la partie (forfait immédiat). */
export function resign(game: OnlineGame, participants: readonly Participant[], userId: string): Ruling {
  const seat = activePlayerOf(game, participants, userId);
  if (!seat.ok) return seat;
  return { ok: true, game: forfeitPlayers(game, participants, [seat.player]) };
}

/** Joueurs humains encore en jeu sans signe de vie depuis plus de `forfeitAfterMs`. */
export function stalePlayers(
  game: OnlineGame,
  participants: readonly Participant[],
  now: number,
  forfeitAfterMs: number,
): PlayerId[] {
  if (isGameOver(game)) return [];
  return participants
    .filter(
      (p) =>
        p.userId !== null &&
        p.playerIndex !== null &&
        !game.forfeited.includes(p.playerIndex) &&
        now - parseTimestamp(p.lastSeenAt) > forfeitAfterMs,
    )
    .map((p) => p.playerIndex as PlayerId);
}

/** IA dont c'est le tour, ou null. */
export function aiToPlay(game: OnlineGame, participants: readonly Participant[]): Participant | null {
  if (isGameOver(game)) return null;
  const participant = participantOfPlayer(participants, game.state.currentPlayer);
  return participant?.aiLevel ? participant : null;
}

/** Fait jouer l'IA dont c'est le tour ; renvoie la partie inchangée (même objet) si ce n'est pas à une IA. */
export function playAiTurn(game: OnlineGame, participants: readonly Participant[], options: AiOptions = {}): OnlineGame {
  const ai = aiToPlay(game, participants);
  if (!ai?.aiLevel) return game;
  const move = chooseMove(game.state, ai.aiLevel, options);
  if (!move) return game;
  return afterMove(game, applyMove(game.state, move));
}

/**
 * Fait avancer la partie sans action d'un joueur : déclare forfait les joueurs
 * déconnectés depuis trop longtemps, puis fait jouer un coup à l'IA dont c'est
 * le tour. Un seul coup d'IA par appel : chaque appel reste court (limite de
 * temps de calcul des Edge Functions) et les clients voient chaque coup.
 */
export function advance(
  game: OnlineGame,
  participants: readonly Participant[],
  now: number,
  options: { forfeitAfterMs: number } & AiOptions,
): OnlineGame {
  const { forfeitAfterMs, ...aiOptions } = options;
  const afterForfeits = forfeitPlayers(game, participants, stalePlayers(game, participants, now, forfeitAfterMs));
  return playAiTurn(afterForfeits, participants, aiOptions);
}
