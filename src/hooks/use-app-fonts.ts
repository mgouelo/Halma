import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';

import { FONT_FILES } from '@/constants/fonts';

/** Au-delà, on affiche l'application avec la police système plutôt que de rester sur l'écran de démarrage. */
export const FONT_TIMEOUT_MS = 4000;

/**
 * Charge la police de l'application. Vrai quand on peut afficher : police
 * chargée, chargement en échec, ou trop long (police système de secours).
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FONT_FILES);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
  return loaded || error !== null || timedOut;
}
