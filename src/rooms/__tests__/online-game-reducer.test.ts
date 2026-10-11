import { describe, expect, it } from '@jest/globals';

import { applyMove, cellKey, createGame, getAllLegalMoves, type GameState } from '@/game';
import { DEFAULT_MUTATORS } from '@/mutators/mutators';
import type { StoredGame } from '@/online';

import { canPlay, initOnlineGame, onlineGameReducer, type OnlineGameState } from '../online-game-reducer';

function stored(state: GameState, version: number, extra: Partial<StoredGame> = {}): StoredGame {
  return { id: 'g1', roomId: 'r1', version, state, forfeited: [], endReason: null, ...extra };
}

const start = createGame(2);
const aliceMove = getAllLegalMoves(start, 0)[0];
const afterAlice = applyMove(start, aliceMove);
const bobMove = getAllLegalMoves(afterAlice, 1)[0];
const afterBob = applyMove(afterAlice, bobMove);

/** Alice (joueur 0) sélectionne puis joue `aliceMove`. */
function playAlice(state: OnlineGameState = initOnlineGame(stored(start, 0))): OnlineGameState {
  const selected = onlineGameReducer(state, { type: 'tap', cell: aliceMove.from, me: 0, mutators: DEFAULT_MUTATORS });
  const destination = aliceMove.path[aliceMove.path.length - 1];
  return onlineGameReducer(selected, { type: 'tap', cell: destination, me: 0, mutators: DEFAULT_MUTATORS });
}

