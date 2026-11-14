import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import { OnlineError } from '@/online';

import {
  COUNTDOWN_MS,
  countdownSeconds,
  formatElapsed,
  IDLE_STATUS,
  isStartDue,
  joinMatchmaking,
  leaveMatchmaking,
  LONG_WAIT_MS,
  MATCHMAKING_HEARTBEAT_MS,
  matchmakingHeartbeat,
  searchElapsedMs,
  shouldAskToKeepWaiting,
  statusFromRow,
  type MatchmakingStatus,
} from '../matchmaking';

const SERVER_NOW = Date.parse('2026-11-14T12:00:00.000Z');

const row = (overrides: Record<string, unknown> = {}) => ({
  status: 'matched',
  joined_at: null,
  room_id: 'r1',
  starts_at: '2026-11-14T12:00:15.000Z',
  players: 2,
  server_now: '2026-11-14T12:00:00.000Z',
  ...overrides,
});

describe('état de recherche', () => {
  it('lit la ligne du serveur et l’écart d’horloge de l’appareil', () => {
    // Le téléphone retarde de 3 s sur le serveur.
    const status = statusFromRow(row(), SERVER_NOW - 3000);
    expect(status).toEqual({
      phase: 'matched',
      joinedAt: null,
      roomId: 'r1',
      startsAt: '2026-11-14T12:00:15.000Z',
      players: 2,
      clockOffsetMs: 3000,
    });
  });

  it('état inconnu ou absent : pas de recherche', () => {
    expect(statusFromRow(null, 0)).toEqual(IDLE_STATUS);
    expect(statusFromRow(row({ status: 'triche' }), 0)).toEqual(IDLE_STATUS);
  });

  it('constantes : signe de vie bien plus fréquent que le retrait (20 s), compte à rebours de 15 s', () => {
    expect(MATCHMAKING_HEARTBEAT_MS).toBeLessThan(20_000 / 2);
    expect(COUNTDOWN_MS).toBe(15_000);
    expect(LONG_WAIT_MS).toBe(60_000);
  });
});

describe('compte à rebours sur l’heure du serveur', () => {
  // Téléphone en retard de 3 s : son heure locale vaut heure serveur - 3 s.
  const status = statusFromRow(row(), SERVER_NOW - 3000);
  const local = (serverMs: number) => serverMs - 3000;

  it('ne dépend pas de l’horloge du téléphone', () => {
    expect(countdownSeconds(status, local(SERVER_NOW))).toBe(15);
    expect(countdownSeconds(status, local(SERVER_NOW + 5200))).toBe(10);
    expect(countdownSeconds(status, local(SERVER_NOW + 14_100))).toBe(1);
    expect(countdownSeconds(status, local(SERVER_NOW + 15_000))).toBe(0);
    expect(countdownSeconds(status, local(SERVER_NOW + 99_000))).toBe(0);
  });

  it('le départ est demandé à la fin du compte à rebours, seulement en room', () => {
    expect(isStartDue(status, local(SERVER_NOW + 14_000))).toBe(false);
    expect(isStartDue(status, local(SERVER_NOW + 15_000))).toBe(true);
    expect(isStartDue({ ...status, phase: 'searching' }, local(SERVER_NOW + 15_000))).toBe(false);
  });
});

describe('attente longue', () => {
  const searching: MatchmakingStatus = statusFromRow(
    row({ status: 'searching', joined_at: '2026-11-14T12:00:00.000Z', room_id: null, starts_at: null, players: 0 }),
    SERVER_NOW,
  );

  it('durée de la recherche', () => {
    expect(searchElapsedMs(searching, SERVER_NOW + 42_000)).toBe(42_000);
    expect(formatElapsed(42_000)).toBe('0:42');
    expect(formatElapsed(65_000)).toBe('1:05');
  });

  it('propose « Continuer d’attendre » après une minute, puis une minute après chaque réponse', () => {
    expect(shouldAskToKeepWaiting(searching, SERVER_NOW + 59_000, null)).toBe(false);
    expect(shouldAskToKeepWaiting(searching, SERVER_NOW + 60_000, null)).toBe(true);
    const kept = SERVER_NOW + 61_000;
    expect(shouldAskToKeepWaiting(searching, SERVER_NOW + 100_000, kept)).toBe(false);
    expect(shouldAskToKeepWaiting(searching, kept + 60_000, kept)).toBe(true);
    expect(shouldAskToKeepWaiting({ ...searching, phase: 'matched' }, SERVER_NOW + 120_000, null)).toBe(false);
  });
});

describe('appels au serveur', () => {
  function fakeClient(result: { data: unknown; error: unknown }) {
    const client = { rpc: jest.fn(async (..._args: unknown[]) => result) };
    return { client, asSupabase: client as unknown as SupabaseClient };
  }

  it('entre en file, envoie un signe de vie, quitte', async () => {
    const { client, asSupabase } = fakeClient({ data: [row({ status: 'searching', room_id: null })], error: null });
    await expect(joinMatchmaking(asSupabase)).resolves.toMatchObject({ phase: 'searching' });
    await expect(matchmakingHeartbeat(asSupabase)).resolves.toMatchObject({ phase: 'searching' });
    await leaveMatchmaking(asSupabase);
    expect(client.rpc.mock.calls.map((call) => call[0])).toEqual(['join_matchmaking', 'matchmaking_heartbeat', 'leave_matchmaking']);
  });

  it('traduit le refus « déjà dans une room »', async () => {
    const { asSupabase } = fakeClient({ data: null, error: { message: 'already_in_room', code: 'P0001' } });
    const failure = await joinMatchmaking(asSupabase).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(OnlineError);
    expect((failure as OnlineError).code).toBe('already_in_room');
  });
});
