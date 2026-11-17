import { useState } from 'react';

import { useT } from '@/i18n';

import { describeAuthError } from './errors';

/**
 * Exécute une action d'authentification en suivant son état : en cours, et
 * message d'erreur (traduit à l'affichage : il suit un changement de langue).
 * Renvoie vrai si l'action a réussi.
 */
export function useAuthAction() {
  const t = useT();
  const [pending, setPending] = useState(false);
  // L'erreur brute est gardée, enveloppée (une erreur peut valoir null ou undefined).
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

  const error = failure ? describeAuthError(t, failure.error) : null;
  /** Efface l'erreur affichée. */
  const clearError = () => setFailure(null);

  return { pending, error, clearError, run };
}