describe('onlineGameReducer', () => {
  it('sélectionne un de ses pions pendant son tour, pas ceux des autres', () => {
    const state = initOnlineGame(stored(start, 0));
    expect(
      onlineGameReducer(state, { type: 'tap', cell: aliceMove.from, me: 0, mutators: DEFAULT_MUTATORS }).selected,
    ).toEqual(aliceMove.from);
    // Bob ne peut rien faire pendant le tour d'Alice.
    const bobPiece = getAllLegalMoves(start, 1)[0].from;
    expect(onlineGameReducer(state, { type: 'tap', cell: bobPiece, me: 1, mutators: DEFAULT_MUTATORS })).toBe(state);
    // Un spectateur non plus.
    expect(onlineGameReducer(state, { type: 'tap', cell: aliceMove.from, me: null, mutators: DEFAULT_MUTATORS })).toBe(
      state,
    );
  });

  it('affiche le coup joué tout de suite et le garde en attente de confirmation', () => {
    const state = playAlice();
    expect(state.pending).toEqual({ move: aliceMove, turn: 0 });
    expect(state.game).toEqual(afterAlice);
    expect(state.animating?.move).toEqual(aliceMove);
    expect(state.server.version).toBe(0);
    expect(canPlay(state, 0)).toBe(false);
  });

  it('la confirmation du serveur remplace l’affichage sans rejouer l’animation', () => {
    const state = playAlice();
    const confirmed = onlineGameReducer(state, { type: 'sync', game: stored(afterAlice, 1) });
    expect(confirmed.pending).toBeNull();
    expect(confirmed.server.version).toBe(1);
    expect(confirmed.animating).toBe(state.animating);
  });

  it('un refus du serveur ramène au dernier état confirmé, avec le message', () => {
    const state = playAlice();
    const rejected = onlineGameReducer(state, { type: 'rejected', pending: state.pending!, message: 'Coup refusé.' });
    expect(rejected.game).toEqual(start);
    expect(rejected).toMatchObject({ pending: null, animating: null, error: 'Coup refusé.' });
    // Un refus qui concerne un autre coup (ancien) est ignoré.
    const other = onlineGameReducer(state, { type: 'rejected', pending: { move: aliceMove, turn: 0 }, message: 'x' });
    expect(other).toBe(state);
  });

  it('anime le coup d’un autre joueur reçu par Realtime', () => {
    const state = onlineGameReducer(initOnlineGame(stored(afterAlice, 1)), {
      type: 'sync',
      game: stored(afterBob, 2),
    });
    expect(state.game).toEqual(afterBob);
    expect(state.animating).toEqual({ move: bobMove, player: 1, turn: 2 });
  });

  it('ignore une version plus ancienne ou déjà connue', () => {
    const state = initOnlineGame(stored(afterBob, 2));
    expect(onlineGameReducer(state, { type: 'sync', game: stored(afterAlice, 1) })).toBe(state);
    expect(onlineGameReducer(state, { type: 'sync', game: stored(afterBob, 2) })).toBe(state);
  });

  it('n’anime pas un saut de plusieurs coups (reprise après une absence)', () => {
    const afterAlice2 = applyMove(afterBob, getAllLegalMoves(afterBob, 0)[0]);
    const state = onlineGameReducer(initOnlineGame(stored(afterAlice, 1)), { type: 'sync', game: stored(afterAlice2, 3) });
    expect(state.game.turn).toBe(3);
    expect(state.animating).toBeNull();
  });

  it('garde le coup en attente si le serveur change autre chose entre-temps', () => {
    const state = playAlice();
    // Un joueur est déclaré forfait avant que le coup n'arrive : même numéro de coup.
    const synced = onlineGameReducer(state, { type: 'sync', game: stored(start, 1, { forfeited: [1] }) });
    expect(synced.pending).toBe(state.pending);
    expect(synced.game).toEqual(afterAlice);
    expect(synced.server.version).toBe(1);
  });

  it('n’autorise plus à jouer un joueur qui a quitté la partie', () => {
    const state = initOnlineGame(stored(start, 3, { forfeited: [0] }));
    expect(canPlay(state, 0)).toBe(false);
    expect(onlineGameReducer(state, { type: 'tap', cell: aliceMove.from, me: 0, mutators: DEFAULT_MUTATORS })).toBe(
      state,
    );
  });

  it('efface la sélection quand le tour change', () => {
    const bobPiece = getAllLegalMoves(afterAlice, 1)[0].from;
    const selected = onlineGameReducer(initOnlineGame(stored(afterAlice, 1)), {
      type: 'tap',
      cell: bobPiece,
      me: 1,
      mutators: DEFAULT_MUTATORS,
    });
    expect(cellKey(selected.selected!)).toBe(cellKey(bobPiece));
    const later = onlineGameReducer(selected, { type: 'sync', game: stored(afterBob, 2) });
    expect(later).toMatchObject({ selected: null, moves: [] });
  });
});

describe('onlineGameReducer : mutateurs de la room', () => {
  const touchMove = { touchMove: true, clairvoyance: false };

  it('Toucher c’est jouer : le pion choisi ne se change plus, une case illégale ne joue rien', () => {
    const state = initOnlineGame(stored(start, 0));
    const selected = onlineGameReducer(state, { type: 'tap', cell: aliceMove.from, me: 0, mutators: touchMove });
    expect(selected.moves.length).toBeGreaterThan(0);

    const otherPiece = getAllLegalMoves(start, 0).find((m) => cellKey(m.from) !== cellKey(aliceMove.from))!.from;
    const locked = onlineGameReducer(selected, { type: 'tap', cell: otherPiece, me: 0, mutators: touchMove });
    expect(locked.selected).toEqual(aliceMove.from);
    expect(locked.notice).toBe('locked');

    const illegal = onlineGameReducer(locked, { type: 'tap', cell: { q: 0, r: 0 }, me: 0, mutators: touchMove });
    expect(illegal.pending).toBeNull();
    expect(illegal.notice).toBe('illegal');

    // Le coup légal part au serveur, qui le valide comme avant.
    const destination = aliceMove.path[aliceMove.path.length - 1];
    const played = onlineGameReducer(illegal, { type: 'tap', cell: destination, me: 0, mutators: touchMove });
    expect(played.pending).toEqual({ move: aliceMove, turn: 0 });
    expect(played.notice).toBeNull();
  });
});
