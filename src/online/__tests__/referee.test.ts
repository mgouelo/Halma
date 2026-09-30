import { describe, expect, it } from '@jest/globals';

import { applyMove, cornerCells, getAllLegalMoves, hasWon } from '@/game';
import { seededRandom, stateWith } from '@/game/__test-utils__/helpers';

import {
  advance,
  aiToPlay,
  forfeitPlayers,
  newOnlineGame,
  parseTimestamp,
  playAiTurn,
  stalePlayers,
  submitMove,
} from '../referee';
import { ai, ALICE, anyMove, BOB, CAROL, human, NOW, onlineGame, secondsAgo } from '../__test-utils__/fixtures';

describe('forfeitPlayers', () => {
  const trio = [human(0, ALICE), human(1, BOB), human(2, CAROL)];

  it('retire les pions du joueur et lui fait passer son tour', () => {
    const game = onlineGame(trio);
    const next = forfeitPlayers(game, trio, [0]);
    expect(next.forfeited).toEqual([0]);
    expect(Object.values(next.state.board)).not.toContain(0);
    expect(Object.keys(next.state.board)).toHaveLength(20);
    expect(next.state.currentPlayer).toBe(1);
    expect(next.endReason).toBeNull();
    // La partie d'origine n'est pas modifiée.
    expect(game.forfeited).toEqual([]);
    expect(Object.keys(game.state.board)).toHaveLength(30);
  });

  it('le moteur saute ensuite le joueur forfait', () => {
    const game = forfeitPlayers(onlineGame(trio), trio, [2]);
    const afterAlice = applyMove(game.state, anyMove(game.state));
    const afterBob = applyMove(afterAlice, anyMove(afterAlice));
    expect(afterBob.currentPlayer).toBe(0);
  });

  it('renvoie la même partie s’il n’y a personne de nouveau à retirer', () => {
    const game = forfeitPlayers(onlineGame(trio), trio, [1]);
    expect(forfeitPlayers(game, trio, [1])).toBe(game);
    expect(forfeitPlayers(game, trio, [])).toBe(game);
    expect(forfeitPlayers(game, trio, [7, -1])).toBe(game);
  });

  it('le dernier joueur restant gagne par forfait', () => {
    const next = forfeitPlayers(onlineGame(trio), trio, [0, 2]);
    expect(next).toMatchObject({ endReason: 'forfeit', forfeited: [0, 2], state: { status: 'finished', winner: 1 } });
  });

  it('sans humain restant, la partie est abandonnée sans vainqueur', () => {
    const players = [human(0, ALICE), ai(1), ai(2)];
    expect(forfeitPlayers(onlineGame(players), players, [0])).toMatchObject({
      endReason: 'abandoned',
      state: { status: 'finished', winner: null },
    });
  });

  it('libère la branche d’arrivée qu’occupaient les pions du joueur forfait', () => {
    // Bob (joueur 1) n'a jamais quitté sa branche, qui est la branche d'arrivée d'Alice.
    const duo = [human(0, ALICE), human(1, BOB)];
    const game = forfeitPlayers(onlineGame(duo), duo, [1]);
    expect(game.state.winner).toBe(0);
    const targetCells = cornerCells(game.state.players[0].target);
    expect(targetCells.every((cell) => game.state.board[`${cell.q},${cell.r}`] === undefined)).toBe(true);
  });

  it('ne touche pas à une partie terminée', () => {
    const game = forfeitPlayers(onlineGame(trio), trio, [0, 2]);
    expect(forfeitPlayers(game, trio, [1])).toBe(game);
  });
});

