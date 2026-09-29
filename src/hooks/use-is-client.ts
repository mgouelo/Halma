import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * Faux pendant le rendu statique (web) et l'hydratation, vrai ensuite.
 * Sert à n'afficher qu'au client ce qui dépend de l'URL (paramètres de requête),
 * inconnue au moment de l'export statique.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
