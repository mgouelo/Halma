// Statistiques et classements, au-dessus d'un client Supabase passé en
// paramètre (le vrai en production, un faux dans les tests). Les clients ne
// peuvent rien écrire : tout passe par des fonctions SQL (migration player_stats).

import type { SupabaseClient } from '@supabase/supabase-js';

import type { LeaderboardRow } from './leaderboard';
import type { StreakState } from './streak';

export interface PlayerStats extends StreakState {
  wins: number;
  gamesStarted: number;
}

export const EMPTY_STATS: PlayerStats = { wins: 0, gamesStarted: 0, currentStreak: 0, bestStreak: 0, lastLoginDay: null };

/**
 * Connexion du jour : fait avancer la série de connexion. Le serveur choisit
 * le jour (fuseau Europe/Paris) ; rien n'est envoyé.
 */
export async function recordDailyLogin(client: SupabaseClient): Promise<{ currentStreak: number; bestStreak: number }> {
  const { data, error } = await client.rpc('record_daily_login');
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { current_streak?: number; best_streak?: number } | null;
  return { currentStreak: row?.current_streak ?? 0, bestStreak: row?.best_streak ?? 0 };
}

/** Statistiques du joueur connecté (zéro partout s'il n'a encore rien fait). */
export async function fetchMyStats(client: SupabaseClient, userId: string): Promise<PlayerStats> {
  const { data, error } = await client
    .from('player_stats')
    .select('wins, games_started, current_streak, best_streak, last_login_day')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY_STATS;
  return {
    wins: data.wins,
    gamesStarted: data.games_started,
    currentStreak: data.current_streak,
    bestStreak: data.best_streak,
    lastLoginDay: data.last_login_day,
  };
}

/** Les six classements (50 premiers de chacun, plus la ligne du joueur). */
export async function fetchLeaderboards(client: SupabaseClient): Promise<LeaderboardRow[]> {
  const { data, error } = await client.rpc('get_leaderboards');
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}
