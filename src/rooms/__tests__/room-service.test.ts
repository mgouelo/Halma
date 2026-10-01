import { describe, expect, it, jest } from '@jest/globals';
import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import { OnlineError } from '@/online';

import {
  createRoom,
  describeOnlineError,
  fetchActiveRoom,
  fetchRoom,
  GENERIC_ERROR,
  HOST_CLOSED_NOTICE,
  isValidRoomCode,
  joinRoom,
  leaveRoom,
  leaveRoomPrompt,
  NETWORK_ERROR,
  normalizeRoomCode,
  playMove,
  roomClosedNotice,
  ROOM_CLOSED_NOTICE,
  type RoomSnapshot,
} from '../room-service';

type Result = { data: unknown; error: unknown };

function fakeClient(options: { rpc?: Result; invoke?: Result; tables?: Record<string, Result> } = {}) {
  const query = (table: string) => {
    const result = options.tables?.[table] ?? { data: null, error: null };
    const builder = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      in: jest.fn(() => builder),
      order: jest.fn(() => builder),
      returns: jest.fn(() => builder),
      maybeSingle: jest.fn(async () => result),
      then: (resolve: (r: Result) => unknown) => resolve(result),
    };
    return builder;
  };
  const client = {
    rpc: jest.fn(async () => options.rpc ?? { data: null, error: null }),
    from: jest.fn(query),
    functions: { invoke: jest.fn(async () => options.invoke ?? { data: { ok: true, game: null }, error: null }) },
  };
  return { client, asSupabase: client as unknown as SupabaseClient };
}

describe('codes de room', () => {
  it('normalise la saisie et refuse les caractères ambigus', () => {
    expect(normalizeRoomCode(' k7q m3x ')).toBe('K7QM3X');
    expect(isValidRoomCode('K7QM3X')).toBe(true);
    expect(isValidRoomCode('K7QM3')).toBe(false);
    expect(isValidRoomCode('O0IL1A')).toBe(false);
  });

  it('rejoint avec le code normalisé', async () => {
    const { client, asSupabase } = fakeClient({ rpc: { data: 'room-id', error: null } });
    await expect(joinRoom(asSupabase, 'k7qm3x')).resolves.toBe('room-id');
    expect(client.rpc).toHaveBeenCalledWith('join_room', { p_code: 'K7QM3X' });
  });

  it('refuse un code mal formé sans appeler le serveur', async () => {
    const { client, asSupabase } = fakeClient();
    await expect(joinRoom(asSupabase, 'abc')).rejects.toBeInstanceOf(OnlineError);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('traduit les erreurs levées par les fonctions SQL', async () => {
    const { asSupabase } = fakeClient({ rpc: { data: null, error: { message: 'room_full', code: 'P0001' } } });
    const error = await joinRoom(asSupabase, 'K7QM3X').catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'room_full' });
    expect(describeOnlineError(error)).toMatch(/complète/);
  });

  it('traite un code inconnu (null renvoyé par la base) comme « aucune room »', async () => {
    const { asSupabase } = fakeClient({ rpc: { data: null, error: null } });
    await expect(joinRoom(asSupabase, 'K7QM3X')).rejects.toMatchObject({ code: 'room_not_found' });
  });

  it('explique la limite d’essais de codes', async () => {
    const { asSupabase } = fakeClient({ rpc: { data: null, error: { message: 'too_many_attempts', code: 'P0001' } } });
    const error = await joinRoom(asSupabase, 'K7QM3X').catch((e: unknown) => e);
    expect(describeOnlineError(error)).toMatch(/Trop de codes/);
  });
});

describe('gameAction', () => {
  const move = { from: { q: 0, r: 5 }, path: [{ q: 0, r: 4 }] };

  it('envoie le coup à l’Edge Function', async () => {
    const { client, asSupabase } = fakeClient();
    await playMove(asSupabase, 'room-id', move, 4);
    expect(client.functions.invoke).toHaveBeenCalledWith('game-action', {
      body: { action: 'move', roomId: 'room-id', move, turn: 4 },
    });
  });

  it('lit le code et le message d’un refus du serveur', async () => {
    const response = new Response(JSON.stringify({ ok: false, code: 'illegal_move', message: 'Coup refusé : Case de destination occupée.' }), {
      status: 422,
    });
    const { asSupabase } = fakeClient({ invoke: { data: null, error: new FunctionsHttpError(response) } });
    const error = await playMove(asSupabase, 'room-id', move, 0).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'illegal_move' });
    expect(describeOnlineError(error)).toBe('Coup refusé : Case de destination occupée.');
  });

  it('signale une coupure réseau', () => {
    expect(describeOnlineError(new FunctionsFetchError(new Error('offline')))).toBe(NETWORK_ERROR);
    expect(describeOnlineError(new Error('???'))).toBe(GENERIC_ERROR);
  });
});

