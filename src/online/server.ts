// Traitement des demandes de l'Edge Function `game-action`, indépendant de
// Supabase : la base est vue à travers `GameStore`. L'Edge Function fournit
// l'implémentation réelle ; les tests, une implémentation en mémoire.
//
// Chaque demande suit le même schéma : lire la room, ses participants et la
// partie ; décider avec l'arbitre (qui s'appuie sur le moteur src/game) ;
// écrire la nouvelle partie seulement si sa version n'a pas changé depuis la
// lecture. En cas d'écriture concurrente, la demande est rejouée sur l'état frais.

import { createGame, isPlayerCount, type AiOptions, type GameState } from '../game/index.ts';

import { FORFEIT_AFTER_MS, SERVER_AI_TIME_LIMIT_MS } from './constants.ts';
import { ONLINE_ERROR_MESSAGES, OnlineError } from './errors.ts';
import { parseGameRequest } from './protocol.ts';
import { advance, resign, submitMove, type Ruling } from './referee.ts';
import type { GameRequest, GameResponse, OnlineErrorCode, OnlineGame, Participant, RoomRecord, StoredGame } from './types.ts';

export interface LoadedRoom {
  room: RoomRecord;
  /** Dans l'ordre des places. */
  participants: Participant[];
  game: StoredGame | null;
}

export interface GameStore {
  /** Room, participants et partie ; null si la room n'existe pas. */
  load(roomId: string): Promise<LoadedRoom | null>;
  /**
   * Enregistre la partie et passe la room en jeu, en une transaction qui
   * revérifie l'hôte, le statut et le nombre de participants (lève `OnlineError`).
   */
  begin(roomId: string, hostId: string, state: GameState): Promise<void>;
  /** Écrit `next` si la partie est toujours à la version de `current` ; sinon renvoie null. */
  save(current: StoredGame, next: OnlineGame): Promise<StoredGame | null>;
}

export interface ServerOptions {
  /** Horloge (ms). Défaut : `Date.now`. */
  now?: () => number;
  forfeitAfterMs?: number;
  /** Options des IA (limite de temps, hasard). */
  ai?: AiOptions;
  /** Nombre de tentatives en cas d'écriture concurrente. Défaut : 3. */
  maxAttempts?: number;
}

function failure(code: OnlineErrorCode, message: string = ONLINE_ERROR_MESSAGES[code]): GameResponse {
  return { ok: false, code, message };
}

/** Décision de l'arbitre pour une demande sur une partie en cours. */
function decide(
  request: Exclude<GameRequest, { action: 'start' }>,
  game: OnlineGame,
  participants: Participant[],
  userId: string,
  options: ServerOptions,
): Ruling {
  switch (request.action) {
    case 'move':
      return submitMove(game, participants, userId, request.move, request.turn);
    case 'resign':
      return resign(game, participants, userId);
    case 'tick':
      return {
        ok: true,
        game: advance(game, participants, (options.now ?? Date.now)(), {
          forfeitAfterMs: options.forfeitAfterMs ?? FORFEIT_AFTER_MS,
          timeLimitMs: SERVER_AI_TIME_LIMIT_MS,
          ...options.ai,
        }),
      };
  }
}

async function start(store: GameStore, loaded: LoadedRoom, userId: string): Promise<GameResponse> {
  const { room, participants } = loaded;
  if (room.hostId !== userId) return failure('not_host');
  if (room.status !== 'waiting') return failure('room_started');
  const count = participants.length;
  if (!isPlayerCount(count)) return failure('not_enough_players');
  await store.begin(room.id, userId, createGame(count));
  const after = await store.load(room.id);
  return { ok: true, game: after?.game ?? null };
}

/**
 * Traite une demande d'un utilisateur authentifié (`userId`, null si le jeton
 * est absent ou invalide). Ne lève jamais : les erreurs deviennent des réponses.
 */
export async function handleGameRequest(
  body: unknown,
  userId: string | null,
  store: GameStore,
  options: ServerOptions = {},
): Promise<GameResponse> {
  if (!userId) return failure('not_authenticated');
  const request = parseGameRequest(body);
  if (!request) return failure('bad_request');

  try {
    const attempts = options.maxAttempts ?? 3;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const loaded = await store.load(request.roomId);
      // Une room dont on ne fait pas partie est traitée comme inexistante.
      if (!loaded || !loaded.participants.some((p) => p.userId === userId)) return failure('room_not_found');
      if (request.action === 'start') return await start(store, loaded, userId);

      const { game, participants } = loaded;
      if (!game) return failure('game_not_started');
      const ruling = decide(request, game, participants, userId, options);
      if (!ruling.ok) return ruling;
      // Rien n'a changé (par exemple un « tick » sans forfait ni IA à faire jouer).
      if (ruling.game === game) return { ok: true, game };

      const saved = await store.save(game, ruling.game);
      if (saved) return { ok: true, game: saved };
    }
    return failure('conflict');
  } catch (error) {
    if (error instanceof OnlineError) return failure(error.code, error.message);
    console.error(error);
    return failure('server_error');
  }
}
