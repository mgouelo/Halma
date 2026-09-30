// `GameStore` au-dessus de Supabase, pour l'Edge Function : client créé avec la
// clé service_role (il contourne la RLS, qui interdit toute écriture aux clients).
// Pas exporté par src/online/index.ts : l'application n'en a pas besoin.

import type { SupabaseClient } from '@supabase/supabase-js';

import type { GameState } from '../game/index.ts';

import { isOnlineErrorCode, OnlineError } from './errors.ts';
import {
  GAME_COLUMNS,
  gameColumns,
  participantsFromRows,
  ROOM_COLUMNS,
  ROOM_PLAYER_COLUMNS,
  storedGameFromRow,
  type GameRow,
  type RoomPlayerRow,
  type RoomRow,
} from './protocol.ts';
import type { GameStore } from './server.ts';

export function createSupabaseStore(admin: SupabaseClient): GameStore {
  return {
    async load(roomId) {
      const [room, players, game] = await Promise.all([
        admin.from('rooms').select(ROOM_COLUMNS).eq('id', roomId).maybeSingle<RoomRow>(),
        admin.from('room_players').select(ROOM_PLAYER_COLUMNS).eq('room_id', roomId).returns<RoomPlayerRow[]>(),
        admin.from('games').select(GAME_COLUMNS).eq('room_id', roomId).maybeSingle<GameRow>(),
      ]);
      if (room.error) throw room.error;
      if (players.error) throw players.error;
      if (game.error) throw game.error;
      if (!room.data) return null;
      return {
        room: { id: room.data.id, hostId: room.data.host_id, status: room.data.status },
        participants: participantsFromRows(players.data ?? []),
        game: game.data ? storedGameFromRow(game.data) : null,
      };
    },

    async begin(roomId: string, hostId: string, state: GameState) {
      const { error } = await admin.rpc('begin_game', { p_room: roomId, p_host: hostId, p_state: state });
      if (!error) return;
      // Les fonctions SQL lèvent leurs erreurs avec un code court en message.
      throw isOnlineErrorCode(error.message) ? new OnlineError(error.message) : error;
    },

    async save(current, next) {
      const { data, error } = await admin
        .from('games')
        .update({ ...gameColumns(next), version: current.version + 1 })
        .eq('id', current.id)
        .eq('version', current.version)
        .select(GAME_COLUMNS)
        .maybeSingle<GameRow>();
      if (error) throw error;
      return data ? storedGameFromRow(data) : null;
    },

    async recordWin(gameId) {
      // La fonction SQL relit la partie et ne la compte qu'une fois.
      const { data, error } = await admin.rpc('record_game_win', { p_game: gameId });
      if (error) throw error;
      return data === true;
    },
  };
}
