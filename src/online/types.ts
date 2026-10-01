// Types du jeu en ligne, partagés entre l'application et l'Edge Function.
// Comme src/game, ce dossier est en TypeScript pur et importe ses voisins avec
// l'extension « .ts » pour être lisible tel quel par Deno.

import type { AiLevel, GameState, Move, PlayerId } from '../game/index.ts';

export type RoomStatus = 'waiting' | 'playing' | 'finished';

/**
 * Raison de la fin d'une partie :
 * - `win` : un joueur a rempli sa branche d'arrivée ;
 * - `forfeit` : tous les autres joueurs ont abandonné ou ont été déclarés forfait ;
 * - `abandoned` : plus aucun joueur humain en jeu (il ne reste que des IA).
 */
export type GameEndReason = 'win' | 'forfeit' | 'abandoned';

/** Participant d'une room (ligne de `room_players`) : un humain ou une IA. */
export interface Participant {
  id: string;
  seat: number;
  /** Compte du joueur, ou null pour une IA. */
  userId: string | null;
  /** Niveau de l'IA, ou null pour un humain. */
  aiLevel: AiLevel | null;
  /** Identifiant dans le moteur, attribué au lancement (null avant). */
  playerIndex: PlayerId | null;
  /** Dernier signe de vie du client (ISO 8601). */
  lastSeenAt: string;
}

export interface RoomRecord {
  id: string;
  hostId: string;
  status: RoomStatus;
}

/** Partie en ligne : l'état du moteur plus ce que le moteur ne connaît pas (forfaits, fin). */
export interface OnlineGame {
  state: GameState;
  /** Joueurs déclarés forfait ; leurs pions ont été retirés du plateau. */
  forfeited: PlayerId[];
  /** Null tant que la partie continue. */
  endReason: GameEndReason | null;
}

/** Partie telle qu'enregistrée (ligne de `games`). */
export interface StoredGame extends OnlineGame {
  id: string;
  roomId: string;
  /** Incrémentée à chaque écriture (verrou optimiste). */
  version: number;
}

/** Demandes acceptées par l'Edge Function `game-action`. */
export type GameRequest =
  /** L'hôte lance la partie. */
  | { action: 'start'; roomId: string }
  /** Le joueur dont c'est le tour joue `move` ; `turn` est le numéro du coup qu'il a vu. */
  | { action: 'move'; roomId: string; turn: number; move: Move }
  /** Fait avancer la partie : forfaits des joueurs déconnectés, puis un coup d'IA si c'est son tour. */
  | { action: 'tick'; roomId: string }
  /** Le joueur abandonne. */
  | { action: 'resign'; roomId: string };

export type GameAction = GameRequest['action'];

export type GameResponse =
  | { ok: true; game: StoredGame | null }
  | { ok: false; code: OnlineErrorCode; message: string };

/** Codes d'erreur communs à la base (fonctions SQL), à l'Edge Function et à l'application. */
export type OnlineErrorCode =
  | 'not_authenticated'
  | 'bad_request'
  | 'room_not_found'
  | 'room_full'
  | 'room_started'
  | 'not_host'
  | 'not_enough_players'
  | 'not_in_game'
  | 'game_not_started'
  | 'game_over'
  | 'forfeited'
  | 'not_your_turn'
  | 'stale_turn'
  | 'illegal_move'
  | 'conflict'
  | 'too_many_attempts'
  | 'already_in_room'
  | 'server_error';
