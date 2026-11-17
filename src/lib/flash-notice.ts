// Message d'information à montrer une fois sur l'écran suivant (par exemple
// « L'hôte a fermé la room » sur l'accueil, après le renvoi des joueurs).
// Un simple état partagé : rien n'est enregistré, il disparaît avec l'application.
// C'est un message à traduire (clé et variables) : il s'affiche dans la langue
// active au moment où on le lit.

import { useSyncExternalStore } from 'react';

import type { Msg } from '@/i18n';

let current: Msg | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setFlashNotice(message: Msg | null) {
  if (current === message) return;
  current = message;
  emit();
}

export function getFlashNotice(): Msg | null {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Message en attente (ou null) et fonction pour le fermer. */
export function useFlashNotice(): { message: Msg | null; dismiss: () => void } {
  const message = useSyncExternalStore(subscribe, getFlashNotice, getFlashNotice);
  return { message, dismiss: () => setFlashNotice(null) };
}
