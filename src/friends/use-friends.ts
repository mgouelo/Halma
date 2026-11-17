import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getSupabase } from '@/lib/supabase';

import {
  fetchFriendRequests,
  fetchFriends,
  sortFriends,
  type Friend,
  type FriendRequest,
} from './friends-service';

export type FriendsLoad =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; friends: Friend[]; requests: FriendRequest[] };

/**
 * Amis et demandes reçues du joueur connecté (compte e-mail : `userId` null
 * pour un invité ou sans session, et alors rien n'est demandé au serveur).
 * Relus au retour sur l'écran et en direct (Realtime) : une nouvelle demande,
 * ou une demande acceptée par l'autre, apparaît sans recharger.
 */
export function useFriends(userId: string | null) {
  const [load, setLoad] = useState<FriendsLoad>({ status: 'loading' });
  const request = useRef(0);

  const reload = useCallback(
    (quiet = true) => {
      if (!userId) return;
      const id = ++request.current;
      if (!quiet) setLoad({ status: 'loading' });
      const client = getSupabase();
      Promise.all([fetchFriends(client), fetchFriendRequests(client)])
        .then(([friends, requests]) => {
          if (id === request.current) setLoad({ status: 'ready', friends: sortFriends(friends), requests });
        })
        .catch((error: unknown) => {
          if (id !== request.current) return;
          // Relecture discrète ratée : on garde ce qui est affiché.
          setLoad((prev) =>
            quiet && prev.status === 'ready' ? prev : { status: 'error', error },
          );
        });
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      reload(true);
    }, [reload]),
  );

  // En direct : demandes reçues, amitiés (dans les deux colonnes de la paire).
  useEffect(() => {
    if (!userId) return;
    const client = getSupabase();
    const changed = () => reload(true);
    const channel = client
      .channel(`friends-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `recipient_id=eq.${userId}` }, changed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `user_a=eq.${userId}` }, changed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `user_b=eq.${userId}` }, changed)
      .subscribe((state) => {
        // (Ré)abonnement : on relit pour ne rien manquer pendant la coupure.
        if (state === 'SUBSCRIBED') changed();
      });
    return () => {
      client.removeChannel(channel);
    };
  }, [userId, reload]);

  return { load, reload };
}
