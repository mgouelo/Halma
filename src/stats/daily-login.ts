// Connexion du jour : appelée à l'ouverture de l'application et à chaque retour
// au premier plan, elle n'envoie la demande au serveur qu'une fois par jour
// (jour de Paris), ne bloque rien et ne lève jamais (hors ligne, par exemple).

import { parisDay } from './streak';

export interface DailyLoginTracker {
  /** Enregistre la connexion du jour si ce n'est pas déjà fait ; vrai si elle vient de l'être. */
  check: () => Promise<boolean>;
}

export function createDailyLoginTracker(
  record: () => Promise<unknown>,
  now: () => Date = () => new Date(),
): DailyLoginTracker {
  let doneDay: string | null = null;
  let pending: Promise<boolean> | null = null;
  return {
    check() {
      const today = parisDay(now());
      if (doneDay === today) return Promise.resolve(false);
      // Une seule demande à la fois (ouverture et retour au premier plan simultanés).
      pending ??= record()
        .then(() => {
          doneDay = today;
          return true;
        })
        // Échec (réseau, serveur) : on réessaiera au prochain retour dans l'application.
        .catch(() => false)
        .finally(() => {
          pending = null;
        });
      return pending;
    },
  };
}
