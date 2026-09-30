// Accès aux rooms depuis l'application, au-dessus d'un client Supabase passé
// en paramètre (le vrai en production, un faux dans les tests).
// - Lecture : directement dans les tables (la RLS ne montre que ses rooms).
// - Salle d'attente : fonctions SQL (create_room, join_room…).
// - Partie : Edge Function `game-action` (lancement, coups, abandon, tick).

import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import type { AiLevel, Move } from '@/game';
import {
  GAME_COLUMNS,
  isOnlineErrorCode,
  ONLINE_ERROR_MESSAGES,
  OnlineError,
  participantFromRow,
  ROOM_COLUMNS,
  ROOM_PLAYER_COLUMNS,
  storedGameFromRow,
  type GameRequest,
  type GameResponse,
  type GameRow,
  type Participant,
  type RoomPlayerRow,
  type RoomRow,
  type RoomStatus,
  type StoredGame,
} from '@/online';

export interface RoomInfo {
  id: string;
  code: string;
  hostId: string;
  status: RoomStatus;
  createdAt: string;
}

/** Participant avec le pseudo et l'avatar du joueur (null pour une IA). */
export interface RoomPlayer extends Participant {
  pseudo: string | null;
  /** Valeur de `profiles.avatar` (null : avatar tiré de l'identifiant). */
  avatar: string | null;
}

export interface RoomSnapshot {
  room: RoomInfo;
  /** Dans l'ordre des places. */
  players: RoomPlayer[];
  game: StoredGame | null;
}

/** Room en cours du joueur, pour la reprendre depuis l'accueil. */
export interface ActiveRoom {
  id: string;
  code: string;
  status: RoomStatus;
  createdAt: string;
}

export const NETWORK_ERROR = 'Impossible de joindre le serveur. Vérifie ta connexion.';
export const GENERIC_ERROR = 'Une erreur est survenue. Réessaie.';

/** Longueur et alphabet des codes de room (sans I, L, O, 0 ni 1). */
export const ROOM_CODE_LENGTH = 6;
const ROOM_CODE = /^[A-HJKMNP-Z2-9]{6}$/;

/** Code saisi par le joueur, en majuscules et sans espaces. */
export function normalizeRoomCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE.test(code);
}

export function roomFromRow(row: RoomRow): RoomInfo {
  return { id: row.id, code: row.code, hostId: row.host_id, status: row.status, createdAt: row.created_at };
}

type ProfileEmbed = { pseudo: string; avatar: string | null };
type RoomPlayerWithProfile = RoomPlayerRow & { profiles: ProfileEmbed | ProfileEmbed[] | null };

function playerFromRow(row: RoomPlayerWithProfile): RoomPlayer {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return { ...participantFromRow(row), pseudo: profile?.pseudo ?? null, avatar: profile?.avatar ?? null };
}

/** Erreur levée par une fonction SQL : son message est un code court (room_full…). */
function rpcFailure(error: { message: string }): Error {
  return isOnlineErrorCode(error.message) ? new OnlineError(error.message) : (error as Error);
}

async function rpc<T>(client: SupabaseClient, name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw rpcFailure(error);
  return data as T;
}

/** Crée une room dont le joueur connecté est l'hôte ; renvoie son identifiant. */
export function createRoom(client: SupabaseClient): Promise<string> {
  return rpc<string>(client, 'create_room');
}

/** Rejoint une room par son code ; renvoie son identifiant. */
export async function joinRoom(client: SupabaseClient, input: string): Promise<string> {
  const code = normalizeRoomCode(input);
  if (!isValidRoomCode(code)) throw new OnlineError('room_not_found', 'Un code de room compte 6 lettres ou chiffres.');
  // Code inconnu : la base renvoie null (plutôt qu'une erreur) pour garder la
  // trace de l'essai, qui compte dans la limite d'essais (too_many_attempts).
  const roomId = await rpc<string | null>(client, 'join_room', { p_code: code });
  if (!roomId) throw new OnlineError('room_not_found');
  return roomId;
}

export function leaveRoom(client: SupabaseClient, roomId: string): Promise<void> {
  return rpc<void>(client, 'leave_room', { p_room: roomId });
}

export function addAi(client: SupabaseClient, roomId: string, level: AiLevel): Promise<string> {
  return rpc<string>(client, 'add_ai', { p_room: roomId, p_level: level });
}

export function setAiLevel(client: SupabaseClient, playerId: string, level: AiLevel): Promise<void> {
  return rpc<void>(client, 'set_ai_level', { p_player: playerId, p_level: level });
}

