import { useEffect, useState } from 'react';

import { getSupabase } from '@/lib/supabase';
import { fetchGameRating, type GameRating } from '@/stats/stats-service';

/** Délai entre deux lectures du résultat, le temps que le serveur le calcule. */
const RATING_POLL_MS = 1500;
/** Au-delà, on arrête d'attendre à l'écran (les points restent visibles sur le profil). */
const RATING_POLL_LIMIT = 30;

/** Ce qu'affiche l'écran de fin : rien, l'attente, la variation, ou « plus tard ». */
export type GameRatingView = { status: 'hidden' } | { status: 'pending' } | { status: 'late' } | Extract<GameRating, { status: 'ranked' }>;

/**
 * Points de la partie pour le joueur connecté, lus dès que le serveur les a
 * calculés (relecture toutes les 1,5 s, sans bloquer l'écran). `enabled` : la
 * partie est finie et peut être classée (src/online/rating.ts) ; sinon rien
 * n'est demandé ni affiché. Une partie que le serveur ne classe pas (plafond
 * quotidien) n'affiche rien non plus.
 */
export function useGameRating(gameId: string, enabled: boolean): GameRatingView {
  // Résultat lu pour une partie donnée ; tant qu'il n'y en a pas pour celle-ci, on attend.
  const [result, setResult] = useState<{ gameId: string; view: GameRatingView } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      attempts += 1;
      let rating: GameRating = { status: 'pending' };
      try {
        rating = await fetchGameRating(getSupabase(), gameId);
      } catch {
        // Réseau : on réessaie au prochain tour.
      }
      if (!active) return;
      if (rating.status === 'ranked') return setResult({ gameId, view: rating });
      if (rating.status === 'unranked') return setResult({ gameId, view: { status: 'hidden' } });
      if (attempts >= RATING_POLL_LIMIT) return setResult({ gameId, view: { status: 'late' } });
      timer = setTimeout(poll, RATING_POLL_MS);
    };
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [gameId, enabled]);

  if (!enabled) return { status: 'hidden' };
  return result?.gameId === gameId ? result.view : { status: 'pending' };
}
