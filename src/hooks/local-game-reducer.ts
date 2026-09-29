// État d'interface d'une partie locale : sélection, cases atteignables,
// coup en cours d'animation. Les règles viennent toutes du moteur (`@/game`) :
// ce réducteur ne fait que l'interroger et lui transmettre les coups.

import {
  applyMove,
  cellKey,
  createGame,
  getLegalMoves,
  pieceAt,
  sameCell,
  type Cell,
  type GameState,
  type Move,
  type PlayerCount,
  type PlayerId,
} from '@/game';

export interface LocalGameState {
  game: GameState;
  /** Pion sélectionné par le joueur dont c'est le tour. */
  selected: Cell | null;
  /** Coups légaux du pion sélectionné (un par destination). */
  moves: Move[];
  /** Dernier coup joué, tant que son animation n'est pas terminée. */
  animating: { move: Move; player: PlayerId; turn: number } | null;
}

export type LocalGameAction =
  | { type: 'tap'; cell: Cell }
  | { type: 'animationEnd' }
  | { type: 'reset'; playerCount?: PlayerCount };

export function initLocalGame(playerCount: PlayerCount = 2): LocalGameState {
  return { game: createGame(playerCount), selected: null, moves: [], animating: null };
}

/** Destination d'un coup (dernière case du chemin). */
export function destinationOf(move: Move): Cell {
  return move.path[move.path.length - 1];
}

export function localGameReducer(state: LocalGameState, action: LocalGameAction): LocalGameState {
  switch (action.type) {
    case 'reset':
      return initLocalGame(action.playerCount ?? (state.game.players.length as PlayerCount));

    case 'animationEnd':
      return state.animating ? { ...state, animating: null } : state;

    case 'tap': {
      const { game } = state;
      if (game.status !== 'playing' || state.animating) return state;

      const move = state.moves.find((m) => sameCell(destinationOf(m), action.cell));
      if (move) {
        return {
          game: applyMove(game, move),
          selected: null,
          moves: [],
          animating: { move, player: game.currentPlayer, turn: game.turn + 1 },
        };
      }

      const tappedOwnPiece = pieceAt(game, action.cell) === game.currentPlayer;
      const tappedSelected = state.selected !== null && cellKey(state.selected) === cellKey(action.cell);
      if (tappedOwnPiece && !tappedSelected) {
        return { ...state, selected: action.cell, moves: getLegalMoves(game, action.cell) };
      }
      return state.selected ? { ...state, selected: null, moves: [] } : state;
    }
  }
}