export function removeAi(client: SupabaseClient, playerId: string): Promise<void> {
  return rpc<void>(client, 'remove_ai', { p_player: playerId });
}

export function heartbeat(client: SupabaseClient, roomId: string): Promise<void> {
  return rpc<void>(client, 'heartbeat', { p_room: roomId });
}

/** Room, participants (avec pseudos) et partie ; null si la room est introuvable ou invisible. */
export async function fetchRoom(client: SupabaseClient, roomId: string): Promise<RoomSnapshot | null> {
  const [room, players, game] = await Promise.all([
    client.from('rooms').select(ROOM_COLUMNS).eq('id', roomId).maybeSingle<RoomRow>(),
    client
      .from('room_players')
      .select(`${ROOM_PLAYER_COLUMNS}, profiles(pseudo, avatar)`)
      .eq('room_id', roomId)
      .order('seat')
      .returns<RoomPlayerWithProfile[]>(),
    client.from('games').select(GAME_COLUMNS).eq('room_id', roomId).maybeSingle<GameRow>(),
  ]);
  if (room.error) throw room.error;
  if (players.error) throw players.error;
  if (game.error) throw game.error;
  if (!room.data) return null;
  return {
    room: roomFromRow(room.data),
    players: (players.data ?? []).map(playerFromRow),
    game: game.data ? storedGameFromRow(game.data) : null,
  };
}

/**
 * Rooms en attente ou en cours du joueur, les plus récentes d'abord. Les parties
 * qu'il a quittées (forfait ou abandon) n'y figurent pas.
 */
export async function fetchActiveRooms(client: SupabaseClient, userId: string): Promise<ActiveRoom[]> {
  const seats = await client
    .from('room_players')
    .select('room_id, player_index')
    .eq('user_id', userId)
    .returns<{ room_id: string; player_index: number | null }[]>();
  if (seats.error) throw seats.error;
  const ids = (seats.data ?? []).map((s) => s.room_id);
  if (ids.length === 0) return [];

  const [rooms, games] = await Promise.all([
    client
      .from('rooms')
      .select(ROOM_COLUMNS)
      .in('id', ids)
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false })
      .returns<RoomRow[]>(),
    client.from('games').select('room_id, forfeited').in('room_id', ids).returns<{ room_id: string; forfeited: number[] }[]>(),
  ]);
  if (rooms.error) throw rooms.error;
  if (games.error) throw games.error;
  const left = new Set(
    (games.data ?? [])
      .filter((g) => {
        const seat = seats.data?.find((s) => s.room_id === g.room_id);
        return seat?.player_index != null && g.forfeited.includes(seat.player_index);
      })
      .map((g) => g.room_id),
  );
  return (rooms.data ?? [])
    .filter((r) => !left.has(r.id))
    .map((r) => ({ id: r.id, code: r.code, status: r.status, createdAt: r.created_at }));
}

/** Envoie une demande à l'Edge Function `game-action` ; renvoie la partie à jour. */
export async function gameAction(client: SupabaseClient, request: GameRequest): Promise<StoredGame | null> {
  const { data, error } = await client.functions.invoke<GameResponse>('game-action', { body: request });
  if (error) {
    // Refus du serveur : le corps de la réponse porte le code et le message.
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null);
      if (body && isOnlineErrorCode(body.code)) throw new OnlineError(body.code, body.message);
    }
    throw error;
  }
  if (!data) throw new OnlineError('server_error');
  if (!data.ok) throw new OnlineError(data.code, data.message);
  return data.game;
}

export function startGame(client: SupabaseClient, roomId: string) {
  return gameAction(client, { action: 'start', roomId });
}

export function playMove(client: SupabaseClient, roomId: string, move: Move, turn: number) {
  return gameAction(client, { action: 'move', roomId, move, turn });
}

export function tickGame(client: SupabaseClient, roomId: string) {
  return gameAction(client, { action: 'tick', roomId });
}

export function resignGame(client: SupabaseClient, roomId: string) {
  return gameAction(client, { action: 'resign', roomId });
}

/** Message en français pour une erreur du jeu en ligne. */
export function describeOnlineError(error: unknown): string {
  if (error instanceof OnlineError) return error.message;
  if (error instanceof FunctionsFetchError) return NETWORK_ERROR;
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) return NETWORK_ERROR;
  const message = (error as { message?: unknown } | null)?.message;
  if (isOnlineErrorCode(message)) return ONLINE_ERROR_MESSAGES[message];
  return GENERIC_ERROR;
}
