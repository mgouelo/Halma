// Victoires comptées pour le classement : règle de `winAward` et appels de
// l'Edge Function (`handleGameRequest`) à `recordWin`, avec la base en mémoire.

import { describe, expect, it, jest } from '@jest/globals';

import { c, seededRandom, stateWith } from '@/game/__test-utils__/helpers';

import { newOnlineGame } from '../referee';
import { handleGameRequest, type ServerOptions } from '../server';
import { strongestAiLevel, winAward } from '../stats';
import type { OnlineGame, Participant } from '../types';
import { ai, ALICE, BOB, CAROL, human, MemoryStore, NOW, onlineGame, ROOM_ID } from '../__test-utils__/fixtures';

const options: ServerOptions = { now: () => NOW, ai: { random: seededRandom(3), timeLimitMs: 50 } };

/** Partie finie : `winner` a gagné pour la raison `endReason`. */
function finished(participants: Participant[], winner: number | null, endReason: OnlineGame['endReason']): OnlineGame {
  const game = onlineGame(participants);
  return { ...game, state: { ...game.state, status: 'finished', winner }, endReason };
}

/**
 * Le joueur 0 a 9 pions dans la branche du haut et le 10e juste en dessous :
 * le coup (4,-4) → (4,-5) le fait gagner. Les autres joueurs ont un pion chacun.
 */
function almostWon(playerCount: number): OnlineGame {
  const top = [c(4, -8), c(3, -7), c(4, -7), c(2, -6), c(3, -6), c(4, -6), c(1, -5), c(2, -5), c(3, -5)];
  const others: [number, number, number][] = [
    [0, 6, 1],
    [-4, 8, 2],
    [-1, 5, 3],
  ].slice(0, playerCount - 1) as [number, number, number][];
  const pieces: [number, number, number][] = [...top.map((cell): [number, number, number] => [cell.q, cell.r, 0]), [4, -4, 0], ...others];
  return newOnlineGame(stateWith(pieces, { playerCount: playerCount as 2 | 3 | 4 }));
}

const winningMove = { action: 'move', roomId: ROOM_ID, turn: 0, move: { from: c(4, -4), path: [c(4, -5)] } };

describe('niveau de l’IA la plus forte', () => {
  it.each([
    [[human(0, ALICE), human(1, BOB)], null],
    [[human(0, ALICE), ai(1, 'easy')], 'easy'],
    [[human(0, ALICE), ai(1, 'easy'), ai(2, 'medium'), ai(3, 'easy')], 'medium'],
    [[ai(0, 'hard'), human(1, ALICE), ai(2, 'easy')], 'hard'],
  ])('%#', (participants, expected) => {
    expect(strongestAiLevel(participants)).toBe(expected);
  });
});

describe('winAward', () => {
  it('compte la victoire d’un humain, rangée selon l’IA la plus forte', () => {
    const participants = [human(0, ALICE), ai(1, 'easy'), ai(2, 'hard'), human(3, BOB)];
    expect(winAward(finished(participants, 3, 'win'), participants)).toEqual({ userId: BOB, aiLevel: 'hard' });
  });

  it('compte une victoire sans IA dans « toutes victoires » seulement', () => {
    const participants = [human(0, ALICE), human(1, BOB)];
    expect(winAward(finished(participants, 0, 'win'), participants)).toEqual({ userId: ALICE, aiLevel: null });
  });

  it('ne compte pas la victoire d’une IA', () => {
    const participants = [human(0, ALICE), ai(1, 'medium')];
    expect(winAward(finished(participants, 1, 'win'), participants)).toBeNull();
  });

  it('ne compte pas une victoire par forfait ou abandon des autres, ni une partie arrêtée', () => {
    const participants = [human(0, ALICE), human(1, BOB), ai(2, 'hard')];
    expect(winAward(finished(participants, 0, 'forfeit'), participants)).toBeNull();
    expect(winAward(finished(participants, null, 'abandoned'), participants)).toBeNull();
  });

  it('ne compte rien tant que la partie continue', () => {
    const participants = [human(0, ALICE), ai(1, 'easy')];
    expect(winAward(onlineGame(participants), participants)).toBeNull();
  });

  it('ne compte pas un joueur déclaré forfait', () => {
    const participants = [human(0, ALICE), human(1, BOB)];
    expect(winAward({ ...finished(participants, 0, 'win'), forfeited: [0] }, participants)).toBeNull();
  });
});

describe('comptage par l’Edge Function', () => {
  it('compte le coup gagnant une seule fois, même si la demande est renvoyée', async () => {
    const participants = [human(0, ALICE), ai(1, 'easy'), ai(2, 'medium')];
    const store = new MemoryStore({ participants, game: almostWon(3) });
    expect((await handleGameRequest(winningMove, ALICE, store, options)).ok).toBe(true);
    expect(store.wins.get(ALICE)).toEqual({ total: 1, easy: 0, medium: 1, hard: 0 });

    // Le même coup renvoyé (réseau) est refusé, et rien n'est compté en plus.
    await handleGameRequest(winningMove, ALICE, store, options);
    await handleGameRequest({ action: 'tick', roomId: ROOM_ID }, BOB, store, options);
    await handleGameRequest({ action: 'tick', roomId: ROOM_ID }, ALICE, store, options);
    expect(store.wins.get(ALICE)).toEqual({ total: 1, easy: 0, medium: 1, hard: 0 });
    expect(store.countedGames.size).toBe(1);
  });

  it('ne compte rien pour le perdant', async () => {
    const participants = [human(0, ALICE), human(1, BOB)];
    const store = new MemoryStore({ participants, game: almostWon(2) });
    await handleGameRequest(winningMove, ALICE, store, options);
    expect(store.wins.get(ALICE)?.total).toBe(1);
    expect(store.wins.has(BOB)).toBe(false);
  });

  it('ne compte pas une victoire par abandon de l’adversaire', async () => {
    const participants = [human(0, ALICE), human(1, BOB)];
    const store = new MemoryStore({ participants, game: onlineGame(participants) });
    expect((await handleGameRequest({ action: 'resign', roomId: ROOM_ID }, BOB, store, options)).ok).toBe(true);
    expect(store.game).toMatchObject({ endReason: 'forfeit', state: { winner: 0 } });
    expect(store.wins.size).toBe(0);
  });

  it('n’appelle pas la base pour un coup ordinaire', async () => {
    const participants = [human(0, ALICE), human(1, BOB), human(2, CAROL)];
    const store = new MemoryStore({ participants, game: almostWon(3) });
    await handleGameRequest(
      { action: 'move', roomId: ROOM_ID, turn: 0, move: { from: c(4, -4), path: [c(5, -4)] } },
      ALICE,
      store,
      options,
    );
    expect(store.saves).toBe(1);
    expect(store.recordWinCalls).toBe(0);
  });

  it('une panne des statistiques ne fait pas échouer le coup, et la demande suivante rattrape', async () => {
    const participants = [human(0, ALICE), human(1, BOB)];
    const store = new MemoryStore({ participants, game: almostWon(2) });
    store.failRecordWin = new Error('base indisponible');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect((await handleGameRequest(winningMove, ALICE, store, options)).ok).toBe(true);
    spy.mockRestore();
    expect(store.game?.endReason).toBe('win');
    expect(store.wins.size).toBe(0);

    store.failRecordWin = null;
    await handleGameRequest({ action: 'tick', roomId: ROOM_ID }, BOB, store, options);
    expect(store.wins.get(ALICE)?.total).toBe(1);
  });
});
