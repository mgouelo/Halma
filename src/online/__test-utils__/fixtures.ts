import { createGame, getAllLegalMoves, type AiLevel, type GameState, type Move, type PlayerId } from '@/game';

import { newOnlineGame } from '../referee';
import type { GameStore, LoadedRoom } from '../server';
import type { OnlineGame, Participant, RoomRecord, StoredGame } from '../types';

export const ROOM_ID = '0b5a3c1e-8d2f-4e6a-9b7c-1d2e3f4a5b6c';
export const ALICE = 'a0000000-0000-0000-0000-000000000001';
export const BOB = 'b0000000-0000-0000-0000-000000000002';
export const CAROL = 'c0000000-0000-0000-0000-000000000003';
export const STRANGER = 'd0000000-0000-0000-0000-000000000004';

/** Heure fixe des tests. */
export const NOW = Date.parse('2026-10-01T12:00:00.000Z');

/** Horodatage Postgres (avec microsecondes) `seconds` secondes avant NOW. */
export function secondsAgo(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString().replace('Z', '123+00:00');
}

export function human(seat: number, userId: string, lastSeenAt = secondsAgo(1)): Participant {
  return { id: `p${seat}`, seat, userId, aiLevel: null, playerIndex: seat, lastSeenAt };
}

export function ai(seat: number, level: AiLevel = 'medium'): Participant {
  return { id: `p${seat}`, seat, userId: null, aiLevel: level, playerIndex: seat, lastSeenAt: secondsAgo(3600) };
}

/** Premier coup légal du joueur courant (ordre du moteur). */
export function anyMove(state: GameState, player: PlayerId = state.currentPlayer): Move {
  const move = getAllLegalMoves(state, player)[0];
  if (!move) throw new Error(`le joueur ${player} n’a aucun coup`);
  return move;
}

export function onlineGame(participants: readonly Participant[]): OnlineGame {
  return newOnlineGame(createGame(participants.length as 2 | 3 | 4 | 5 | 6));
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/**
 * Base en mémoire qui imite la vraie : lectures recopiées (comme un aller-retour
 * réseau), lancement qui attribue les identifiants du moteur dans l'ordre des
 * places, écriture refusée si la version a changé.
 */
export class MemoryStore implements GameStore {
  room: RoomRecord;
  participants: Participant[];
  game: StoredGame | null;
  saves = 0;
  /** Exécuté juste avant la prochaine écriture (pour simuler une écriture concurrente). */
  beforeSave: (() => void) | null = null;
  failLoad: Error | null = null;

  constructor(options: { participants: Participant[]; hostId?: string; game?: OnlineGame | null }) {
    const started = options.game !== undefined && options.game !== null;
    this.room = { id: ROOM_ID, hostId: options.hostId ?? ALICE, status: started ? 'playing' : 'waiting' };
    this.participants = options.participants.map((p) => (started ? p : { ...p, playerIndex: null }));
    this.game = started ? { ...clone(options.game!), id: 'g1', roomId: ROOM_ID, version: 0 } : null;
  }

  async load(roomId: string): Promise<LoadedRoom | null> {
    if (this.failLoad) throw this.failLoad;
    if (roomId !== this.room.id) return null;
    return clone({ room: this.room, participants: this.participants, game: this.game });
  }

  async begin(roomId: string, hostId: string, state: GameState): Promise<void> {
    if (this.room.status !== 'waiting' || hostId !== this.room.hostId) throw new Error('begin refusé');
    if (state.players.length !== this.participants.length) throw new Error('nombre de joueurs incohérent');
    this.participants = [...this.participants]
      .sort((a, b) => a.seat - b.seat)
      .map((p, index) => ({ ...p, playerIndex: index }));
    this.game = { ...newOnlineGame(clone(state)), id: 'g1', roomId, version: 0 };
    this.room = { ...this.room, status: 'playing' };
  }

  async save(current: StoredGame, next: OnlineGame): Promise<StoredGame | null> {
    const hook = this.beforeSave;
    this.beforeSave = null;
    hook?.();
    if (!this.game || this.game.version !== current.version) return null;
    this.saves++;
    this.game = { ...clone(next), id: current.id, roomId: current.roomId, version: current.version + 1 };
    if (next.endReason) this.room = { ...this.room, status: 'finished' };
    return clone(this.game);
  }
}
