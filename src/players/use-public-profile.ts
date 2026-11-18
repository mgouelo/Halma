import { useCallback, useEffect, useRef, useState } from 'react';

import { getSupabase } from '@/lib/supabase';

import { fetchPublicProfile, isPlayerNotFound, type PlayerRelation, type PublicProfile } from './public-profile';

export type PublicProfileLoad =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; profile: PublicProfile };

/** État après un échec de lecture : joueur introuvable, ou erreur à réessayer. */
function failure(error: unknown): PublicProfileLoad {
  return isPlayerNotFound(error) ? { status: 'not_found' } : { status: 'error', error };
}

/**
 * Profil public d'un joueur (compte e-mail connecté seulement : l'écran ne
 * l'appelle pas pour un invité). `reload()` relit avec l'indicateur de
 * chargement (« Réessayer ») ; `reload({ fallback })` relit discrètement après
 * une action d'amitié et, si la relecture échoue, garde le profil affiché avec
 * la relation `fallback`.
 */
export function usePublicProfile(userId: string) {
  const [load, setLoad] = useState<PublicProfileLoad>({ status: 'loading' });
  const request = useRef(0);

  // Première lecture : l'état est déjà « chargement ».
  useEffect(() => {
    const id = ++request.current;
    fetchPublicProfile(getSupabase(), userId).then(
      (profile) => {
        if (id === request.current) setLoad({ status: 'ready', profile });
      },
      (error: unknown) => {
        if (id === request.current) setLoad(failure(error));
      },
    );
  }, [userId]);

  const reload = useCallback(
    async ({ fallback }: { fallback?: PlayerRelation } = {}) => {
      const id = ++request.current;
      if (!fallback) setLoad({ status: 'loading' });
      try {
        const profile = await fetchPublicProfile(getSupabase(), userId);
        if (id === request.current) setLoad({ status: 'ready', profile });
      } catch (error) {
        if (id !== request.current) return;
        if (fallback && !isPlayerNotFound(error)) {
          // Relecture discrète ratée : on garde le profil affiché, avec la relation attendue.
          setLoad((prev) =>
            prev.status === 'ready' ? { status: 'ready', profile: { ...prev.profile, relation: fallback } } : prev,
          );
        } else {
          setLoad(failure(error));
        }
      }
    },
    [userId],
  );

  return { load, reload };
}
