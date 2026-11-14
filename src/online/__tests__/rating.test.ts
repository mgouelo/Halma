// Points (MMR) : formule, règles de résultat, et application par l'Edge Function
// (`handleGameRequest`) avec la base en mémoire.

import { describe, expect, it } from '@jest/globals';

import { c, seededRandom, stateWith } from '@/game/__test-utils__/helpers';
import type { PlayerId } from '@/game';

import {
  applyRatingDelta,
  expectedScore,
  humanMoveCount,
  lossPoints,
  MAX_RANKED_GAMES_PER_PAIR_PER_DAY,
  MIN_HUMAN_MOVES,
  RATING_FLOOR,
  RATING_SCALE,
  RATING_START,
  ratingChanges,
  ratingOutcome,
  winPoints,
  type RatingRole,
} from '../rating';
import { newOnlineGame } from '../referee';
import { handleGameRequest, type ServerOptions } from '../server';
import type { OnlineGame, Participant } from '../types';
import { ai, ALICE, BOB, CAROL, human, MemoryStore, NOW, onlineGame, ROOM_ID } from '../__test-utils__/fixtures';

const DANA = 'e0000000-0000-0000-0000-000000000005';

/** Historique : un coup par entrée, joué par le joueur indiqué. */
function history(players: number[]): OnlineGame['state']['history'] {
  return players.map((player) => ({ player: player as PlayerId, move: { from: c(0, 0), path: [c(0, 1)] } }));
}

/** `n` coups des joueurs `players`, chacun son tour. */
function turns(players: number[], n: number): number[] {
  return Array.from({ length: n }, (_, i) => players[i % players.length]);
}

/** Partie finie : vainqueur, raison, forfaits et historique (10 coups des deux premiers joueurs par défaut). */
function finished(
  participants: Participant[],
  winner: number | null,
  endReason: OnlineGame['endReason'],
  { forfeited = [] as number[], moves = turns([0, 1], 10) } = {},
): OnlineGame {
  const game = onlineGame(participants);
  return {
    ...game,
    state: { ...game.state, status: 'finished', winner: winner as PlayerId | null, history: history(moves) },
    forfeited: forfeited as PlayerId[],
    endReason,
  };
}

function roles(outcome: ReturnType<typeof ratingOutcome>): Record<string, string> {
  if (!outcome.ranked) throw new Error(`partie non classée : ${outcome.reason}`);
  return Object.fromEntries(
    outcome.roles.map((role) => [role.userId, role.result === 'none' ? 'none' : `${role.result}:${role.against.join(',')}`]),
  );
}

describe('formule', () => {
  it('constantes documentées', () => {
    expect(RATING_START).toBe(0);
    expect(RATING_FLOOR).toBe(-999);
    expect(RATING_SCALE).toBe(200);
    expect(MIN_HUMAN_MOVES).toBe(10);
    expect(MAX_RANKED_GAMES_PER_PAIR_PER_DAY).toBe(3);
  });

  it('à niveau égal : +30 et -15', () => {
    expect(expectedScore(500, 500)).toBe(0.5);
    expect(winPoints(0, 0)).toBe(30);
    expect(lossPoints(0, 0)).toBe(15);
    expect(winPoints(-400, -400)).toBe(30);
  });

  it('contre un adversaire plus faible : la victoire rapporte moins, la défaite coûte plus', () => {
    expect(winPoints(200, 0)).toBe(5);
    expect(lossPoints(200, 0)).toBe(27);
    expect(winPoints(50, 0)).toBeLessThan(30);
    expect(lossPoints(50, 0)).toBeGreaterThan(15);
  });

  it('contre un adversaire plus fort : l’inverse', () => {
    expect(winPoints(0, 200)).toBe(55);
    expect(lossPoints(0, 200)).toBe(3);
    expect(winPoints(0, 50)).toBeGreaterThan(30);
    expect(lossPoints(0, 50)).toBeLessThan(15);
  });

  it('au moins 1 point gagné ou perdu, même avec un énorme écart', () => {
    expect(winPoints(1000, -999)).toBe(1);
    expect(lossPoints(-999, 1000)).toBe(1);
  });

  it('plancher à -999', () => {
    expect(applyRatingDelta(-990, -15)).toBe(-999);
    expect(applyRatingDelta(-999, -1)).toBe(-999);
    expect(applyRatingDelta(-999, 30)).toBe(-969);
    expect(ratingChanges([{ userId: ALICE, result: 'loss', against: [BOB] }], { [ALICE]: -995, [BOB]: -995 })).toEqual([
      { userId: ALICE, before: -995, after: -999, delta: -4 },
    ]);
  });

  it('plusieurs joueurs : le gagnant contre la moyenne des autres, chaque perdant contre le gagnant', () => {
    const outcome: RatingRole[] = [
      { userId: ALICE, result: 'win', against: [BOB, CAROL] },
      { userId: BOB, result: 'loss', against: [ALICE] },
      { userId: CAROL, result: 'loss', against: [ALICE] },
    ];
    expect(ratingChanges(outcome, { [ALICE]: 100, [BOB]: 0, [CAROL]: -100 })).toEqual([
      { userId: ALICE, before: 100, after: 109, delta: 9 },
      { userId: BOB, before: 0, after: -7, delta: -7 },
      { userId: CAROL, before: -100, after: -103, delta: -3 },
    ]);
  });

  it('un joueur sans points enregistrés part de 0 ; « none » ne change rien', () => {
    expect(
      ratingChanges(
        [
          { userId: ALICE, result: 'win', against: [BOB] },
          { userId: BOB, result: 'none' },
        ],
        {},
      ),
    ).toEqual([
      { userId: ALICE, before: 0, after: 30, delta: 30 },
      { userId: BOB, before: 0, after: 0, delta: 0 },
    ]);
  });
});

