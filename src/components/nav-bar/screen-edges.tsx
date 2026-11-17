import { createContext, useContext } from 'react';
import type { Edge } from 'react-native-safe-area-context';

/**
 * Hauteur de la barre de navigation pour les écrans affichés au-dessus d'elle (`null` : pas de
 * barre). La barre est posée par-dessus le contenu, sur fond transparent : c'est elle qui gère
 * la zone sûre du bas (barre d'accueil de l'iPhone, gestes Android), et chaque écran réserve
 * cette hauteur en bas de son contenu pour que le dernier élément ne reste pas dessous.
 */
export const NavBarContext = createContext<number | null>(null);

const ALL: readonly Edge[] = ['top', 'right', 'bottom', 'left'];
const WITHOUT_BOTTOM: readonly Edge[] = ['top', 'right', 'left'];

/** Bords de `SafeAreaView` pour l'écran courant : sans le bas quand la barre est dessous. */
export function useScreenEdges(): readonly Edge[] {
  return useContext(NavBarContext) !== null ? WITHOUT_BOTTOM : ALL;
}

/** Place à garder en bas d'un écran défilant pour que son contenu passe au-dessus de la barre (0 sans barre). */
export function useNavBarInset(): number {
  return useContext(NavBarContext) ?? 0;
}
