import { useState } from 'react';

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/**
 * Valeur à afficher pendant l'animation de fermeture d'une fenêtre : tant que
 * `visible` est vrai, la valeur courante ; dès qu'il passe à faux, la dernière
 * valeur qui était affichée. Sans cela, une fenêtre dont le contenu dépend d'un
 * état qui retombe à « rien » (la demande en attente repasse à null) changerait
 * de texte en plein fondu.
 */
export function useRetainedWhileHidden<T extends object>(visible: boolean, value: T): T {
  const [kept, setKept] = useState(value);
  if (visible && !shallowEqual(kept, value)) setKept(value);
  return visible ? value : kept;
}
