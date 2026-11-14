// Attente d'une validation faite ailleurs (lien de confirmation ouvert sur un
// autre appareil) : on relit le compte à intervalle court, et tout de suite au
// retour au premier plan, jusqu'à ce que la validation soit constatée.
// Logique pure (minuteries injectables), testée à part.

export interface PollerOptions {
  /** Vrai quand la validation est constatée. Une erreur (réseau…) est ignorée : on réessaie plus tard. */
  check: () => Promise<boolean>;
  /** Appelé une seule fois, quand `check` renvoie vrai. */
  onConfirmed: () => void;
  /** Délai entre deux vérifications. */
  intervalMs: number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

export interface Poller {
  start: () => void;
  stop: () => void;
  /** Vérifie tout de suite (retour au premier plan), sans attendre l'intervalle. */
  poke: () => void;
}

export function createConfirmationPoller({
  check,
  onConfirmed,
  intervalMs,
  setTimer = (callback, ms) => setTimeout(callback, ms),
  clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
}: PollerOptions): Poller {
  let running = false;
  let checking = false;
  let done = false;
  let timer: unknown = null;

  const schedule = () => {
    if (timer !== null) clearTimer(timer);
    timer = running && !done ? setTimer(run, intervalMs) : null;
  };

  async function run() {
    timer = null;
    if (!running || done || checking) return;
    checking = true;
    let confirmed = false;
    try {
      confirmed = await check();
    } catch {
      confirmed = false;
    } finally {
      checking = false;
    }
    if (!running || done) return;
    if (confirmed) {
      done = true;
      running = false;
      onConfirmed();
      return;
    }
    schedule();
  }

  return {
    start() {
      if (running || done) return;
      running = true;
      schedule();
    },
    stop() {
      running = false;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
    poke() {
      if (!running || done || checking) return;
      if (timer !== null) clearTimer(timer);
      timer = null;
      void run();
    },
  };
}
