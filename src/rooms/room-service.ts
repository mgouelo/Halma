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

/** Room active du joueur, pour la reprendre ou la quitter depuis « Jouer en ligne ». */
export interface ActiveRoom {
  id: string;
  code: string;
  status: RoomStatus;
  hostId: string;
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

/**
 * Quitte une room en attente. L'hôte la ferme : elle est supprimée avec ses
 * participants et les autres joueurs en sont informés. Pendant la partie, on
 * abandonne plutôt (`resignGame`).
 */
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
 * Room active du joueur (salle d'attente, ou partie en cours dont il n'a pas
 * abandonné), ou null. Une seule au plus : la règle est dans la base
 * (`my_active_room`, qui sert aussi à refuser une deuxième room).
 */
export async function fetchActiveRoom(client: SupabaseClient): Promise<ActiveRoom | null> {
  const rows = await rpc<{ id: string; code: string; status: RoomStatus; host_id: string; created_at: string }[] | null>(
    client,
    'my_active_room',
  );
  const row = rows?.[0];
  return row ? { id: row.id, code: row.code, status: row.status, hostId: row.host_id, createdAt: row.created_at } : null;
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

/** Message montré aux joueurs d'une salle d'attente que l'hôte vient de fermer. */
export const HOST_CLOSED_NOTICE = 'L’hôte a fermé la room.';
export const ROOM_CLOSED_NOTICE = 'Cette room a été fermée.';

/**
 * Message à montrer quand la room qu'on regardait disparaît (supprimée par
 * l'hôte pendant qu'on attendait, ou nettoyée par le serveur).
 */
export function roomClosedNotice(snapshot: RoomSnapshot, userId: string): string {
  const waiting = snapshot.room.status === 'waiting' && !snapshot.game;
  return waiting && snapshot.room.hostId !== userId ? HOST_CLOSED_NOTICE : ROOM_CLOSED_NOTICE;
}

/**
 * Confirmation à demander avant de quitter la salle d'attente : seulement pour
 * l'hôte quand d'autres humains y sont (quitter ferme la room pour tous).
 */
export function leaveRoomPrompt(
  snapshot: RoomSnapshot,
  userId: string,
): { title: string; message: string; confirmLabel: string } | null {
  if (snapshot.room.hostId !== userId) return null;
  const others = snapshot.players.filter((p) => p.userId !== null && p.userId !== userId);
  if (others.length === 0) return null;
  return {
    title: 'Fermer la room ?',
    message: 'Tu es l’hôte : si tu quittes, la room est supprimée et les autres joueurs sont renvoyés à l’accueil.',
    confirmLabel: 'Fermer la room',
  };
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
