// Messages en français des erreurs du jeu en ligne, et statut HTTP renvoyé par l'Edge Function.

import type { OnlineErrorCode } from './types.ts';

export const ONLINE_ERROR_MESSAGES: Record<OnlineErrorCode, string> = {
  not_authenticated: 'Connecte-toi pour jouer en ligne.',
  bad_request: 'Demande invalide.',
  room_not_found: 'Aucune room avec ce code.',
  room_full: 'Cette room est complète (6 participants).',
  room_started: 'La partie de cette room a déjà commencé.',
  not_host: 'Seul l’hôte de la room peut faire ça.',
  not_enough_players: 'Il faut de 2 à 6 participants pour lancer la partie.',
  not_in_game: 'Tu ne joues pas dans cette partie.',
  game_not_started: 'La partie n’a pas encore commencé.',
  game_over: 'La partie est terminée.',
  forfeited: 'Tu as quitté cette partie.',
  not_your_turn: 'Ce n’est pas ton tour.',
  stale_turn: 'La partie a avancé entre-temps.',
  illegal_move: 'Coup refusé.',
  conflict: 'La partie a changé en même temps. Réessaie.',
  too_many_attempts: 'Trop de codes essayés. Attends quelques minutes avant de réessayer.',
  already_in_room: 'Tu es déjà dans une room. Reprends-la ou quitte-la depuis « Jouer en ligne » avant d’en rejoindre une autre.',
  server_error: 'Le serveur rencontre un problème. Réessaie dans un moment.',
};

export const ONLINE_ERROR_STATUS: Record<OnlineErrorCode, number> = {
  not_authenticated: 401,
  bad_request: 400,
  room_not_found: 404,
  room_full: 409,
  room_started: 409,
  not_host: 403,
  not_enough_players: 409,
  not_in_game: 403,
  game_not_started: 409,
  game_over: 409,
  forfeited: 403,
  not_your_turn: 409,
  stale_turn: 409,
  illegal_move: 422,
  conflict: 409,
  too_many_attempts: 429,
  already_in_room: 409,
  server_error: 500,
};

export function isOnlineErrorCode(value: unknown): value is OnlineErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ONLINE_ERROR_MESSAGES, value);
}

/** Erreur connue du jeu en ligne, avec son code et un message à afficher. */
export class OnlineError extends Error {
  constructor(
    readonly code: OnlineErrorCode,
    message: string = ONLINE_ERROR_MESSAGES[code],
  ) {
    super(message);
    this.name = 'OnlineError';
  }
}
