// État d'interface d'une partie locale : sélection, cases atteignables,
// coup en cours d'animation, joueurs humains ou IA. Les règles viennent toutes
// du moteur (`@/game`) : ce réducteur ne fait que l'interroger et lui
// transmettre les coups.

import {
  applyMove,
  createGame,
  isPlayerCount,
  type AiLevel,
  type Cell,
  type GameState,
  type Move,
  type PlayerId,
} from '@/game';
import { DEFAULT_MUTATORS, resolveTap, type Mutators, type TapNotice } from '@/mutators/mutators';

/** Qui joue chaque place : un humain sur l'appareil, ou une IA d'un niveau donné. */
export type Controller = 'human' | AiLevel;

export interface LocalGameState {
  game: GameState;
  /** Contrôleur de chaque joueur, dans l'ordre des identifiants du moteur. */
  controllers: Controller[];
  /** Pion sélectionné par le joueur dont c'est le tour. */
  selected: Cell | null;
  /** Coups légaux du pion sélectionné (un par destination). */
  moves: Move[];
  /** Dernier coup joué, tant que son animation n'est pas terminée. */
  animating: { move: Move; player: PlayerId; turn: number } | null;
  /** Mutateurs de la partie (options d'interface, voir `src/mutators/`). */
  mutators: Mutators;
  /** Retour discret après une touche refusée, effacé à la touche suivante. */
  notice: TapNotice | null;
}

export type LocalGameAction =
  | { type: 'tap'; cell: Cell }
  /** Coup choisi par une IA pendant le tour `turn` (ignoré s'il arrive trop tard). */
  | { type: 'aiMove'; move: Move; turn: number }
  | { type: 'animationEnd' }
  | { type: 'reset' };

export const TWO_HUMANS: readonly Controller[] = ['human', 'human'];

export interface LocalGameSetup {
  controllers: readonly Controller[];
  mutators?: Mutators;
}

export function initLocalGame(setup: LocalGameSetup | readonly Controller[] = TWO_HUMANS): LocalGameState {
  const { controllers, mutators = DEFAULT_MUTATORS } = isControllerList(setup) ? { controllers: setup } : setup;
  const count = controllers.length;
  if (!isPlayerCount(count)) throw new Error(`Nombre de joueurs invalide : ${count}`);
  return {
    game: createGame(count),
    controllers: [...controllers],
    selected: null,
    moves: [],
    animating: null,
    mutators: { ...mutators },
    notice: null,
  };
}

function isControllerList(setup: LocalGameSetup | readonly Controller[]): setup is readonly Controller[] {
  return Array.isArray(setup);
}

/** Destination d'un coup (dernière case du chemin). */
export function destinationOf(move: Move): Cell {
  return move.path[move.path.length - 1];
}

/**
 * Vrai quand quitter ou recommencer ferait perdre quelque chose : au moins un
 * coup joué et partie pas encore terminée. Une partie locale n'est jamais
 * sauvegardée (elle ne vit que dans l'état de l'écran de jeu).
 */
export function isGameInProgress(game: GameState): boolean {
  return game.status === 'playing' && game.history.length > 0;
}

/** Contrôleur du joueur dont c'est le tour. */
export function currentController(state: LocalGameState): Controller {
  return state.controllers[state.game.currentPlayer];
}

/** Vrai quand c'est à une IA de jouer (partie en cours, animation terminée). */
export function isAiTurn(state: LocalGameState): boolean {
  return state.game.status === 'playing' && !state.animating && currentController(state) !== 'human';
}

function play(state: LocalGameState, move: Move): LocalGameState {
  const { game } = state;
  return {
    ...state,
    game: applyMove(game, move),
    selected: null,
    moves: [],
    animating: { move, player: game.currentPlayer, turn: game.turn + 1 },
    notice: null,
  };
}

export function localGameReducer(state: LocalGameState, action: LocalGameAction): LocalGameState {
  switch (action.type) {
    case 'reset':
      return initLocalGame({ controllers: state.controllers, mutators: state.mutators });

    case 'animationEnd':
      return state.animating ? { ...state, animating: null } : state;

    case 'aiMove':
      if (!isAiTurn(state) || action.turn !== state.game.turn) return state;
      return play(state, action.move);

    case 'tap': {
      const { game } = state;
      if (game.status !== 'playing' || state.animating || currentController(state) !== 'human') return state;

      const outcome = resolveTap({
        game,
        player: game.currentPlayer,
        selected: state.selected,
        moves: state.moves,
        cell: action.cell,
        mutators: state.mutators,
      });
      switch (outcome.kind) {
        case 'play':
          return play(state, outcome.move);
        case 'select':
          return { ...state, selected: outcome.selected, moves: outcome.moves, notice: null };
        case 'clear':
          return { ...state, selected: null, moves: [], notice: null };
        case 'ignore':
          return state.notice === outcome.notice ? state : { ...state, notice: outcome.notice };
      }
    }
  }
}
