// Remplaçant minimal de react-native-reanimated pour les tests d'écran : pas
// d'animation, les vues animées sont de simples vues.

import { View } from 'react-native';

const animation = {
  duration: () => animation,
  delay: () => animation,
};

const identity = <T>(value: T) => value;

export default { View, createAnimatedComponent: identity };
export const FadeIn = animation;
export const ZoomIn = animation;
export const useReducedMotion = () => true;
export const useSharedValue = <T>(value: T) => ({ value });
export const useAnimatedStyle = () => ({});
export const withDelay = (_delay: number, value: unknown) => value;
export const withRepeat = identity;
export const withSequence = identity;
export const withTiming = identity;
