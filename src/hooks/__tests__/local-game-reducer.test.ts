import { describe, expect, it } from '@jest/globals';

import { cellKey, cornerCells, createGame, type GameState, type PlayerId } from '@/game';
import { DEFAULT_MUTATORS, type Mutators } from '@/mutators/mutators';

import {
  destinationOf,
  initLocalGame,
  isAiTurn,
  localGameReducer,
  type Controller,
  type LocalGameState,
} from '../local-game-reducer';

const c = (q: number, r: number) => ({ q, r });

function withBoard(
  pieces: [number, number, PlayerId][],
  currentPlayer: PlayerId = 0,
  controllers: Controller[] = ['human', 'human'],
  mutators: Mutators = DEFAULT_MUTATORS,
): LocalGameState {
  const game: GameState = { ...createGame(2), board: {}, currentPlayer };
  for (const [q, r, player] of pieces) game.board[cellKey({ q, r })] = player;
  return { game, controllers, selected: null, moves: [], animating: null, mutators: { ...mutators }, notice: null };
}

describe('localGameReducer', () => {
  it('démarre une partie à 2 joueurs sans sélection', () => {
    const state = initLocalGame();
    expect(state.game.players).toHaveLength(2);
    expect(state).toMatchObject({ selected: null, moves: [], animating: null });
  });

  it('sélectionne un pion du joueur courant et liste ses coups', () => {
    const state = localGameReducer(withBoard([[0, 0, 0], [1, 0, 1]]), { type: 'tap', cell: c(0, 0) });
    expect(state.selected).toEqual(c(0, 0));
    expect(state.moves.map((m) => cellKey(destinationOf(m)))).toContain('2,0');
  });

  it('ignore les pions de l’adversaire', () => {
    const before = withBoard([[0, 0, 0], [1, 0, 1]]);
    expect(localGameReducer(before, { type: 'tap', cell: c(1, 0) })).toBe(before);
  });

  it('désélectionne en touchant à nouveau le pion ou une case sans intérêt', () => {
    const selected = localGameReducer(withBoard([[0, 0, 0]]), { type: 'tap', cell: c(0, 0) });
    expect(localGameReducer(selected, { type: 'tap', cell: c(0, 0) }).selected).toBeNull();
    expect(localGameReducer(selected, { type: 'tap', cell: c(3, 3) }).selected).toBeNull();
  });

  it('change de pion sélectionné', () => {
    const selected = localGameReducer(withBoard([[0, 0, 0], [0, 3, 0]]), { type: 'tap', cell: c(0, 0) });
    expect(localGameReducer(selected, { type: 'tap', cell: c(0, 3) }).selected).toEqual(c(0, 3));
  });

  it('joue le coup en touchant une destination, puis attend la fin de l’animation', () => {
    let state = withBoard([[0, 0, 0], [1, 0, 1], [0, 4, 1]]);
    state = localGameReducer(state, { type: 'tap', cell: c(0, 0) });
    state = localGameReducer(state, { type: 'tap', cell: c(2, 0) });

    expect(state.game.board['2,0']).toBe(0);
    expect(state.game.currentPlayer).toBe(1);
    expect(state.animating).toEqual({ move: { from: c(0, 0), path: [c(2, 0)] }, player: 0, turn: 1 });
    expect(state.selected).toBeNull();

    // Pendant l'animation, les touches sont ignorées.
    expect(localGameReducer(state, { type: 'tap', cell: c(0, 4) })).toBe(state);

    state = localGameReducer(state, { type: 'animationEnd' });
    expect(state.animating).toBeNull();
    expect(localGameReducer(state, { type: 'tap', cell: c(0, 4) }).selected).toEqual(c(0, 4));
  });

  it('termine la partie sur le coup gagnant et bloque les touches ensuite', () => {
    const target = cornerCells(0).filter((cell) => cellKey(cell) !== '1,-5');
    let state = withBoard([...target.map((cell): [number, number, PlayerId] => [cell.q, cell.r, 0]), [1, -4, 0], [0, 4, 1]]);
    state = localGameReducer(state, { type: 'tap', cell: c(1, -4) });
    state = localGameReducer(state, { type: 'tap', cell: c(1, -5) });
    state = localGameReducer(state, { type: 'animationEnd' });

    expect(state.game.status).toBe('finished');
    expect(state.game.winner).toBe(0);
    expect(localGameReducer(state, { type: 'tap', cell: c(0, 4) })).toBe(state);
  });

  it('recommence une partie', () => {
    let state = localGameReducer(withBoard([[0, 0, 0]]), { type: 'tap', cell: c(0, 0) });
    state = localGameReducer(state, { type: 'reset' });
    expect(state).toEqual(initLocalGame());
  });
});

