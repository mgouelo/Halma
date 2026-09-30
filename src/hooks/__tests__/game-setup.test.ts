import { describe, expect, it } from '@jest/globals';

import {
  MAX_HUMAN_COUNT,
  MIN_HUMAN_COUNT,
  parseControllers,
  serializeAiLevels,
  serializeHumanCount,
  turnOrderLabel,
} from '../game-setup';
import { initLocalGame } from '../local-game-reducer';

describe('paramètres de partie', () => {
  it('sans paramètre : deux humains', () => {
    expect(parseControllers(undefined)).toEqual(['human', 'human']);
    expect(parseControllers('')).toEqual(['human', 'human']);
  });

  it('un humain puis les IA dans l’ordre', () => {
    expect(parseControllers('medium')).toEqual(['human', 'medium']);
    expect(parseControllers(serializeAiLevels(['easy', 'hard', 'medium']))).toEqual(['human', 'easy', 'hard', 'medium']);
    expect(parseControllers(['hard,hard'])).toEqual(['human', 'hard', 'hard']);
  });

  it('accepte de 1 à 5 IA', () => {
    expect(parseControllers('easy,easy,easy,easy,easy')).toHaveLength(6);
    expect(parseControllers('easy,easy,easy,easy,easy,easy')).toEqual(['human', 'human']);
  });

  it('ignore un paramètre invalide', () => {
    expect(parseControllers('expert')).toEqual(['human', 'human']);
    expect(parseControllers('easy,,hard')).toEqual(['human', 'human']);
  });
});

describe('partie entre amis (même appareil)', () => {
  it.each([2, 3, 4, 5, 6])('%i joueurs humains, dans l’ordre du moteur', (count) => {
    const controllers = parseControllers(undefined, serializeHumanCount(count));
    expect(controllers).toEqual(Array(count).fill('human'));
    expect(initLocalGame(controllers).game.players).toHaveLength(count);
  });

  it('borne le nombre demandé de 2 à 6', () => {
    expect(serializeHumanCount(1)).toBe('2');
    expect(serializeHumanCount(9)).toBe('6');
    expect(serializeHumanCount(4)).toBe('4');
    expect(MIN_HUMAN_COUNT).toBe(2);
    expect(MAX_HUMAN_COUNT).toBe(6);
  });

  it('ignore un nombre de joueurs invalide', () => {
    expect(parseControllers(undefined, '1')).toEqual(['human', 'human']);
    expect(parseControllers(undefined, '7')).toEqual(['human', 'human']);
    expect(parseControllers(undefined, '4.5')).toEqual(['human', 'human']);
    expect(parseControllers(undefined, 'abc')).toEqual(['human', 'human']);
    expect(parseControllers(undefined, ['3'])).toEqual(['human', 'human', 'human']);
  });

  it('une partie contre l’IA garde un seul humain, même avec `players`', () => {
    expect(parseControllers('hard', '4')).toEqual(['human', 'hard']);
  });

  it('écrit l’ordre du tour en toutes lettres', () => {
    expect([0, 1, 2, 5].map(turnOrderLabel)).toEqual(['1er', '2e', '3e', '6e']);
  });
});
