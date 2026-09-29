// Configuration d'une partie transmise dans l'URL de l'écran de jeu :
// `/game` pour deux humains, `/game?ai=medium,hard` pour un humain contre
// deux IA (une par niveau listé, dans l'ordre des places).

import { AI_LEVELS, type AiLevel } from '@/game';

import { TWO_HUMANS, type Controller } from './local-game-reducer';

export const MIN_AI_COUNT = 1;
export const MAX_AI_COUNT = 5;

export const AI_LEVEL_LABELS: Record<AiLevel, string> = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
};

function isAiLevel(value: string): value is AiLevel {
  return (AI_LEVELS as readonly string[]).includes(value);
}

/** Valeur du paramètre `ai` pour une liste de niveaux. */
export function serializeAiLevels(levels: readonly AiLevel[]): string {
  return levels.join(',');
}

/**
 * Contrôleurs de la partie à partir du paramètre `ai` : le joueur 0 (en bas)
 * est l'humain, les suivants sont les IA. Un paramètre absent ou invalide
 * donne une partie à deux humains.
 */
export function parseControllers(aiParam: string | string[] | undefined): Controller[] {
  const raw = Array.isArray(aiParam) ? aiParam[0] : aiParam;
  if (!raw) return [...TWO_HUMANS];
  const levels = raw.split(',');
  if (levels.length < MIN_AI_COUNT || levels.length > MAX_AI_COUNT || !levels.every(isAiLevel)) {
    return [...TWO_HUMANS];
  }
  return ['human', ...levels];
}
