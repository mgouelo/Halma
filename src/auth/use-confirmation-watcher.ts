import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { createConfirmationPoller } from './confirmation-poller';

/**
 * Tant que `active` est vrai, relit le compte avec `check` toutes les
 * `intervalMs` millisecondes et dès que l'application revient au premier plan
 * (sur le web : l'onglet redevient visible). Appelle `onConfirmed` une fois.
 */
export function useConfirmationWatcher(
  active: boolean,
  check: () => Promise<boolean>,
  onConfirmed: () => void,
  intervalMs: number,
) {
  // Toujours les dernières fonctions, sans relancer l'attente à chaque rendu.
  const latest = useRef({ check, onConfirmed });
  useEffect(() => {
    latest.current = { check, onConfirmed };
  });

  useEffect(() => {
    if (!active) return;
    const poller = createConfirmationPoller({
      check: () => latest.current.check(),
      onConfirmed: () => latest.current.onConfirmed(),
      intervalMs,
    });
    poller.start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') poller.poke();
    });
    return () => {
      poller.stop();
      subscription.remove();
    };
  }, [active, intervalMs]);
}
