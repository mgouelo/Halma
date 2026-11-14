// Points à l'écran : variation en fin de partie classée (attente comprise),
// rien pour une partie non classée ; points et rang sur le profil.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';

import { fetchGameRating, fetchMyRating, fetchMyStats } from '@/stats/stats-service';

const mockAuth = { statsVersion: 0, isGuest: false };

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('@/hooks/__test-utils__/reanimated'));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/auth/auth-context', () => ({ useAuth: () => mockAuth }));
jest.mock('@/stats/stats-service', () => ({
  fetchGameRating: jest.fn(),
  fetchMyRating: jest.fn(),
  fetchMyStats: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { RatingResult } = require('@/components/online/rating-result');
const { ProfileStats } = require('@/components/profile-stats');
const { useGameRating, RATING_POLL_MS, RATING_POLL_LIMIT } = require('@/rooms/use-game-rating');
/* eslint-enable @typescript-eslint/no-require-imports */

const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as jest.MockedFunction<T>;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.isGuest = false;
});
afterEach(() => {
  jest.useRealTimers();
});

describe('fin de partie : points', () => {
  it('attend le calcul du serveur sans bloquer, puis affiche la variation et le nouveau total', async () => {
    jest.useFakeTimers();
    mocked(fetchGameRating)
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValue({ status: 'ranked', delta: 27, ratingAfter: 127 });
    const { result } = renderHook(() => useGameRating('g1', true));
    expect(result.current).toEqual({ status: 'pending' });
    await act(async () => {});
    expect(fetchGameRating).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(RATING_POLL_MS);
    });
    await waitFor(() => expect(result.current).toEqual({ status: 'ranked', delta: 27, ratingAfter: 127 }));

    render(<RatingResult view={result.current} />);
    expect(screen.getByText('+27 points')).toBeTruthy();
    expect(screen.getByText('Nouveau total : 127 points')).toBeTruthy();
    expect(screen.getByLabelText('+27 points. Nouveau total : 127 points.')).toBeTruthy();
  });

  it('une défaite : « -15 points », total négatif avec son signe', () => {
    render(<RatingResult view={{ status: 'ranked', delta: -15, ratingAfter: -15 }} />);
    expect(screen.getByText('-15 points')).toBeTruthy();
    expect(screen.getByText('Nouveau total : -15 points')).toBeTruthy();
  });

  it('pendant l’attente : « Calcul des points… »', () => {
    render(<RatingResult view={{ status: 'pending' }} />);
    expect(screen.getByLabelText('Calcul des points…')).toBeTruthy();
  });

  it('partie non classée : rien n’est demandé ni affiché', async () => {
    const { result } = renderHook(() => useGameRating('g1', false));
    expect(result.current).toEqual({ status: 'hidden' });
    expect(fetchGameRating).not.toHaveBeenCalled();
    const empty = render(<RatingResult view={result.current} />);
    expect(empty.toJSON()).toBeNull();
  });

  it('le serveur ne classe pas la partie (plafond du jour) : rien n’est affiché', async () => {
    mocked(fetchGameRating).mockResolvedValue({ status: 'unranked' });
    const { result } = renderHook(() => useGameRating('g1', true));
    await waitFor(() => expect(result.current).toEqual({ status: 'hidden' }));
  });

  it('réseau en panne : on réessaie, puis on renvoie au profil après la limite', async () => {
    jest.useFakeTimers();
    mocked(fetchGameRating).mockRejectedValue(new TypeError('Network request failed'));
    const { result } = renderHook(() => useGameRating('g1', true));
    for (let i = 0; i < RATING_POLL_LIMIT; i++) {
      await act(async () => {
        jest.advanceTimersByTime(RATING_POLL_MS);
      });
    }
    expect(result.current).toEqual({ status: 'late' });
    expect(fetchGameRating).toHaveBeenCalledTimes(RATING_POLL_LIMIT);
  });
});

describe('profil : points et rang', () => {
  const stats = { wins: 4, gamesStarted: 9, currentStreak: 0, bestStreak: 5, lastLoginDay: null };

  it('affiche les points (avec leur signe) et le rang', async () => {
    mocked(fetchMyStats).mockResolvedValue(stats);
    mocked(fetchMyRating).mockResolvedValue({ points: -42, rank: 7, rankedGames: 5 });
    render(<ProfileStats userId="u1" />);
    await waitFor(() => expect(screen.getByLabelText('Points : -42')).toBeTruthy());
    expect(screen.getByLabelText('Rang aux points : 7e place')).toBeTruthy();
    expect(screen.getByLabelText('Victoires : 4')).toBeTruthy();
  });

  it('sans partie classée : pas encore de rang', async () => {
    mocked(fetchMyStats).mockResolvedValue(stats);
    mocked(fetchMyRating).mockResolvedValue({ points: 0, rank: null, rankedGames: 0 });
    render(<ProfileStats userId="u1" />);
    await waitFor(() => expect(screen.getByLabelText('Rang aux points : pas encore classé')).toBeTruthy());
    expect(screen.getByText(/Joue une partie classée/)).toBeTruthy();
  });

  it('invité : ses points, mais hors classement', async () => {
    mockAuth.isGuest = true;
    mocked(fetchMyStats).mockResolvedValue(stats);
    mocked(fetchMyRating).mockResolvedValue({ points: 30, rank: null, rankedGames: 1 });
    render(<ProfileStats userId="u1" />);
    await waitFor(() => expect(screen.getByLabelText('Points : 30')).toBeTruthy());
    expect(screen.getByText(/Les invités n’apparaissent pas dans les classements/)).toBeTruthy();
  });
});
