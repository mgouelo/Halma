import { describe, expect, it } from '@jest/globals';

import {
  AI_LEVELS,
  applyMove,
  cellKey,
  chooseMove,
  chooseMoveAsync,
  cornerCells,
  createGame,
  evaluate,
  getAllLegalMoves,
  moveProgress,
  validateMove,
  type AiLevel,
  type GameState,
  type PlayerCount,
  type PlayerId,
} from '..';
import { c, seededRandom, stateWith } from '../__test-utils__/helpers';

/** Horloge figée : la limite de temps n'est jamais atteinte (résultats reproductibles). */
const frozenClock = () => 0;

/** Joueur 0 à un pas de la victoire : 9 pions dans la branche du haut, un en (1,-4). */
function oneMoveFromWin(): GameState {
  const target = cornerCells(0).filter((cell) => cellKey(cell) !== '1,-5');
  return stateWith([...target.map((cell): [number, number, PlayerId] => [cell.q, cell.r, 0]), [1, -4, 0], [0, 4, 1]]);
}

function playGame(levels: AiLevel[], seed: number, maxDepth = 3): GameState {
  const random = seededRandom(seed);
  let state = createGame(levels.length as PlayerCount);
  while (state.status === 'playing' && state.turn < 600) {
    const move = chooseMove(state, levels[state.currentPlayer], { random, maxDepth, now: frozenClock });
    state = applyMove(state, move!);
  }
  return state;
}

describe('chooseMove', () => {
  it.each(AI_LEVELS)('renvoie un coup légal au niveau %s, de 2 à 6 joueurs', (level) => {
    for (const count of [2, 3, 4, 5, 6] as const) {
      const state = createGame(count);
      const move = chooseMove(state, level, { random: seededRandom(count), maxDepth: 2 });
      expect(move).not.toBeNull();
      expect(validateMove(state, move!)).toEqual({ ok: true });
    }
  });

  it('renvoie null quand la partie est terminée', () => {
    const finished = applyMove(oneMoveFromWin(), { from: c(1, -4), path: [c(1, -5)] });
    for (const level of AI_LEVELS) expect(chooseMove(finished, level)).toBeNull();
  });

  it.each(['medium', 'hard'] as const)('le niveau %s joue le coup gagnant quand il existe', (level) => {
    const move = chooseMove(oneMoveFromWin(), level, { random: seededRandom(1), now: frozenClock });
    expect(move).toEqual({ from: c(1, -4), path: [c(1, -5)] });
  });

  it('le niveau moyen choisit le coup qui avance le plus', () => {
    const state = stateWith([
      [0, 0, 0],
      [0, -1, 1],
      [0, -3, 1],
      [0, 6, 1],
    ]);
    // Saut enchaîné (0,0) → (0,-2) → (0,-4) : 4 cases vers le haut en un coup.
    expect(chooseMove(state, 'medium', { random: seededRandom(3) })).toEqual({
      from: c(0, 0),
      path: [c(0, -2), c(0, -4)],
    });
  });

  it('le niveau facile varie ses coups mais préfère avancer', () => {
    const state = createGame(2);
    const random = seededRandom(7);
    const picks = Array.from({ length: 300 }, () => chooseMove(state, 'easy', { random })!);
    const distinct = new Set(picks.map((m) => JSON.stringify(m)));
    const average = picks.reduce((sum, m) => sum + moveProgress(state, m), 0) / picks.length;
    const uniformAverage =
      getAllLegalMoves(state, 0).reduce((sum, m) => sum + moveProgress(state, m), 0) / getAllLegalMoves(state, 0).length;
    expect(distinct.size).toBeGreaterThan(5);
    expect(average).toBeGreaterThan(uniformAverage);
  });

  it('le niveau difficile est reproductible avec le même générateur aléatoire', () => {
    const state = createGame(3);
    const a = chooseMove(state, 'hard', { random: seededRandom(5), maxDepth: 3, now: frozenClock });
    const b = chooseMove(state, 'hard', { random: seededRandom(5), maxDepth: 3, now: frozenClock });
    expect(a).toEqual(b);
  });
});

describe('limite de temps', () => {
  it('le niveau difficile s’arrête à la limite et renvoie quand même un coup', () => {
    const state = createGame(6);
    const start = Date.now();
    const move = chooseMove(state, 'hard', { timeLimitMs: 60, maxDepth: 12 });
    const elapsed = Date.now() - start;
    expect(validateMove(state, move!)).toEqual({ ok: true });
    expect(elapsed).toBeLessThan(60 + 150);
  });

  it('respecte la limite avec une horloge simulée', () => {
    let t = 0;
    const now = () => (t += 1); // chaque lecture de l'horloge fait avancer le temps de 1 ms
    const move = chooseMove(createGame(6), 'hard', { timeLimitMs: 20, maxDepth: 12, now });
    expect(move).not.toBeNull();
    expect(t).toBeLessThan(200);
  });
});

describe('chooseMoveAsync', () => {
  it('rend la main pendant le calcul', async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 0);
    const move = await chooseMoveAsync(createGame(6), 'hard', { timeLimitMs: 150, maxDepth: 12 });
    clearInterval(timer);
    expect(move).not.toBeNull();
    expect(ticks).toBeGreaterThan(3);
  });

  it('donne le même résultat que la version synchrone', async () => {
    const state = createGame(2);
    const options = { maxDepth: 3, now: frozenClock };
    const sync = chooseMove(state, 'hard', { ...options, random: seededRandom(9) });
    const async = await chooseMoveAsync(state, 'hard', { ...options, random: seededRandom(9) });
    expect(async).toEqual(sync);
  });

  it('peut être annulé', async () => {
    const controller = new AbortController();
    const promise = chooseMoveAsync(createGame(6), 'hard', { timeLimitMs: 2000, maxDepth: 12, signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('évaluation', () => {
  it('est nulle et symétrique au départ, et maximale en cas de victoire', () => {
    const state = createGame(2);
    expect(evaluate(state, 0)).toBeCloseTo(0);
    const won = applyMove(oneMoveFromWin(), { from: c(1, -4), path: [c(1, -5)] });
    expect(evaluate(won, 0)).toBeGreaterThan(1000);
    expect(evaluate(won, 1)).toBeLessThan(-1000);
  });
});

describe('parties complètes', () => {
  it('deux IA moyennes terminent une partie', () => {
    const end = playGame(['medium', 'medium'], 1);
    expect(end.status).toBe('finished');
    expect(end.winner).not.toBeNull();
  });

  it('le niveau moyen bat le niveau facile', () => {
    expect(playGame(['medium', 'easy'], 2).winner).toBe(0);
    expect(playGame(['easy', 'medium'], 3).winner).toBe(1);
  });

  it('le niveau difficile bat le niveau moyen', () => {
    expect(playGame(['hard', 'medium'], 4).winner).toBe(0);
    expect(playGame(['medium', 'hard'], 5).winner).toBe(1);
  }, 30000);
});
