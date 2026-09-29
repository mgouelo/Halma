import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * Taille réelle d'une vue, mesurée après affichage. Vaut 0 × 0 avant la
 * première mesure (et pendant le rendu statique sur le web), ce qui évite de
 * dessiner avec une taille de fenêtre fausse.
 */
export function useMeasuredSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };
  return { ...size, onLayout };
}
