import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  EMPTY_STATS,
  fetchGameRating,
  fetchLeaderboards,
  fetchMyRating,
  fetchMyStats,
  recordDailyLogin,
} from '../stats-service';

type Result = { data: unknown; error: unknown };

function fakeClient(rpc: Result, single: Result = { data: null, error: null }) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(async () => single),
  };
  const client = { rpc: jest.fn(async () => rpc), from: jest.fn(() => query) };
  return { client, query, asSupabase: client as unknown as SupabaseClient };
}

describe('statistiques', () => {
  it('enregistre la connexion du jour sans envoyer de date', async () => {
    const { client, asSupabase } = fakeClient({ data: [{ current_streak: 3, best_streak: 7 }], error: null });
    await expect(recordDailyLogin(asSupabase)).resolves.toEqual({ currentStreak: 3, bestStreak: 7 });
    expect(client.rpc).toHaveBeenCalledWith('record_daily_login');
  });

  it('transmet les erreurs du serveur', async () => {
    const { asSupabase } = fakeClient({ data: null, error: new Error('down') });
    await expect(recordDailyLogin(asSupabase)).rejects.toThrow('down');
    await expect(fetchLeaderboards(asSupabase)).rejects.toThrow('down');
  });

  it('lit ses statistiques, ou zéro partout sans ligne', async () => {
    const { query, asSupabase } = fakeClient(
      { data: null, error: null },
      { data: { wins: 4, games_started: 9, current_streak: 2, best_streak: 5, last_login_day: '2026-10-01' }, error: null },
    );
    await expect(fetchMyStats(asSupabase, 'u1')).resolves.toEqual({
      wins: 4,
      gamesStarted: 9,
      currentStreak: 2,
      bestStreak: 5,
      lastLoginDay: '2026-10-01',
    });
    expect(query.eq).toHaveBeenCalledWith('user_id', 'u1');
    await expect(fetchMyStats(fakeClient({ data: null, error: null }).asSupabase, 'u1')).resolves.toEqual(EMPTY_STATS);
  });

  it('lit les six classements en un appel', async () => {
    const rows = [{ board: 'wins', rank: 1, pseudo: 'Alice', avatar: null, score: 3, is_me: false }];
    const { client, asSupabase } = fakeClient({ data: rows, error: null });
    await expect(fetchLeaderboards(asSupabase)).resolves.toEqual(rows);
    expect(client.rpc).toHaveBeenCalledWith('get_leaderboards');
  });
});

describe('points', () => {
  it('lit ses points et son rang', async () => {
    const { client, asSupabase } = fakeClient({ data: [{ mmr: -15, rank: 12, ranked_games: 3 }], error: null });
    await expect(fetchMyRating(asSupabase)).resolves.toEqual({ points: -15, rank: 12, rankedGames: 3 });
    expect(client.rpc).toHaveBeenCalledWith('get_my_rating');
    const guest = fakeClient({ data: [{ mmr: 30, rank: null, ranked_games: 1 }], error: null });
    await expect(fetchMyRating(guest.asSupabase)).resolves.toEqual({ points: 30, rank: null, rankedGames: 1 });
  });

  it('lit le résultat d’une partie : en attente, classée ou non', async () => {
    const ranked = fakeClient({ data: [{ status: 'ranked', delta: 27, rating_after: 127 }], error: null });
    await expect(fetchGameRating(ranked.asSupabase, 'g1')).resolves.toEqual({ status: 'ranked', delta: 27, ratingAfter: 127 });
    expect(ranked.client.rpc).toHaveBeenCalledWith('get_game_rating', { p_game: 'g1' });
    const unranked = fakeClient({ data: [{ status: 'unranked', delta: null, rating_after: null }], error: null });
    await expect(fetchGameRating(unranked.asSupabase, 'g1')).resolves.toEqual({ status: 'unranked' });
    const pending = fakeClient({ data: [{ status: 'pending', delta: null, rating_after: null }], error: null });
    await expect(fetchGameRating(pending.asSupabase, 'g1')).resolves.toEqual({ status: 'pending' });
    const failing = fakeClient({ data: null, error: new Error('down') });
    await expect(fetchGameRating(failing.asSupabase, 'g1')).rejects.toThrow('down');
  });
});
