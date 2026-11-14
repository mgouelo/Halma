import { router } from 'expo-router';
import { useEffect } from 'react';

/** Délai avant le retour automatique à l'accueil, le temps de lire le message de réussite. */
export const AUTO_HOME_DELAY_MS = 1800;

/** Quand `when` devient vrai, revient tout seul à l'accueil après un court délai. */
export function useAutoHome(when: boolean) {
  useEffect(() => {
    if (!when) return;
    const timer = setTimeout(() => router.dismissTo('/'), AUTO_HOME_DELAY_MS);
    return () => clearTimeout(timer);
  }, [when]);
}
