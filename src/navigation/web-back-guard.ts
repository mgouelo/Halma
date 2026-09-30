// Retour du navigateur (web) pendant une partie locale en cours.
//
// Sur le web, Expo Router suit l'historique du navigateur : au retour, il
// remplace toute la pile d'écrans d'un coup, sans l'évènement « beforeRemove »
// qui permet de demander confirmation sur mobile. On écoute donc « popstate »
// avant lui : ce module est importé par le layout racine, avant que le routeur
// n'installe son propre écouteur (les écouteurs sont appelés dans l'ordre où
// ils ont été ajoutés). Si un écran a posé une garde, on annule le retour (on
// revient à l'entrée d'historique de la partie, sans que le routeur ne voie
// rien) et on appelle la garde, qui demande confirmation.

import { Platform } from 'react-native';

type Guard = () => void;

let guard: Guard | null = null;
/** Vrai pendant l'annulation d'un retour : le « popstate » suivant est le nôtre. */
let restoring = false;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener(
    'popstate',
    (event) => {
      if (restoring) {
        restoring = false;
        event.stopImmediatePropagation();
        return;
      }
      if (!guard) return;
      event.stopImmediatePropagation();
      restoring = true;
      window.history.go(1);
      guard();
    },
    true,
  );
}

/**
 * Pose une garde sur le retour du navigateur (web ; sans effet ailleurs).
 * Renvoie la fonction qui la retire.
 */
export function setWebBackGuard(next: Guard): () => void {
  guard = next;
  return () => {
    if (guard === next) guard = null;
  };
}