describe('localGameReducer avec des IA', () => {
  const vsAi: Controller[] = ['human', 'hard'];

  it('crée une partie à autant de joueurs que de contrôleurs', () => {
    const state = initLocalGame(['human', 'easy', 'medium', 'hard', 'easy', 'medium']);
    expect(state.game.players).toHaveLength(6);
    expect(state.controllers).toEqual(['human', 'easy', 'medium', 'hard', 'easy', 'medium']);
    expect(() => initLocalGame(['human'])).toThrow();
  });

  it('ignore les touches pendant le tour de l’IA', () => {
    const state = withBoard([[0, 0, 0], [0, 4, 1]], 1, vsAi);
    expect(isAiTurn(state)).toBe(true);
    expect(localGameReducer(state, { type: 'tap', cell: c(0, 4) })).toBe(state);
  });

  it('joue le coup de l’IA avec animation', () => {
    const state = withBoard([[0, 0, 0], [0, 4, 1]], 1, vsAi);
    const move = { from: c(0, 4), path: [c(0, 3)] };
    const next = localGameReducer(state, { type: 'aiMove', move, turn: state.game.turn });
    expect(next.game.board['0,3']).toBe(1);
    expect(next.game.currentPlayer).toBe(0);
    expect(next.animating).toMatchObject({ move, player: 1 });
    expect(isAiTurn(next)).toBe(false);
  });

  it('ignore un coup d’IA arrivé trop tard ou hors de son tour', () => {
    const aiTurn = withBoard([[0, 0, 0], [0, 4, 1]], 1, vsAi);
    const move = { from: c(0, 4), path: [c(0, 3)] };
    expect(localGameReducer(aiTurn, { type: 'aiMove', move, turn: aiTurn.game.turn + 1 })).toBe(aiTurn);
    const humanTurn = withBoard([[0, 0, 0], [0, 4, 1]], 0, vsAi);
    expect(localGameReducer(humanTurn, { type: 'aiMove', move, turn: humanTurn.game.turn })).toBe(humanTurn);
  });

  it('attend la fin de l’animation avant le tour suivant de l’IA', () => {
    let state = withBoard([[0, 0, 0], [0, 4, 1]], 0, vsAi);
    state = localGameReducer(state, { type: 'tap', cell: c(0, 0) });
    state = localGameReducer(state, { type: 'tap', cell: c(0, -1) });
    expect(state.game.currentPlayer).toBe(1);
    expect(isAiTurn(state)).toBe(false);
    state = localGameReducer(state, { type: 'animationEnd' });
    expect(isAiTurn(state)).toBe(true);
  });

  it('garde les mêmes contrôleurs en recommençant', () => {
    const state = localGameReducer(initLocalGame(['human', 'easy', 'hard']), { type: 'reset' });
    expect(state.controllers).toEqual(['human', 'easy', 'hard']);
  });
});

