import { describe, expect, it } from '@jest/globals';

import { isMyTurn, onlineTabTitle, type OnlineTurn } from '../turn-display';

const base: OnlineTurn = { finished: false, me: 1, forfeited: [], currentPlayer: 1, currentName: 'Toi' };

describe('tour en ligne : bannière et titre de l’onglet', () => {
  it('« À toi de jouer ! » quand c’est ton tour', () => {
    expect(isMyTurn(base)).toBe(true);
    expect(onlineTabTitle(base)).toBe('● À toi de jouer ! · Halma');
  });

  it('« En attente de <pseudo> » quand c’est à un autre', () => {
    const turn = { ...base, currentPlayer: 0, currentName: 'Camille' };
    expect(isMyTurn(turn)).toBe(false);
    expect(onlineTabTitle(turn)).toBe('En attente de Camille · Halma');
  });

  it('jamais à toi si tu regardes, si tu as quitté ou si la partie est finie', () => {
    expect(isMyTurn({ ...base, me: null })).toBe(false);
    expect(isMyTurn({ ...base, forfeited: [1] })).toBe(false);
    expect(isMyTurn({ ...base, finished: true })).toBe(false);
    expect(onlineTabTitle({ ...base, finished: true })).toBe('Partie terminée · Halma');
  });
});