describe('fetchRoom', () => {
  it('assemble room, participants (avec pseudos) et partie', async () => {
    const { asSupabase } = fakeClient({
      tables: {
        rooms: { data: { id: 'r', code: 'K7QM3X', host_id: 'u1', status: 'waiting', created_at: 't' }, error: null },
        room_players: {
          data: [
            { id: 'p1', room_id: 'r', seat: 1, user_id: null, ai_level: 'easy', player_index: null, last_seen_at: 't', profiles: null },
            { id: 'p0', room_id: 'r', seat: 0, user_id: 'u1', ai_level: null, player_index: null, last_seen_at: 't', profiles: { pseudo: 'Alice', avatar: 'felix' } },
          ],
          error: null,
        },
      },
    });
    const snapshot = await fetchRoom(asSupabase, 'r');
    expect(snapshot?.room).toEqual({ id: 'r', code: 'K7QM3X', hostId: 'u1', status: 'waiting', createdAt: 't' });
    expect(snapshot?.players.map((p) => [p.id, p.pseudo, p.avatar, p.aiLevel])).toEqual([
      ['p1', null, null, 'easy'],
      ['p0', 'Alice', 'felix', null],
    ]);
    expect(snapshot?.game).toBeNull();
  });

  it('renvoie null pour une room invisible', async () => {
    const { asSupabase } = fakeClient();
    await expect(fetchRoom(asSupabase, 'r')).resolves.toBeNull();
  });
});

describe('une seule room active', () => {
  it('explique en français le refus « déjà dans une room » (création et jointure)', async () => {
    const { asSupabase } = fakeClient({ rpc: { data: null, error: { message: 'already_in_room', code: 'P0001' } } });
    const joined = await joinRoom(asSupabase, 'K7QM3X').catch((e: unknown) => e);
    expect(joined).toMatchObject({ code: 'already_in_room' });
    expect(describeOnlineError(joined)).toMatch(/déjà dans une room/);
    const created = await createRoom(asSupabase).catch((e: unknown) => e);
    expect(created).toMatchObject({ code: 'already_in_room' });
  });

  it('lit la room active renvoyée par le serveur, ou null', async () => {
    const row = { id: 'r1', code: 'K7QM3X', status: 'waiting', host_id: 'u1', created_at: '2026-10-01T10:00:00Z' };
    const { client, asSupabase } = fakeClient({ rpc: { data: [row], error: null } });
    await expect(fetchActiveRoom(asSupabase)).resolves.toEqual({
      id: 'r1',
      code: 'K7QM3X',
      status: 'waiting',
      hostId: 'u1',
      createdAt: '2026-10-01T10:00:00Z',
    });
    expect(client.rpc).toHaveBeenCalledWith('my_active_room', undefined);
    await expect(fetchActiveRoom(fakeClient({ rpc: { data: [], error: null } }).asSupabase)).resolves.toBeNull();
  });

  it('quitter la room appelle leave_room', async () => {
    const { client, asSupabase } = fakeClient();
    await leaveRoom(asSupabase, 'r1');
    expect(client.rpc).toHaveBeenCalledWith('leave_room', { p_room: 'r1' });
  });
});

describe('room fermée et sortie de la salle d’attente', () => {
  const player = (id: string, userId: string | null, seat: number) =>
    ({ id, userId, aiLevel: userId ? null : 'easy', seat, playerIndex: null, lastSeenAt: '', pseudo: null, avatar: null }) as unknown as RoomSnapshot['players'][number];
  const snapshot = (hostId: string, players: RoomSnapshot['players'], status: 'waiting' | 'playing' = 'waiting'): RoomSnapshot => ({
    room: { id: 'r1', code: 'K7QM3X', hostId, status, createdAt: '' },
    players,
    game: status === 'playing' ? ({ id: 'g1' } as unknown as RoomSnapshot['game']) : null,
  });

  it('dit aux invités que l’hôte a fermé la room, et reste neutre sinon', () => {
    const waiting = snapshot('host', [player('p1', 'host', 0), player('p2', 'me', 1)]);
    expect(roomClosedNotice(waiting, 'me')).toBe(HOST_CLOSED_NOTICE);
    expect(roomClosedNotice(waiting, 'host')).toBe(ROOM_CLOSED_NOTICE);
    const playing = snapshot('host', [player('p1', 'host', 0), player('p2', 'me', 1)], 'playing');
    expect(roomClosedNotice(playing, 'me')).toBe(ROOM_CLOSED_NOTICE);
  });

  it('demande confirmation seulement à l’hôte qui ferme une room avec d’autres joueurs', () => {
    const withFriend = snapshot('host', [player('p1', 'host', 0), player('p2', 'friend', 1)]);
    expect(leaveRoomPrompt(withFriend, 'host')).toMatchObject({ title: 'Fermer la room ?', confirmLabel: 'Fermer la room' });
    expect(leaveRoomPrompt(withFriend, 'friend')).toBeNull();
    const withAi = snapshot('host', [player('p1', 'host', 0), player('p2', null, 1)]);
    expect(leaveRoomPrompt(withAi, 'host')).toBeNull();
  });
});
