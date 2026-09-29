import { useEffect, useReducer } from 'react';

import { chooseMoveAsync, type Cell } from '@/game';

import { initLocalGame, isAiTurn, localGameReducer, TWO_HUMANS, type Controller } from './local-game-reducer';

/** Temps minimal avant qu'une IA joue, pour que son coup reste lisible (ms). */
const AI_MIN_THINK_MS = 450;

/**
 * Partie locale sur un seul appareil : humains et IA. Quand c'est à une IA de
 * jouer, son coup est calculé en tâche découpée (`chooseMoveAsync`) pour ne pas
 * figer l'interface, puis joué comme un coup humain (avec animation).
 */
export function useLocalGame(controllers: readonly Controller[] = TWO_HUMANS) {
  const [state, dispatch] = useReducer(localGameReducer, controllers, initLocalGame);

  const aiTurn = isAiTurn(state);
  const { game } = state;
  const level = state.controllers[game.currentPlayer];

  useEffect(() => {
    if (!aiTurn || level === 'human') return;
    const controller = new AbortController();
    const turn = game.turn;
    const minDelay = new Promise((resolve) => setTimeout(resolve, AI_MIN_THINK_MS));
    Promise.all([chooseMoveAsync(game, level, { signal: controller.signal }), minDelay])
      .then(([move]) => {
        if (move && !controller.signal.aborted) dispatch({ type: 'aiMove', move, turn });
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') throw error;
      });
    return () => controller.abort();
  }, [aiTurn, level, game]);

  return {
    ...state,
    aiThinking: aiTurn,
    tap: (cell: Cell) => dispatch({ type: 'tap', cell }),
    animationEnd: () => dispatch({ type: 'animationEnd' }),
    reset: () => dispatch({ type: 'reset' }),
  };
}