describe('stalePlayers', () => {
  it('ne retient que les humains en jeu silencieux depuis plus que le délai', () => {
    const players = [human(0, ALICE, secondsAgo(121)), human(1, BOB, secondsAgo(119)), ai(2), human(3, CAROL, secondsAgo(999))];
    const game = { ...onlineGame(players), forfeited: [3] };
    expect(stalePlayers(game, players, NOW, 120_000)).toEqual([0]);
  });

  it('ignore un horodatage illisible plutôt que de déclarer forfait', () => {
    const players = [human(0, ALICE, 'pas une date'), human(1, BOB)];
    expect(stalePlayers(onlineGame(players), players, NOW, 120_000)).toEqual([]);
  });

  it('lit les horodatages Postgres à la microseconde', () => {
    expect(parseTimestamp('2026-10-01T12:00:00.123456+00:00')).toBe(Date.parse('2026-10-01T12:00:00.123Z'));
    expect(parseTimestamp('2026-10-01T12:00:00+00:00')).toBe(Date.parse('2026-10-01T12:00:00Z'));
  });
});

describe('IA', () => {
  const players = [human(0, ALICE), ai(1, 'medium')];

  it('aiToPlay ne désigne une IA que pendant son tour', () => {
    const game = onlineGame(players);
    expect(aiToPlay(game, players)).toBeNull();
    const afterAlice = { ...game, state: applyMove(game.state, anyMove(game.state)) };
    expect(aiToPlay(afterAlice, players)?.id).toBe('p1');
  });

  it('playAiTurn joue un coup légal pour l’IA, et rien pendant le tour d’un humain', () => {
    const game = onlineGame(players);
    expect(playAiTurn(game, players)).toBe(game);
    const afterAlice = { ...game, state: applyMove(game.state, anyMove(game.state)) };
    const next = playAiTurn(afterAlice, players, { random: seededRandom(3) });
    expect(next.state.turn).toBe(2);
    expect(getAllLegalMoves(afterAlice.state, 1)).toContainEqual(next.state.history[1].move);
  });

  it('advance déclare les forfaits avant de faire jouer l’IA', () => {
    const group = [human(0, ALICE, secondsAgo(300)), ai(1), human(2, BOB)];
    const next = advance(onlineGame(group), group, NOW, { forfeitAfterMs: 120_000, random: seededRandom(1) });
    // Alice (dont c'était le tour) est forfait, l'IA a joué, c'est à Bob.
    expect(next.forfeited).toEqual([0]);
    expect(next.state.history.map((entry) => entry.player)).toEqual([1]);
    expect(next.state.currentPlayer).toBe(2);
  });

  it('une victoire de l’IA termine la partie', () => {
    // L'IA (joueur 1, vers le bas) a 9 pions en place et le 10e à un pas.
    const bottom = [[-4, 8], [-4, 7], [-3, 7], [-4, 6], [-3, 6], [-2, 6], [-4, 5], [-3, 5], [-2, 5]];
    const state = stateWith([...bottom.map(([q, r]): [number, number, number] => [q, r, 1]), [-1, 4, 1], [0, -6, 0]], {
      currentPlayer: 1,
    });
    const next = playAiTurn(newOnlineGame(state), players, { random: seededRandom(2) });
    expect(hasWon(next.state, 1)).toBe(true);
    expect(next).toMatchObject({ endReason: 'win', state: { winner: 1 } });
  });
});

describe('submitMove', () => {
  it('n’accepte que le numéro de coup courant', () => {
    const players = [human(0, ALICE), human(1, BOB)];
    const game = onlineGame(players);
    const move = anyMove(game.state);
    expect(submitMove(game, players, ALICE, move, 1)).toMatchObject({ ok: false, code: 'stale_turn' });
    expect(submitMove(game, players, ALICE, move, 0)).toMatchObject({ ok: true });
  });

  it('refuse un utilisateur sans place dans la partie (spectateur, place pas encore attribuée)', () => {
    const players = [human(0, ALICE), { ...human(1, BOB), playerIndex: null }];
    const game = onlineGame([human(0, ALICE), human(1, BOB)]);
    expect(submitMove(game, players, BOB, anyMove(game.state, 1), 0)).toMatchObject({ ok: false, code: 'not_in_game' });
    expect(submitMove(game, players, CAROL, anyMove(game.state), 0)).toMatchObject({ ok: false, code: 'not_in_game' });
  });
});