describe('quelles parties sont classées', () => {
  it('pas tant que la partie continue', () => {
    const participants = [human(0, ALICE), human(1, BOB)];
    expect(ratingOutcome(onlineGame(participants), participants)).toEqual({ ranked: false, reason: 'not_finished' });
  });

  it('pas avec un seul humain, même avec des IA', () => {
    const participants = [human(0, ALICE), ai(1, 'hard'), ai(2, 'easy')];
    expect(ratingOutcome(finished(participants, 0, 'win', { moves: turns([0, 1, 2], 30) }), participants)).toEqual({
      ranked: false,
      reason: 'not_enough_humans',
    });
  });

  it('pas sous 10 coups d’humains : les coups d’IA ne comptent pas', () => {
    const participants = [human(0, ALICE), human(1, BOB), ai(2, 'hard')];
    const game = finished(participants, 0, 'win', { moves: turns([0, 1, 2], 27) });
    expect(humanMoveCount(game, participants)).toBe(18);
    const short = finished(participants, 0, 'win', { moves: [0, 1, 2, 2, 2, 2, 2, 0, 1, 0, 1, 0, 1, 0, 2] });
    expect(humanMoveCount(short, participants)).toBe(9);
    expect(ratingOutcome(short, participants)).toEqual({ ranked: false, reason: 'too_few_human_moves' });
    expect(ratingOutcome(game, participants).ranked).toBe(true);
  });

  it('pas sans aucun humain restant (partie arrêtée)', () => {
    const participants = [human(0, ALICE), human(1, BOB), ai(2, 'easy')];
    expect(ratingOutcome(finished(participants, null, 'abandoned', { forfeited: [0, 1] }), participants)).toEqual({
      ranked: false,
      reason: 'no_human_left',
    });
  });
});

describe('résultat', () => {
  it('humain contre humain : le gagnant contre l’autre, le perdant contre le gagnant', () => {
    const participants = [human(0, ALICE), human(1, BOB)];
    expect(roles(ratingOutcome(finished(participants, 1, 'win'), participants))).toEqual({
      [ALICE]: `loss:${BOB}`,
      [BOB]: `win:${ALICE}`,
    });
  });

  it('humains avec IA : les IA ne comptent dans aucune moyenne', () => {
    const participants = [human(0, ALICE), ai(1, 'hard'), human(2, BOB), human(3, CAROL)];
    expect(roles(ratingOutcome(finished(participants, 2, 'win', { moves: turns([0, 2, 3], 12) }), participants))).toEqual({
      [ALICE]: `loss:${BOB}`,
      [BOB]: `win:${ALICE},${CAROL}`,
      [CAROL]: `loss:${BOB}`,
    });
  });

  it('une IA gagne : personne ne bouge, sauf ceux qui sont partis, contre la moyenne des autres humains', () => {
    const participants = [human(0, ALICE), human(1, BOB), human(2, CAROL), ai(3, 'hard')];
    const allStayed = finished(participants, 3, 'win', { moves: turns([0, 1, 2, 3], 20) });
    expect(roles(ratingOutcome(allStayed, participants))).toEqual({ [ALICE]: 'none', [BOB]: 'none', [CAROL]: 'none' });
    const bobLeft = finished(participants, 3, 'win', { forfeited: [1], moves: turns([0, 1, 2, 3], 20) });
    expect(roles(ratingOutcome(bobLeft, participants))).toEqual({
      [ALICE]: 'none',
      [BOB]: `loss:${ALICE},${CAROL}`,
      [CAROL]: 'none',
    });
  });

  it('abandons : le seul humain restant gagne contre la moyenne de ceux qui sont partis', () => {
    const participants = [human(0, ALICE), human(1, BOB), human(2, CAROL)];
    const game = finished(participants, 0, 'forfeit', { forfeited: [1, 2], moves: turns([0, 1, 2], 12) });
    expect(roles(ratingOutcome(game, participants))).toEqual({
      [ALICE]: `win:${BOB},${CAROL}`,
      [BOB]: `loss:${ALICE}`,
      [CAROL]: `loss:${ALICE}`,
    });
  });

  it('abandons puis l’humain restant perd contre une IA : il ne perd rien, ceux qui sont partis perdent', () => {
    const participants = [human(0, ALICE), human(1, BOB), ai(2, 'medium')];
    const game = finished(participants, 2, 'win', { forfeited: [1], moves: turns([0, 1, 2], 18) });
    expect(roles(ratingOutcome(game, participants))).toEqual({ [ALICE]: 'none', [BOB]: `loss:${ALICE}` });
  });

  it('un humain parti ne peut pas être le gagnant', () => {
    const participants = [human(0, ALICE), human(1, BOB), ai(2, 'easy')];
    const game = finished(participants, 1, 'win', { forfeited: [1] });
    expect(roles(ratingOutcome(game, participants))).toEqual({ [ALICE]: 'none', [BOB]: `loss:${ALICE}` });
  });

  it('un compte supprimé n’est plus un humain classé', () => {
    const participants = [human(0, ALICE), { ...human(1, BOB), userId: null }, human(2, DANA)];
    expect(roles(ratingOutcome(finished(participants, 0, 'win', { moves: turns([0, 2], 10) }), participants))).toEqual({
      [ALICE]: `win:${DANA}`,
      [DANA]: `loss:${ALICE}`,
    });
  });
});

