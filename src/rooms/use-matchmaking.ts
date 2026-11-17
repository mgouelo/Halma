import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getSupabase } from '@/lib/supabase';
import { OnlineError } from '@/online';

import {
  isStartDue,
  joinMatchmaking,
  leaveMatchmaking,
  MATCHMAKING_HEARTBEAT_MS,
  matchmakingHeartbeat,
  START_RETRY_MS,
  type MatchmakingStatus,
} from './matchmaking';
import { fetchRoom, startGame, type RoomPlayer } from './room-service';

export type MatchmakingState =
  | { kind: 'joining' }
  | { kind: 'error'; error: unknown; alreadyInRoom: boolean }
  | { kind: 'active'; status: MatchmakingStatus };

/** Heure de l'appareil, rafraîchie toutes les `intervalMs` (compte à rebours, durée de la recherche). */
function useClock(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
  return now;
}

/**
 * Recherche d'une partie : entre en file à l'ouverture, envoie un signe de vie
 * toutes les 4 s (qui renvoie aussi l'état : relecture de secours), suit la
 * sortie de file et l'entrée en room en direct (Realtime), et demande le départ
 * à la fin du compte à rebours (heure du serveur). `onStarted` reçoit la room
 * dès que la partie est lancée. Quitter l'écran sans partie annule la recherche.
 */
export function useMatchmaking(userId: string, onStarted: (roomId: string) => void) {
  const [state, setState] = useState<MatchmakingState>({ kind: 'joining' });
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const status = state.kind === 'active' ? state.status : null;
  const now = useClock(status?.phase === 'matched' ? 250 : 1000);
  // Partie lancée ou recherche annulée : plus rien à faire en quittant l'écran.
  const done = useRef(false);
  const startedCallback = useRef(onStarted);
  useEffect(() => {
    startedCallback.current = onStarted;
  });

  const apply = useCallback((next: MatchmakingStatus) => {
    if (done.current) return;
    if (next.phase === 'started' && next.roomId) {
      done.current = true;
      startedCallback.current(next.roomId);
    }
    setState({ kind: 'active', status: next });
  }, []);

  const beat = useCallback(() => {
    if (done.current) return;
    matchmakingHeartbeat(getSupabase())
      .then(apply)
      .catch(() => {
        // Réseau : le prochain signe de vie réessaiera.
      });
  }, [apply]);

  // Entrée en file à l'ouverture.
  useEffect(() => {
    let active = true;
    joinMatchmaking(getSupabase())
      .then((next) => {
        if (active) apply(next);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          kind: 'error',
          error,
          alreadyInRoom: error instanceof OnlineError && error.code === 'already_in_room',
        });
      });
    return () => {
      active = false;
    };
  }, [apply]);

  // Signe de vie et relecture de secours, retour au premier plan.
  const searching = state.kind === 'active';
  useEffect(() => {
    if (!searching) return;
    const interval = setInterval(beat, MATCHMAKING_HEARTBEAT_MS);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') beat();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [searching, beat]);

  // En direct : sortie de file (appariement, retrait) et entrée en room.
  useEffect(() => {
    if (!searching) return;
    const client = getSupabase();
    const channel = client
      .channel(`matchmaking-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matchmaking_queue', filter: `user_id=eq.${userId}` }, beat)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `user_id=eq.${userId}` }, beat)
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [searching, userId, beat]);

  // Joueurs de la room en compte à rebours (pseudos et avatars).
  const roomId = status?.phase === 'matched' ? status.roomId : null;
  const playerCount = status?.players ?? 0;
  useEffect(() => {
    if (!roomId) return;
    let active = true;
    fetchRoom(getSupabase(), roomId)
      .then((snapshot) => {
        if (active && snapshot) setPlayers(snapshot.players);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [roomId, playerCount]);

  // Fin du compte à rebours : on demande le départ au serveur (qui vérifie l'heure).
  // Refusé (un peu trop tôt, room dissoute…) : on relit l'état et on redemande peu après.
  const due = status !== null && isStartDue(status, now);
  const [startAttempt, setStartAttempt] = useState(0);
  useEffect(() => {
    if (!due || !roomId || done.current) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    startGame(getSupabase(), roomId)
      .then((game) => {
        if (cancelled) return;
        if (game) {
          done.current = true;
          startedCallback.current(roomId);
        } else beat();
      })
      .catch(() => {
        if (cancelled) return;
        beat();
        retry = setTimeout(() => setStartAttempt((n) => n + 1), START_RETRY_MS);
      });
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [due, roomId, startAttempt, beat]);

  // Quitter l'écran sans partie : la recherche est annulée.
  useEffect(
    () => () => {
      if (!done.current) leaveMatchmaking(getSupabase()).catch(() => {});
    },
    [],
  );

  const cancel = useCallback(async () => {
    setCancelling(true);
    done.current = true;
    try {
      await leaveMatchmaking(getSupabase());
    } catch {
      // Sans réseau, le serveur retirera le joueur faute de signe de vie.
    } finally {
      setCancelling(false);
    }
  }, []);

  return { state, players, now, cancel, cancelling };
}
