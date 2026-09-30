// Configuration d'une partie transmise dans l'URL de l'écran de jeu :
// `/game` pour deux humains, `/game?players=4` pour quatre humains sur le même
// appareil, `/game?ai=medium,hard` pour un humain contre deux IA (une par
// niveau listé, dans l'ordre des places).

import { AI_LEVELS, type AiLevel } from '@/game';

import { TWO_HUMANS, type Controller } from './local-game-reducer';

export const MIN_AI_COUNT = 1;
export const MAX_AI_COUNT = 5;

/** Nombre de joueurs humains d'une partie locale entre amis (même appareil). */
export const MIN_HUMAN_COUNT = 2;
export const MAX_HUMAN_COUNT = 6;

export const AI_LEVEL_LABELS: Record<AiLevel, string> = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
};

function isAiLevel(value: string): value is AiLevel {
  return (AI_LEVELS as readonly string[]).includes(value);
}

function first(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

/** Valeur du paramètre `ai` pour une liste de niveaux. */
export function serializeAiLevels(levels: readonly AiLevel[]): string {
  return levels.join(',');
}

/** Valeur du paramètre `players` pour une partie entre amis (nombre borné de 2 à 6). */
export function serializeHumanCount(count: number): string {
  return String(Math.min(MAX_HUMAN_COUNT, Math.max(MIN_HUMAN_COUNT, Math.round(count))));
}

function parseAi(raw: string): Controller[] | null {
  const levels = raw.split(',');
  if (levels.length < MIN_AI_COUNT || levels.length > MAX_AI_COUNT || !levels.every(isAiLevel)) return null;
  return ['human', ...levels];
}

function parseHumans(raw: string): Controller[] | null {
  if (!/^[0-9]$/.test(raw)) return null;
  const count = Number(raw);
  if (count < MIN_HUMAN_COUNT || count > MAX_HUMAN_COUNT) return null;
  return Array<Controller>(count).fill('human');
}

/**
 * Contrôleurs de la partie à partir des paramètres de l'URL :
 * - `ai` : le joueur 0 (en bas) est l'humain, les suivants sont les IA ;
 * - sinon `players` : autant d'humains, de 2 à 6, qui se passent l'appareil.
 * Un paramètre absent ou invalide donne une partie à deux humains.
 */
export function parseControllers(
  aiParam: string | string[] | undefined,
  playersParam?: string | string[] | undefined,
): Controller[] {
  const ai = first(aiParam);
  if (ai) return parseAi(ai) ?? [...TWO_HUMANS];
  const players = first(playersParam);
  if (players) return parseHumans(players) ?? [...TWO_HUMANS];
  return [...TWO_HUMANS];
}

/** Rang dans l'ordre du tour, écrit en toutes lettres : « 1er », « 2e »… */
export function turnOrderLabel(player: number): string {
  return player === 0 ? '1er' : `${player + 1}e`;
}
