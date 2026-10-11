// État d'interface d'une partie en ligne : sélection, cases atteignables, coup
// en attente de confirmation par le serveur, animation des coups reçus.
//
// Le serveur fait foi : un coup joué est affiché tout de suite (et animé), puis
// envoyé à l'Edge Function ; s'il est refusé, l'affichage revient au dernier
// état confirmé. Les coups des autres (reçus par Realtime) sont animés.

import { applyMove, sameCell, type Cell, type GameState, type Move, type PlayerId } from '@/game';
import { resolveTap, type Mutators, type TapNotice } from '@/mutators/mutators';
import type { StoredGame } from '@/online';

export interface PendingMove {
  move: Move;
  /** Numéro du coup au moment où il a été joué. */
  turn: number;
}

export interface OnlineGameState {
  /** Dernière partie confirmée par le serveur. */
  server: StoredGame;
  /** Partie affichée : celle du serveur, plus le coup en attente éventuel. */
  game: GameState;
  selected: Cell | null;
  moves: Move[];
  animating: { move: Move; player: PlayerId; turn: number } | null;
  /** Coup joué par ce joueur, pas encore confirmé par le serveur. */
  pending: PendingMove | null;
  /** Dernier refus du serveur, à afficher. */
  error: string | null;
  /** Retour discret après une touche refusée (mutateurs), effacé à la touche suivante. */
  notice: TapNotice | null;
}

export type OnlineGameAction =
  /** Nouvelle version de la partie (réponse du serveur ou Realtime). */
  | { type: 'sync'; game: StoredGame }
  /**
   * Touche sur une case ; `me` est l'identifiant du joueur sur cet appareil
   * (null : spectateur) ; `mutators` sont ceux de la room, figés au lancement.
   */
  | { type: 'tap'; cell: Cell; me: PlayerId | null; mutators: Mutators }
  /** Le serveur a refusé le coup en attente. */
  | { type: 'rejected'; pending: PendingMove; message: string }
  | { type: 'animationEnd' }
  | { type: 'dismissError' };

export function initOnlineGame(server: StoredGame): OnlineGameState {
  return {
    server,
    game: server.state,
    selected: null,
    moves: [],
    animating: null,
    pending: null,
    error: null,
    notice: null,
  };
}

function lastEntry(state: GameState) {
  return state.history.length > 0 ? state.history[state.history.length - 1] : null;
}

function sameMove(a: Move, b: Move): boolean {
  return sameCell(a.from, b.from) && a.path.length === b.path.length && a.path.every((cell, i) => sameCell(cell, b.path[i]));
}

/** Vrai si ce joueur peut jouer maintenant sur cet appareil. */
export function canPlay(state: OnlineGameState, me: PlayerId | null): boolean {
  const { game, server } = state;
  return (
    me !== null &&
    game.status === 'playing' &&
    server.endReason === null &&
    !server.forfeited.includes(me) &&
    game.currentPlayer === me &&
    !state.animating &&
    !state.pending
  );
}

function sync(state: OnlineGameState, next: StoredGame): OnlineGameState {
  const { server } = state;
  // Réponses et événements Realtime peuvent arriver dans le désordre : on garde la plus récente.
  if (next.id === server.id && next.version <= server.version) return state;

  const shown = state.game;
  const incoming = next.state;
  // Le coup en attente est confirmé si le serveur l'a enregistré à son numéro.
  const pendingEntry = state.pending ? incoming.history[state.pending.turn] : undefined;
  const confirmed = state.pending !== null && pendingEntry !== undefined && sameMove(pendingEntry.move, state.pending.move);
  const pending = state.pending && !confirmed && incoming.turn <= state.pending.turn ? state.pending : null;
  if (pending) {
    // Le serveur n'a pas encore vu notre coup (par exemple un forfait enregistré entre-temps) :
    // on garde l'affichage optimiste tant qu'il reste jouable.
    return { ...state, server: next };
  }

  // Animer le coup reçu s'il est le seul nouveau coup et n'est pas déjà affiché.
  const entry = lastEntry(incoming);
  const alreadyShown = shown.turn === incoming.turn;
  const animating =
    entry && incoming.turn === shown.turn + 1 && !alreadyShown
      ? { move: entry.move, player: entry.player, turn: incoming.turn }
      : alreadyShown
        ? state.animating
        : null;
  const turnChanged = incoming.turn !== shown.turn || incoming.currentPlayer !== shown.currentPlayer;
  return {
    ...state,
    server: next,
    game: incoming,
    pending: null,
    animating,
    selected: turnChanged ? null : state.selected,
    moves: turnChanged ? [] : state.moves,
    notice: turnChanged ? null : state.notice,
  };
}

export function onlineGameReducer(state: OnlineGameState, action: OnlineGameAction): OnlineGameState {
  switch (action.type) {
    case 'sync':
      return sync(state, action.game);

    case 'animationEnd':
      return state.animating ? { ...state, animating: null } : state;

    case 'dismissError':
      return state.error ? { ...state, error: null } : state;

    case 'rejected':
      if (state.pending !== action.pending) return state;
      return {
        ...state,
        game: state.server.state,
        pending: null,
        animating: null,
        selected: null,
        moves: [],
        error: action.message,
        notice: null,
      };

    case 'tap': {
      if (!canPlay(state, action.me) || action.me === null) return state;
      const { game } = state;
      const outcome = resolveTap({
        game,
        player: action.me,
        selected: state.selected,
        moves: state.moves,
        cell: action.cell,
        mutators: action.mutators,
      });
      switch (outcome.kind) {
        case 'play': {
          const { move } = outcome;
          return {
            ...state,
            game: applyMove(game, move),
            selected: null,
            moves: [],
            animating: { move, player: game.currentPlayer, turn: game.turn + 1 },
            pending: { move, turn: game.turn },
            error: null,
            notice: null,
          };
        }
        case 'select':
          return { ...state, selected: outcome.selected, moves: outcome.moves, error: null, notice: null };
        case 'clear':
          return { ...state, selected: null, moves: [], notice: null };
        case 'ignore':
          return state.notice === outcome.notice ? state : { ...state, notice: outcome.notice };
      }
    }
  }
}