describe('Edge Function : application des points en fin de partie', () => {
  const options: ServerOptions = { now: () => NOW, ai: { random: seededRandom(3), timeLimitMs: 50 } };
  const winningMove = { action: 'move', roomId: ROOM_ID, turn: 10, move: { from: c(4, -4), path: [c(4, -5)] } };

  /** Alice (joueur 0) gagne au prochain coup ; 10 coups d'humains déjà joués. */
  function almostWon(participants: Participant[]): OnlineGame {
    const top = [c(4, -8), c(3, -7), c(4, -7), c(2, -6), c(3, -6), c(4, -6), c(1, -5), c(2, -5), c(3, -5)];
    const pieces: [number, number, number][] = [...top.map((cell): [number, number, number] => [cell.q, cell.r, 0]), [4, -4, 0], [0, 6, 1]];
    const game = newOnlineGame(stateWith(pieces, { playerCount: 2 }));
    return { ...game, state: { ...game.state, turn: 10, history: history(turns([0, 1], 10)) } };
  }

  it('humain contre humain : +30 et -15 enregistrés une seule fois', async () => {
    const participants = [human(0, ALICE), human(1, BOB)];
    const store = new MemoryStore({ participants, game: almostWon(participants) });
    expect((await handleGameRequest(winningMove, ALICE, store, options)).ok).toBe(true);
    expect(store.ratings.get(ALICE)).toBe(30);
    expect(store.ratings.get(BOB)).toBe(-15);
    expect(store.ratingDecisions.get('g1')?.ranked).toBe(true);

    // Une autre demande sur la partie finie : rattrapage sans effet.
    await handleGameRequest({ action: 'tick', roomId: ROOM_ID }, BOB, store, options);
    expect(store.ratings.get(ALICE)).toBe(30);
    expect(store.ratings.get(BOB)).toBe(-15);
  });

  it('points périmés (autre partie finie entre-temps) : relus et recalculés', async () => {
    const participants = [human(0, ALICE), human(1, BOB)];
    const store = new MemoryStore({ participants, game: almostWon(participants) });
    store.ratings.set(ALICE, 0);
    // Bob passe à 200 juste avant l'écriture : Alice (0) bat un adversaire plus fort (+55), Bob (200) perd contre plus faible (-27).
    store.beforeRecordRating = () => store.ratings.set(BOB, 200);
    await handleGameRequest(winningMove, ALICE, store, options);
    expect(store.ratings.get(ALICE)).toBe(55);
    expect(store.ratings.get(BOB)).toBe(173);
  });

  it('partie non classée (un seul humain) : décision enregistrée sans points', async () => {
    const participants = [human(0, ALICE), ai(1, 'easy')];
    const store = new MemoryStore({ participants, game: almostWon(participants) });
    await handleGameRequest(winningMove, ALICE, store, options);
    expect(store.ratingDecisions.get('g1')).toEqual({ ranked: false, reason: 'not_enough_humans', changes: [] });
    expect(store.ratings.size).toBe(0);
  });

  it('rien tant que la partie continue', async () => {
    const participants = [human(0, ALICE), human(1, BOB)];
    const store = new MemoryStore({ participants, game: almostWon(participants) });
    await handleGameRequest({ action: 'tick', roomId: ROOM_ID }, ALICE, store, options);
    expect(store.recordRatingCalls).toBe(0);
  });
});
