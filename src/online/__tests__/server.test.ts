// Validation des coups côté serveur : l'Edge Function `game-action` passe
// chaque demande à `handleGameRequest`, testé ici avec une base en mémoire.

import { describe, expect, it, jest } from '@jest/globals';

import { applyMove, cellKey, createGame, getAllLegalMoves, type Move } from '@/game';
import { c, seededRandom, stateWith } from '@/game/__test-utils__/helpers';

import { OnlineError } from '../errors';
import { newOnlineGame } from '../referee';
import { handleGameRequest, type ServerOptions } from '../server';
import type { GameResponse, OnlineGame } from '../types';
import {
  ai,
  ALICE,
  anyMove,
  BOB,
  CAROL,
  human,
  MemoryStore,
  NOW,
  onlineGame,
  ROOM_ID,
  secondsAgo,
  STRANGER,
} from '../__test-utils__/fixtures';

const options: ServerOptions = { now: () => NOW, ai: { random: seededRandom(7), timeLimitMs: 50 } };

function send(store: MemoryStore, userId: string | null, body: unknown): Promise<GameResponse> {
  return handleGameRequest(body, userId, store, options);
}

function moveRequest(move: Move, turn: number) {
  return { action: 'move', roomId: ROOM_ID, turn, move };
}

/** Partie à deux humains : Alice (joueur 0) contre Bob (joueur 1). */
function duel(game: OnlineGame = onlineGame([human(0, ALICE), human(1, BOB)])) {
  return new MemoryStore({ participants: [human(0, ALICE), human(1, BOB)], game });
}

function expectFailure(response: GameResponse, code: string) {
  expect(response).toMatchObject({ ok: false, code });
  if (!response.ok) expect(response.message.length).toBeGreaterThan(0);
}

describe('authentification et format des demandes', () => {
  it('refuse une demande sans utilisateur authentifié', async () => {
    const store = duel();
    expectFailure(await send(store, null, moveRequest(anyMove(store.game!.state), 0)), 'not_authenticated');
  });

  it.each([
    ['un corps vide', null],
    ['un tableau', []],
    ['une action inconnue', { action: 'cheat', roomId: ROOM_ID }],
    ['un identifiant de room invalide', { action: 'tick', roomId: 'ABCDEF' }],
    ['un coup sans chemin', { action: 'move', roomId: ROOM_ID, turn: 0, move: { from: { q: 0, r: 5 } } }],
    ['un chemin vide', { action: 'move', roomId: ROOM_ID, turn: 0, move: { from: { q: 0, r: 5 }, path: [] } }],
    ['des coordonnées non entières', { action: 'move', roomId: ROOM_ID, turn: 0, move: { from: { q: 0.5, r: 5 }, path: [{ q: 0, r: 4 }] } }],
    ['des coordonnées en texte', { action: 'move', roomId: ROOM_ID, turn: 0, move: { from: { q: '0', r: 5 }, path: [{ q: 0, r: 4 }] } }],
    ['un chemin démesuré', { action: 'move', roomId: ROOM_ID, turn: 0, move: { from: { q: 0, r: 5 }, path: Array(500).fill({ q: 0, r: 4 }) } }],
    ['un coup sans numéro de tour', { action: 'move', roomId: ROOM_ID, move: { from: { q: 0, r: 5 }, path: [{ q: 0, r: 4 }] } }],
    ['un numéro de tour négatif', { action: 'move', roomId: ROOM_ID, turn: -1, move: { from: { q: 0, r: 5 }, path: [{ q: 0, r: 4 }] } }],
  ])('refuse %s', async (_label, body) => {
    const store = duel();
    expectFailure(await send(store, ALICE, body), 'bad_request');
    expect(store.saves).toBe(0);
  });

  it('traite une room dont on ne fait pas partie comme inexistante', async () => {
    const store = duel();
    expectFailure(await send(store, STRANGER, { action: 'tick', roomId: ROOM_ID }), 'room_not_found');
    expectFailure(await send(store, ALICE, { action: 'tick', roomId: '11111111-2222-4333-8444-555555555555' }), 'room_not_found');
  });
});