describe('localGameReducer : mutateurs', () => {
  const touchMove = { touchMove: true, clairvoyance: true };
  const blind = { touchMove: false, clairvoyance: false };
  // Pion bloqué à la pointe de la branche du haut : ses deux voisins et leurs cases d'arrivée de saut sont occupés.
  const blockedPieces: [number, number, PlayerId][] = [
    [4, -8, 0],
    [3, -7, 1],
    [4, -7, 1],
    [2, -6, 1],
    [4, -6, 1],
  ];

  it('Toucher c’est jouer : un pion qui peut bouger ne se change ni ne s’annule', () => {
    const selected = localGameReducer(withBoard([[0, 0, 0], [0, 3, 0]], 0, undefined, touchMove), {
      type: 'tap',
      cell: c(0, 0),
    });
    expect(selected.moves.length).toBeGreaterThan(0);

    const other = localGameReducer(selected, { type: 'tap', cell: c(0, 3) });
    expect(other.selected).toEqual(c(0, 0));
    expect(other.notice).toBe('locked');

    const again = localGameReducer(selected, { type: 'tap', cell: c(0, 0) });
    expect(again.selected).toEqual(c(0, 0));

    const elsewhere = localGameReducer(selected, { type: 'tap', cell: c(3, 3) });
    expect(elsewhere.selected).toEqual(c(0, 0));
    expect(elsewhere.notice).toBe('illegal');

    // Le coup du pion choisi se joue normalement et efface le retour.
    const played = localGameReducer(elsewhere, { type: 'tap', cell: c(1, 0) });
    expect(played.game.board['1,0']).toBe(0);
    expect(played.notice).toBeNull();
  });

  it('Toucher c’est jouer : un pion bloqué ne verrouille pas le joueur', () => {
    const state = withBoard([...blockedPieces, [0, 0, 0]], 0, undefined, touchMove);
    const blocked = localGameReducer(state, { type: 'tap', cell: c(4, -8) });
    expect(blocked.selected).toEqual(c(4, -8));
    expect(blocked.moves).toEqual([]);
    // Il peut choisir un autre pion…
    expect(localGameReducer(blocked, { type: 'tap', cell: c(0, 0) }).selected).toEqual(c(0, 0));
    // … ou annuler sa sélection.
    expect(localGameReducer(blocked, { type: 'tap', cell: c(4, -8) }).selected).toBeNull();
  });

  it('sans Toucher c’est jouer, on change toujours de pion (comportement par défaut)', () => {
    const selected = localGameReducer(withBoard([[0, 0, 0], [0, 3, 0]]), { type: 'tap', cell: c(0, 0) });
    expect(localGameReducer(selected, { type: 'tap', cell: c(0, 3) }).selected).toEqual(c(0, 3));
  });

  it('sans Clairvoyance : les coups restent connus du réducteur, une case illégale ne joue rien', () => {
    const selected = localGameReducer(withBoard([[0, 0, 0], [1, 0, 1]], 0, undefined, blind), {
      type: 'tap',
      cell: c(0, 0),
    });
    // Les cases atteignables sont calculées (l'écran ne les dessine pas).
    expect(selected.moves.map((m) => cellKey(destinationOf(m)))).toContain('2,0');

    const illegal = localGameReducer(selected, { type: 'tap', cell: c(3, 3) });
    expect(illegal.game).toBe(selected.game);
    expect(illegal.selected).toEqual(c(0, 0));
    expect(illegal.notice).toBe('illegal');
    // Le même refus ne recrée pas d'état.
    expect(localGameReducer(illegal, { type: 'tap', cell: c(3, 3) })).toBe(illegal);

    // Toucher le pion choisi annule la sélection (Toucher c'est jouer est désactivé).
    expect(localGameReducer(illegal, { type: 'tap', cell: c(0, 0) }).selected).toBeNull();

    // Une case légale joue le coup.
    const played = localGameReducer(illegal, { type: 'tap', cell: c(2, 0) });
    expect(played.game.board['2,0']).toBe(0);
    expect(played.notice).toBeNull();
  });

  it('garde les mutateurs à « Nouvelle partie »', () => {
    const state = initLocalGame({ controllers: ['human', 'medium'], mutators: touchMove });
    expect(localGameReducer(state, { type: 'reset' }).mutators).toEqual(touchMove);
    expect(initLocalGame().mutators).toEqual(DEFAULT_MUTATORS);
  });
});
