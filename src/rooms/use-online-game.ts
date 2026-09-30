import { useEffect, useReducer, useRef } from 'react';

import type { Cell, PlayerId } from '@/game';
import { getSupabase } from '@/lib/supabase';
import type { StoredGame } from '@/online';

import { initOnlineGame, onlineGameReducer, type PendingMove } from './online-game-reducer';
import { FORFEIT_CHECK_INTERVAL_MS, planTicks, AI_TURN_FALLBACK_MS } from './presence';
import { describeOnlineError, playMove, resignGame, tickGame, type RoomPlayer } from './room-service';

interface OnlineGameOptions {
  roomId: string;
  /** Dernière partie connue (réponse du serveur ou Realtime). */
  server: StoredGame;
  players: RoomPlayer[];
  userId: string;
  /** Heure courante, rafraîchie régulièrement. */
  now: number;
  /** Partie à jour renvoyée par le serveur. */
  onGame: (game: StoredGame | null) => void;
}

/**
 * Partie en ligne vue depuis cet appareil : touches sur le plateau, envoi des
 * coups à l'Edge Function, animation des coups reçus, et demandes au serveur
 * de faire jouer les IA ou de déclarer forfait les joueurs partis.
 */
export function useOnlineGame({ roomId, server, players, userId, now, onGame }: OnlineGameOptions) {
  const [state, dispatch] = useReducer(onlineGameReducer, server, initOnlineGame);
  const me: PlayerId | null = players.find((p) => p.userId === userId)?.playerIndex ?? null;

  useEffect(() => {
    dispatch({ type: 'sync', game: server });
  }, [server]);

  // Envoi du coup joué (une seule fois par coup, même si l'effet est rejoué).
  const sent = useRef<PendingMove | null>(null);
  const { pending } = state;
  useEffect(() => {
    if (!pending || sent.current === pending) return;
    sent.current = pending;
    playMove(getSupabase(), roomId, pending.move, pending.turn)
      .then(onGame)
      .catch((error: unknown) => dispatch({ type: 'rejected', pending, message: describeOnlineError(error) }));
  }, [pending, roomId, onGame]);

  // Coup d'une IA : demandé au serveur quand l'animation du coup précédent est finie.
  const plan = planTicks(state.server, players, userId, now);
  const aiDelay = state.animating ? null : plan.aiDelay;
  const version = state.server.version;
  useEffect(() => {
    if (aiDelay === null) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      tickGame(getSupabase(), roomId).then(onGame).catch(() => {});
    };
    const timeout = setTimeout(() => {
      tick();
      // Si la demande échoue (réseau), on réessaie jusqu'à ce que la partie avance.
      interval = setInterval(tick, AI_TURN_FALLBACK_MS);
    }, aiDelay);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [aiDelay, version, roomId, onGame]);

  // Un joueur semble parti depuis trop longtemps : le serveur décide du forfait.
  const { checkForfeits } = plan;
  useEffect(() => {
    if (!checkForfeits) return;
    const tick = () => {
      tickGame(getSupabase(), roomId).then(onGame).catch(() => {});
    };
    tick();
    const interval = setInterval(tick, FORFEIT_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkForfeits, roomId, onGame]);

  const resign = async () => {
    onGame(await resignGame(getSupabase(), roomId));
  };

  return {
    ...state,
    me,
    tap: (cell: Cell) => dispatch({ type: 'tap', cell, me }),
    animationEnd: () => dispatch({ type: 'animationEnd' }),
    dismissError: () => dispatch({ type: 'dismissError' }),
    resign,
  };
}
