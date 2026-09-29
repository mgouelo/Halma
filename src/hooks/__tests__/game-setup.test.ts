import { describe, expect, it } from '@jest/globals';

import { parseControllers, serializeAiLevels } from '../game-setup';

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