describe('lancement de la partie', () => {
  const lobby = () =>
    new MemoryStore({ participants: [human(0, ALICE), human(1, BOB), ai(3, 'hard')], game: null });

  it('refuse les coups avant le lancement', async () => {
    expectFailure(await send(lobby(), ALICE, moveRequest(anyMove(createGame(3)), 0)), 'game_not_started');
  });

  it('seul l’hôte lance la partie', async () => {
    const store = lobby();
    expectFailure(await send(store, BOB, { action: 'start', roomId: ROOM_ID }), 'not_host');
    expect(store.game).toBeNull();
  });

  it('refuse une room à un seul participant', async () => {
    const store = new MemoryStore({ participants: [human(0, ALICE)], game: null });
    expectFailure(await send(store, ALICE, { action: 'start', roomId: ROOM_ID }), 'not_enough_players');
  });

  it('crée la partie avec un joueur par participant, dans l’ordre des places', async () => {
    const store = lobby();
    const response = await send(store, ALICE, { action: 'start', roomId: ROOM_ID });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.game?.state.players).toHaveLength(3);
    expect(response.game?.state.turn).toBe(0);
    expect(store.participants.map((p) => p.playerIndex)).toEqual([0, 1, 2]);
    expect(store.room.status).toBe('playing');
    expectFailure(await send(store, ALICE, { action: 'start', roomId: ROOM_ID }), 'room_started');
  });

  it('transmet les erreurs de la base (revérifiées dans la transaction)', async () => {
    const store = lobby();
    store.begin = async () => {
      throw new OnlineError('room_started');
    };
    expectFailure(await send(store, ALICE, { action: 'start', roomId: ROOM_ID }), 'room_started');
  });
});

