import { useWindowDimensions } from 'react-native';

import { WideBreakpoint } from '@/constants/theme';

/** Vrai quand la fenêtre est assez large pour une disposition en deux colonnes (tablette, ordinateur). */
export function isWideWidth(width: number): boolean {
  return width >= WideBreakpoint;
}

export function useWideLayout(): boolean {
  return isWideWidth(useWindowDimensions().width);
}
