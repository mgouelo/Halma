// Message d'information à montrer une fois sur l'écran suivant (par exemple
// « L'hôte a fermé la room » sur l'accueil, après le renvoi des joueurs).
// Un simple état partagé : rien n'est enregistré, il disparaît avec l'application.

import { useSyncExternalStore } from 'react';

let current: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setFlashNotice(message: string | null) {
  if (current === message) return;
  current = message;
  emit();
}

export function getFlashNotice(): string | null {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Message en attente (ou null) et fonction pour le fermer. */
export function useFlashNotice(): { message: string | null; dismiss: () => void } {
  const message = useSyncExternalStore(subscribe, getFlashNotice, getFlashNotice);
  return { message, dismiss: () => setFlashNotice(null) };
}
