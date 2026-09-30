// Lecture des demandes reçues par l'Edge Function et conversion des lignes de
// la base (noms de colonnes en snake_case) vers les types du jeu en ligne.
// Tout ce qui vient du réseau est vérifié ici, puis recopié champ par champ :
// les propriétés inattendues sont ignorées.

import { AI_LEVELS, type AiLevel, type Cell, type GameState, type Move } from '../game/index.ts';

import type { GameEndReason, GameRequest, OnlineGame, Participant, RoomStatus, StoredGame } from './types.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un chemin ne visite jamais deux fois la même case : il en compte au plus 120. */
const MAX_PATH_LENGTH = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCell(value: unknown): Cell | null {
  if (!isRecord(value) || !Number.isInteger(value.q) || !Number.isInteger(value.r)) return null;
  return { q: value.q as number, r: value.r as number };
}

/** Coup reçu d'un client, ou null s'il est mal formé (la légalité est vérifiée par le moteur). */
export function readMove(value: unknown): Move | null {
  if (!isRecord(value) || !Array.isArray(value.path)) return null;
  if (value.path.length === 0 || value.path.length > MAX_PATH_LENGTH) return null;
  const from = readCell(value.from);
  const path = value.path.map(readCell);
  if (!from || path.some((cell) => cell === null)) return null;
  return { from, path: path as Cell[] };
}

/** Demande adressée à l'Edge Function, ou null si elle est mal formée. */
export function parseGameRequest(body: unknown): GameRequest | null {
  if (!isRecord(body) || typeof body.roomId !== 'string' || !UUID.test(body.roomId)) return null;
  const roomId = body.roomId.toLowerCase();
  switch (body.action) {
    case 'start':
    case 'tick':
    case 'resign':
      return { action: body.action, roomId };
    case 'move': {
      const move = readMove(body.move);
      const turn = body.turn;
      if (!move || typeof turn !== 'number' || !Number.isInteger(turn) || turn < 0) return null;
      return { action: 'move', roomId, turn, move };
    }
    default:
      return null;
  }
}

export function isAiLevel(value: unknown): value is AiLevel {
  return typeof value === 'string' && (AI_LEVELS as readonly string[]).includes(value);
}

// --- Lignes de la base -------------------------------------------------------

export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  status: RoomStatus;
  created_at: string;
}

export interface RoomPlayerRow {
  id: string;
  room_id: string;
  seat: number;
  user_id: string | null;
  ai_level: string | null;
  player_index: number | null;
  last_seen_at: string;
}

export interface GameRow {
  id: string;
  room_id: string;
  state: GameState;
  version: number;
  forfeited: number[] | null;
  status: 'playing' | 'finished';
  winner: number | null;
  end_reason: GameEndReason | null;
}

/** Colonnes à lire pour chaque table. */
export const ROOM_COLUMNS = 'id, code, host_id, status, created_at';
export const ROOM_PLAYER_COLUMNS = 'id, room_id, seat, user_id, ai_level, player_index, last_seen_at';
export const GAME_COLUMNS = 'id, room_id, state, version, forfeited, status, winner, end_reason';

export function participantFromRow(row: RoomPlayerRow): Participant {
  return {
    id: row.id,
    seat: row.seat,
    userId: row.user_id,
    aiLevel: isAiLevel(row.ai_level) ? row.ai_level : null,
    playerIndex: row.player_index,
    lastSeenAt: row.last_seen_at,
  };
}

/** Participants dans l'ordre des places (qui est aussi l'ordre du tour). */
export function participantsFromRows(rows: readonly RoomPlayerRow[]): Participant[] {
  return rows.map(participantFromRow).sort((a, b) => a.seat - b.seat);
}

export function storedGameFromRow(row: GameRow): StoredGame {
  return {
    id: row.id,
    roomId: row.room_id,
    version: row.version,
    state: row.state,
    forfeited: row.forfeited ?? [],
    endReason: row.end_reason,
  };
}

/** Colonnes à écrire pour enregistrer une partie (hors identifiant et version). */
export function gameColumns(game: OnlineGame) {
  return {
    state: game.state,
    forfeited: game.forfeited,
    status: game.state.status,
    winner: game.state.winner,
    end_reason: game.endReason,
  };
}
