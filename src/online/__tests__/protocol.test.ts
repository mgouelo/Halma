import { describe, expect, it } from '@jest/globals';

import { createGame } from '@/game';

import { gameColumns, parseGameRequest, participantsFromRows, readMove, storedGameFromRow } from '../protocol';
import { newOnlineGame } from '../referee';
import { ROOM_ID } from '../__test-utils__/fixtures';

describe('parseGameRequest', () => {
  it('lit les quatre actions', () => {
    expect(parseGameRequest({ action: 'start', roomId: ROOM_ID })).toEqual({ action: 'start', roomId: ROOM_ID });
    expect(parseGameRequest({ action: 'tick', roomId: ROOM_ID.toUpperCase() })).toEqual({ action: 'tick', roomId: ROOM_ID });
    expect(parseGameRequest({ action: 'resign', roomId: ROOM_ID })).toEqual({ action: 'resign', roomId: ROOM_ID });
    expect(
      parseGameRequest({ action: 'move', roomId: ROOM_ID, turn: 3, move: { from: { q: 0, r: 5 }, path: [{ q: 0, r: 4 }] } }),
    ).toEqual({ action: 'move', roomId: ROOM_ID, turn: 3, move: { from: { q: 0, r: 5 }, path: [{ q: 0, r: 4 }] } });
  });

  it('recopie le coup sans les propriétés inattendues', () => {
    const request = parseGameRequest({
      action: 'move',
      roomId: ROOM_ID,
      turn: 0,
      winner: 0,
      move: { from: { q: 0, r: 5, owner: 1 }, path: [{ q: 0, r: 4, extra: true }], state: {} },
    });
    expect(request).toEqual({ action: 'move', roomId: ROOM_ID, turn: 0, move: { from: { q: 0, r: 5 }, path: [{ q: 0, r: 4 }] } });
  });

  it('refuse un tour non entier', () => {
    expect(parseGameRequest({ action: 'move', roomId: ROOM_ID, turn: 1.5, move: { from: { q: 0, r: 5 }, path: [{ q: 0, r: 4 }] } })).toBeNull();
  });
});

describe('readMove', () => {
  it('refuse les chemins qui ne sont pas des listes de cases', () => {
    expect(readMove({ from: { q: 0, r: 0 }, path: 'haut' })).toBeNull();
    expect(readMove({ from: { q: 0, r: 0 }, path: [null] })).toBeNull();
    expect(readMove({ from: null, path: [{ q: 0, r: 1 }] })).toBeNull();
  });
});

describe('lignes de la base', () => {
  it('trie les participants par place et ignore un niveau d’IA inconnu', () => {
    const base = { room_id: ROOM_ID, player_index: null, last_seen_at: '2026-10-01T12:00:00+00:00' };
    const participants = participantsFromRows([
      { ...base, id: 'b', seat: 2, user_id: null, ai_level: 'hard' },
      { ...base, id: 'a', seat: 0, user_id: 'u1', ai_level: null },
      { ...base, id: 'c', seat: 1, user_id: null, ai_level: 'expert' },
    ]);
    expect(participants.map((p) => [p.id, p.aiLevel])).toEqual([
      ['a', null],
      ['c', null],
      ['b', 'hard'],
    ]);
  });

  it('écrit et relit une partie à l’identique', () => {
    const game = { ...newOnlineGame(createGame(3)), forfeited: [2] };
    const row = { id: 'g', room_id: ROOM_ID, version: 4, ...JSON.parse(JSON.stringify(gameColumns(game))) };
    expect(row).toMatchObject({ status: 'playing', winner: null, end_reason: null });
    expect(storedGameFromRow(row)).toEqual({ ...game, id: 'g', roomId: ROOM_ID, version: 4 });
  });
});
