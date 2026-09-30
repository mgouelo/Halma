import { createContext, useContext } from 'react';
import type { Edge } from 'react-native-safe-area-context';

/**
 * Vrai pour les écrans affichés au-dessus de la barre de navigation : c'est
 * elle qui gère la zone sûre du bas (barre d'accueil de l'iPhone, gestes Android).
 */
export const NavBarContext = createContext(false);

const ALL: readonly Edge[] = ['top', 'right', 'bottom', 'left'];
const WITHOUT_BOTTOM: readonly Edge[] = ['top', 'right', 'left'];

/** Bords de `SafeAreaView` pour l'écran courant : sans le bas quand la barre est dessous. */
export function useScreenEdges(): readonly Edge[] {
  return useContext(NavBarContext) ? WITHOUT_BOTTOM : ALL;
}
