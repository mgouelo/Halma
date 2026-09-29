import { useReducer } from 'react';

import type { Cell, PlayerCount } from '@/game';

import { initLocalGame, localGameReducer } from './local-game-reducer';

/** Partie locale sur un seul appareil (état d'interface + moteur de règles). */
export function useLocalGame(playerCount: PlayerCount = 2) {
  const [state, dispatch] = useReducer(localGameReducer, playerCount, initLocalGame);
  return {
    ...state,
    tap: (cell: Cell) => dispatch({ type: 'tap', cell }),
    animationEnd: () => dispatch({ type: 'animationEnd' }),
    reset: () => dispatch({ type: 'reset' }),
  };
}
