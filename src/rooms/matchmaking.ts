// Matchmaking (« Trouver une partie ») : appels aux fonctions SQL de la
// migration matchmaking, et logique d'affichage pure (compte à rebours sur
// l'heure du serveur, attente longue), testée à part.

import type { SupabaseClient } from '@supabase/supabase-js';

import { isOnlineErrorCode, OnlineError } from '@/online';

/** Signe de vie pendant la recherche : le serveur retire un joueur silencieux depuis 20 s. */
export const MATCHMAKING_HEARTBEAT_MS = 4000;
/** Au-delà d'une minute de recherche, on propose « Continuer d'attendre » ou « Annuler ». */
export const LONG_WAIT_MS = 60_000;
/** Durée du compte à rebours (même valeur que matchmaking_countdown() côté base). */
export const COUNTDOWN_MS = 15_000;
/** Départ refusé car un peu trop tôt (horloges) : on redemande après ce délai. */
export const START_RETRY_MS = 1000;

export type MatchmakingPhase = 'idle' | 'searching' | 'matched' | 'started';

export interface MatchmakingStatus {
  phase: MatchmakingPhase;
  /** Arrivée en file (heure du serveur), pendant la recherche. */
  joinedAt: string | null;
  /** Room de matchmaking (compte à rebours ou partie lancée). */
  roomId: string | null;
  /** Départ prévu (heure du serveur). */
  startsAt: string | null;
  players: number;
  /** Écart entre l'heure du serveur et celle de l'appareil (ms) : serveur ≈ appareil + offset. */
  clockOffsetMs: number;
}

export const IDLE_STATUS: MatchmakingStatus = {
  phase: 'idle',
  joinedAt: null,
  roomId: null,
  startsAt: null,
  players: 0,
  clockOffsetMs: 0,
};

interface StatusRow {
  status: string;
  joined_at: string | null;
  room_id: string | null;
  starts_at: string | null;
  players: number | null;
  server_now: string;
}

const PHASES: readonly string[] = ['idle', 'searching', 'matched', 'started'];

/** Ligne renvoyée par la base, lue à l'heure locale `receivedAt` (pour l'écart d'horloge). */
export function statusFromRow(row: StatusRow | null | undefined, receivedAt: number): MatchmakingStatus {
  if (!row || !PHASES.includes(row.status)) return IDLE_STATUS;
  const serverNow = Date.parse(row.server_now);
  return {
    phase: row.status as MatchmakingPhase,
    joinedAt: row.joined_at,
    roomId: row.room_id,
    startsAt: row.starts_at,
    players: row.players ?? 0,
    clockOffsetMs: Number.isNaN(serverNow) ? 0 : serverNow - receivedAt,
  };
}

/** Heure du serveur estimée à partir de l'heure de l'appareil. */
export function serverTime(status: Pick<MatchmakingStatus, 'clockOffsetMs'>, now: number): number {
  return now + status.clockOffsetMs;
}

/** Secondes restantes avant le départ (arrondies au-dessus, jamais négatives). */
export function countdownSeconds(status: MatchmakingStatus, now: number): number {
  if (!status.startsAt) return 0;
  const remaining = Date.parse(status.startsAt) - serverTime(status, now);
  return Math.max(0, Math.ceil(remaining / 1000));
}

/** Le compte à rebours est fini : il est temps de demander le départ. */
export function isStartDue(status: MatchmakingStatus, now: number): boolean {
  return status.phase === 'matched' && status.startsAt !== null && countdownSeconds(status, now) === 0;
}

/** Durée de la recherche (ms), sur l'heure du serveur. */
export function searchElapsedMs(status: MatchmakingStatus, now: number): number {
  if (status.phase !== 'searching' || !status.joinedAt) return 0;
  return Math.max(0, serverTime(status, now) - Date.parse(status.joinedAt));
}

/**
 * Faut-il proposer « Continuer d'attendre » ? Après une minute de recherche, puis
 * de nouveau une minute après chaque « Continuer d'attendre » (`keptWaitingAt`,
 * heure de l'appareil).
 */
export function shouldAskToKeepWaiting(status: MatchmakingStatus, now: number, keptWaitingAt: number | null): boolean {
  if (status.phase !== 'searching') return false;
  if (keptWaitingAt !== null) return now - keptWaitingAt >= LONG_WAIT_MS;
  return searchElapsedMs(status, now) >= LONG_WAIT_MS;
}

/** « 0:42 », « 1:05 ». */
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// --- Appels au serveur ----------------------------------------------------------------------

async function statusRpc(client: SupabaseClient, name: string): Promise<MatchmakingStatus> {
  const { data, error } = await client.rpc(name);
  const receivedAt = Date.now();
  if (error) throw isOnlineErrorCode(error.message) ? new OnlineError(error.message) : error;
  const row = (Array.isArray(data) ? data[0] : data) as StatusRow | null;
  return statusFromRow(row, receivedAt);
}

/** Entre en file (idempotent) ; refusé si le joueur est déjà dans une room active (`already_in_room`). */
export function joinMatchmaking(client: SupabaseClient): Promise<MatchmakingStatus> {
  return statusRpc(client, 'join_matchmaking');
}

/** Signe de vie : garde sa place, fait avancer les appariements, renvoie l'état. */
export function matchmakingHeartbeat(client: SupabaseClient): Promise<MatchmakingStatus> {
  return statusRpc(client, 'matchmaking_heartbeat');
}

/** Lecture seule de l'état (écran « Jouer en ligne »). */
export function fetchMatchmakingStatus(client: SupabaseClient): Promise<MatchmakingStatus> {
  return statusRpc(client, 'get_matchmaking_status');
}

/** Quitte la file, ou la room en compte à rebours. */
export async function leaveMatchmaking(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('leave_matchmaking');
  if (error) throw isOnlineErrorCode(error.message) ? new OnlineError(error.message) : error;
}
