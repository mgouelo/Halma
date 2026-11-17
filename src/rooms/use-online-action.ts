import { useState } from 'react';

import { useT } from '@/i18n';

import { describeOnlineError } from './room-service';

/**
 * Exécute une action du jeu en ligne en suivant son état : en cours, et
 * message d'erreur (traduit à l'affichage). Renvoie vrai si l'action a réussi.
 */
export function useOnlineAction() {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setPending(true);
    setFailure(null);
    try {
      await action();
      return true;
    } catch (e) {
      setFailure({ error: e });
      return false;
    } finally {
      setPending(false);
    }
  };

  const error = failure ? describeOnlineError(t, failure.error) : null;

  return { pending, error, run };
}