describe('validation des coups', () => {
  it('accepte un coup légal du joueur dont c’est le tour et l’enregistre', async () => {
    const store = duel();
    const move = anyMove(store.game!.state);
    const response = await send(store, ALICE, moveRequest(move, 0));

    expect(response.ok).toBe(true);
    expect(store.saves).toBe(1);
    expect(store.game!.version).toBe(1);
    expect(store.game!.state).toEqual(applyMove(createGame(2), move));
    expect(store.game!.state.currentPlayer).toBe(1);
    if (response.ok) expect(response.game).toEqual(store.game);
  });

  it('refuse le coup d’un joueur quand ce n’est pas son tour', async () => {
    const store = duel();
    const bobMove = anyMove(store.game!.state, 1);
    expectFailure(await send(store, BOB, moveRequest(bobMove, 0)), 'not_your_turn');
    expect(store.saves).toBe(0);
  });

  it('refuse de déplacer le pion d’un adversaire', async () => {
    const store = duel();
    // Alice (joueur 0, c'est son tour) essaie de jouer un pion de Bob.
    const bobMove = anyMove(store.game!.state, 1);
    const response = await send(store, ALICE, moveRequest(bobMove, 0));
    expectFailure(response, 'illegal_move');
    if (!response.ok) expect(response.message).toMatch(/pas au joueur dont c'est le tour/);
    expect(store.saves).toBe(0);
  });

  it('refuse un coup d’une case vide', async () => {
    const store = duel();
    const response = await send(store, ALICE, moveRequest({ from: c(0, 0), path: [c(1, 0)] }, 0));
    expectFailure(response, 'illegal_move');
    if (!response.ok) expect(response.message).toMatch(/Aucun pion/);
  });

  it('refuse un pas vers une case occupée', async () => {
    const store = duel();
    // Dans la branche de départ, (0,5) a pour voisin (0,6), occupé par un pion d'Alice.
    const response = await send(store, ALICE, moveRequest({ from: c(0, 5), path: [c(0, 6)] }, 0));
    expectFailure(response, 'illegal_move');
  });

  it('refuse un saut sans pion à sauter, un saut trop long et un pas suivi d’un saut', async () => {
    const game = newOnlineGame(stateWith([[0, 0, 0], [1, 0, 0], [0, -3, 1]]));
    const store = duel(game);
    for (const move of [
      { from: c(0, 0), path: [c(0, 2)] }, // rien à sauter
      { from: c(0, 0), path: [c(3, 0)] }, // trois cases d'un coup
      { from: c(0, 0), path: [c(0, 1), c(0, 3)] }, // pas simple puis autre chose
      { from: c(0, 0), path: [c(2, 0), c(0, 0)] }, // retour sur la case de départ
      { from: c(0, 0), path: [c(20, 0)] }, // hors du plateau
    ]) {
      expectFailure(await send(store, ALICE, moveRequest(move, 0)), 'illegal_move');
    }
    expect(store.saves).toBe(0);
  });

  it('accepte n’importe quel chemin valide de sauts enchaînés, pas seulement le plus court', async () => {
    // Depuis (0,0), (0,2) est atteint directement (par-dessus (0,1)) ou en
    // passant par (2,0) (par-dessus (1,0) puis (1,1)).
    const state = stateWith([[0, 0, 0], [1, 0, 1], [0, 1, 1], [1, 1, 0], [0, -6, 1]]);
    const store = duel(newOnlineGame(state));
    const response = await send(store, ALICE, moveRequest({ from: c(0, 0), path: [c(2, 0), c(0, 2)] }, 0));
    expect(response.ok).toBe(true);
    expect(store.game!.state.board[cellKey(c(0, 2))]).toBe(0);
    expect(store.game!.state.history[0].move.path).toEqual([c(2, 0), c(0, 2)]);
  });

  it('refuse un coup joué sur un état périmé (et donc un coup envoyé deux fois)', async () => {
    const store = duel();
    const move = anyMove(store.game!.state);
    expect((await send(store, ALICE, moveRequest(move, 0))).ok).toBe(true);
    expectFailure(await send(store, ALICE, moveRequest(move, 0)), 'stale_turn');
    expect(store.saves).toBe(1);
  });

  it('refuse les coups d’un joueur qui n’est pas dans la partie ou qui a abandonné', async () => {
    const store = new MemoryStore({
      participants: [human(0, ALICE), human(1, BOB), human(2, CAROL)],
      game: { ...onlineGame([human(0, ALICE), human(1, BOB), human(2, CAROL)]), forfeited: [0] },
    });
    // Le joueur 0 a abandonné : son tour est passé, et il ne peut plus rien jouer.
    store.game!.state.currentPlayer = 0;
    expectFailure(await send(store, ALICE, moveRequest(anyMove(createGame(3), 0), 0)), 'forfeited');
  });

  it('refuse les coups une fois la partie terminée', async () => {
    const game = onlineGame([human(0, ALICE), human(1, BOB)]);
    const finished: OnlineGame = { ...game, state: { ...game.state, status: 'finished', winner: 1 }, endReason: 'win' };
    const store = duel(finished);
    expectFailure(await send(store, ALICE, moveRequest(anyMove(game.state), 0)), 'game_over');
  });

  it('refuse qu’un humain joue à la place d’une IA', async () => {
    const participants = [human(0, ALICE), ai(1)];
    const game = onlineGame(participants);
    const afterAlice = applyMove(game.state, anyMove(game.state));
    const store = new MemoryStore({ participants, game: { ...game, state: afterAlice } });
    expectFailure(await send(store, ALICE, moveRequest(anyMove(afterAlice), 1)), 'not_your_turn');
  });

  it('enregistre la victoire', async () => {
    // Alice a 9 pions dans la branche du haut et le 10e juste en dessous.
    const top = [c(4, -8), c(3, -7), c(4, -7), c(2, -6), c(3, -6), c(4, -6), c(1, -5), c(2, -5), c(3, -5)];
    const state = stateWith([...top.map((cell): [number, number, number] => [cell.q, cell.r, 0]), [4, -4, 0], [0, 6, 1]]);
    const store = duel(newOnlineGame(state));
    const response = await send(store, ALICE, moveRequest({ from: c(4, -4), path: [c(4, -5)] }, 0));
    expect(response.ok).toBe(true);
    expect(store.game).toMatchObject({ endReason: 'win', state: { status: 'finished', winner: 0 } });
    expect(store.room.status).toBe('finished');
  });
});

describe('écritures concurrentes', () => {
  it('rejoue la demande sur l’état frais si la partie a changé sans la contredire', async () => {
    const store = duel();
    const move = anyMove(store.game!.state);
    // Juste avant l'écriture, une autre écriture passe (par exemple un « tick » sans effet visible).
    store.beforeSave = () => {
      store.game = { ...store.game!, version: store.game!.version + 1 };
    };
    const response = await send(store, ALICE, moveRequest(move, 0));
    expect(response.ok).toBe(true);
    expect(store.game!.version).toBe(2);
    expect(store.game!.state.turn).toBe(1);
  });

  it('refuse le coup si l’écriture concurrente a fait avancer la partie', async () => {
    const store = duel();
    const move = anyMove(store.game!.state);
    // Le même coup, envoyé en double, est enregistré par l'autre requête entre-temps.
    store.beforeSave = () => {
      store.game = { ...store.game!, state: applyMove(store.game!.state, move), version: 1 };
    };
    expectFailure(await send(store, ALICE, moveRequest(move, 0)), 'stale_turn');
    expect(store.game!.state.turn).toBe(1);
  });

  it('abandonne après plusieurs conflits de suite', async () => {
    const store = duel();
    store.save = async () => null;
    expectFailure(await send(store, ALICE, moveRequest(anyMove(store.game!.state), 0)), 'conflict');
  });

  it('transforme une panne de la base en erreur serveur', async () => {
    const store = duel();
    store.failLoad = new Error('connexion perdue');
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    expectFailure(await send(store, ALICE, { action: 'tick', roomId: ROOM_ID }), 'server_error');
    error.mockRestore();
  });
});

describe('IA côté serveur (tick)', () => {
  it('fait jouer un seul coup légal à l’IA dont c’est le tour', async () => {
    const participants = [human(0, ALICE), ai(1, 'hard'), ai(2, 'easy')];
    const game = onlineGame(participants);
    const afterAlice = applyMove(game.state, anyMove(game.state));
    const store = new MemoryStore({ participants, game: { ...game, state: afterAlice } });

    const response = await send(store, ALICE, { action: 'tick', roomId: ROOM_ID });
    expect(response.ok).toBe(true);
    const played = store.game!.state.history[1];
    expect(played.player).toBe(1);
    expect(getAllLegalMoves(afterAlice, 1)).toContainEqual(played.move);
    expect(store.game!.state.currentPlayer).toBe(2);
    expect(store.saves).toBe(1);
  });

  it('ne fait rien (et n’écrit rien) quand c’est à un humain de jouer', async () => {
    const store = new MemoryStore({ participants: [human(0, ALICE), ai(1)], game: onlineGame([human(0, ALICE), ai(1)]) });
    const response = await send(store, ALICE, { action: 'tick', roomId: ROOM_ID });
    expect(response.ok).toBe(true);
    expect(store.saves).toBe(0);
  });
});

describe('déconnexions et abandons', () => {
  it('un joueur revenu à temps garde sa place', async () => {
    const store = new MemoryStore({
      participants: [human(0, ALICE), human(1, BOB, secondsAgo(100))],
      game: onlineGame([human(0, ALICE), human(1, BOB)]),
    });
    await send(store, ALICE, { action: 'tick', roomId: ROOM_ID });
    expect(store.game!.forfeited).toEqual([]);
    expect(store.saves).toBe(0);
  });

  it('déclare forfait un joueur déconnecté depuis plus de 2 minutes : l’autre gagne', async () => {
    const store = new MemoryStore({
      participants: [human(0, ALICE), human(1, BOB, secondsAgo(121))],
      game: onlineGame([human(0, ALICE), human(1, BOB)]),
    });
    await send(store, ALICE, { action: 'tick', roomId: ROOM_ID });
    expect(store.game).toMatchObject({ forfeited: [1], endReason: 'forfeit', state: { status: 'finished', winner: 0 } });
    expect(Object.values(store.game!.state.board)).not.toContain(1);
  });

  it('la partie continue entre les joueurs restants', async () => {
    const participants = [human(0, ALICE, secondsAgo(500)), human(1, BOB), ai(2)];
    const store = new MemoryStore({ participants, game: onlineGame(participants) });
    await send(store, BOB, { action: 'tick', roomId: ROOM_ID });
    expect(store.game!.forfeited).toEqual([0]);
    expect(store.game!.endReason).toBeNull();
    // C'était le tour d'Alice : la main est passée à Bob.
    expect(store.game!.state.currentPlayer).toBe(1);
    const bob = anyMove(store.game!.state);
    expect((await send(store, BOB, moveRequest(bob, 0))).ok).toBe(true);
  });

  it('une partie où il ne reste que des IA est abandonnée', async () => {
    const participants = [human(0, ALICE, secondsAgo(500)), ai(1), ai(2)];
    const store = new MemoryStore({ participants, game: onlineGame(participants) });
    await send(store, ALICE, { action: 'tick', roomId: ROOM_ID });
    expect(store.game).toMatchObject({ endReason: 'abandoned', state: { status: 'finished', winner: null } });
  });

  it('abandonner fait gagner l’adversaire, même hors de son tour', async () => {
    const store = duel();
    expect((await send(store, BOB, { action: 'resign', roomId: ROOM_ID })).ok).toBe(true);
    expect(store.game).toMatchObject({ forfeited: [1], endReason: 'forfeit', state: { winner: 0 } });
    expectFailure(await send(store, BOB, { action: 'resign', roomId: ROOM_ID }), 'forfeited');
  });
});
