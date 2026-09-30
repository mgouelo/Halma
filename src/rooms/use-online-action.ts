import { useState } from 'react';

import { describeOnlineError } from './room-service';

/**
 * Exécute une action du jeu en ligne en suivant son état : en cours, message
 * d'erreur en français. Renvoie vrai si l'action a réussi.
 */
export function useOnlineAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setPending(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(describeOnlineError(e));
      return false;
    } finally {
      setPending(false);
    }
  };

  return { pending, error, setError, run };
}
