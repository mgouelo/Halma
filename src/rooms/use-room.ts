import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getSupabase } from '@/lib/supabase';
import {
  HEARTBEAT_INTERVAL_MS,
  participantFromRow,
  storedGameFromRow,
  type GameRow,
  type RoomPlayerRow,
  type RoomRow,
  type StoredGame,
} from '@/online';

import { describeOnlineError, fetchRoom, heartbeat, roomFromRow, type RoomSnapshot } from './room-service';

export type RoomLoadStatus = 'loading' | 'ready' | 'missing' | 'error';

/** Intervalle de relecture de la room tant que Realtime n'est pas connecté. */
const POLL_INTERVAL_MS = 5000;

/** Garde la partie la plus récente (réponses et événements peuvent se croiser). */
function newerGame(current: StoredGame | null, next: StoredGame): StoredGame {
  return current && current.id === next.id && current.version >= next.version ? current : next;
}

/**
 * Room suivie en direct : lecture initiale, puis changements reçus par
 * Supabase Realtime (salle d'attente, lancement, coups). Tant que l'écran est
 * ouvert, envoie un signe de vie régulier (heartbeat) : sans lui, le joueur est
 * déclaré forfait au bout de quelques minutes. Au retour dans l'application,
 * la room est relue (reprise de partie).
 */
export function useRoom(roomId: string) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState<RoomLoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  /** Vrai quand l'abonnement Realtime est actif. */
  const [live, setLive] = useState(false);
  const request = useRef(0);

  const refresh = useCallback(() => {
    const id = ++request.current;
    fetchRoom(getSupabase(), roomId)
      .then((next) => {
        if (id !== request.current) return;
        setError(null);
        if (!next) {
          setStatus('missing');
          return;
        }
        setSnapshot((prev) => (prev?.game && next.game ? { ...next, game: newerGame(prev.game, next.game) } : next));
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (id !== request.current) return;
        setError(describeOnlineError(e));
        setStatus((prev) => (prev === 'ready' ? prev : 'error'));
      });
  }, [roomId]);

  /** Partie renvoyée par l'Edge Function, sans attendre l'événement Realtime. */
  const applyGame = useCallback((game: StoredGame | null) => {
    if (!game) return;
    setSnapshot((prev) => (prev ? { ...prev, game: newerGame(prev.game, game) } : prev));
  }, []);

  // Abonnement Realtime (la RLS filtre : on ne reçoit que ses rooms).
  useEffect(() => {
    const client = getSupabase();
    const filter = `room_id=eq.${roomId}`;
    const channel = client
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter }, (payload) => {
        if (payload.eventType === 'DELETE') return refresh();
        applyGame(storedGameFromRow(payload.new as GameRow));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter }, (payload) => {
        // Arrivées et départs : on relit tout (pour avoir le pseudo) ; mises à jour : en place.
        if (payload.eventType !== 'UPDATE') return refresh();
        const updated = participantFromRow(payload.new as RoomPlayerRow);
        setSnapshot((prev) =>
          prev
            ? { ...prev, players: prev.players.map((p) => (p.id === updated.id ? { ...updated, pseudo: p.pseudo, avatar: p.avatar } : p)) }
            : prev,
        );
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === 'DELETE') return setStatus('missing');
        const room = roomFromRow(payload.new as RoomRow);
        setSnapshot((prev) => (prev ? { ...prev, room } : prev));
      })
      // (Ré)abonnement : on relit la room pour ne rien manquer pendant la coupure.
      .subscribe((state) => {
        setLive(state === 'SUBSCRIBED');
        if (state === 'SUBSCRIBED') refresh();
      });
    refresh();
    return () => {
      client.removeChannel(channel);
    };
  }, [roomId, refresh, applyGame]);

  // Realtime coupé (réseau, serveur) : on relit la room régulièrement en attendant la reconnexion.
  useEffect(() => {
    if (live) return;
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [live, refresh]);

  // Signe de vie, et reprise au retour dans l'application.
  const ready = status === 'ready';
  useEffect(() => {
    if (!ready) return;
    const beat = () => {
      heartbeat(getSupabase(), roomId).catch(() => {});
    };
    beat();
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        beat();
        refresh();
      }
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [ready, roomId, refresh]);

  return { snapshot, status, error, live, refresh, applyGame };
}

/** Heure courante, rafraîchie toutes les `intervalMs` (pour afficher qui est déconnecté). */
export function useNow(intervalMs = 5000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
  return now;
}
