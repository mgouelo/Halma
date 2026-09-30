// Intelligence artificielle hors ligne, en TypeScript pur.
//
// Trois niveaux :
// - facile : coup tiré au hasard, pondéré pour préférer ceux qui avancent ;
// - moyen : meilleur coup immédiat selon la distance à l'objectif ;
// - difficile : minimax avec élagage alpha-bêta (variante « paranoïaque » à
//   plusieurs joueurs : tous les adversaires jouent contre l'IA), profondeur
//   limitée, approfondissement itératif et limite de temps.
//
// La recherche est un générateur qui rend la main régulièrement :
// `chooseMoveAsync` la découpe en tranches courtes entre lesquelles
// l'interface peut se rafraîchir, et s'arrête à la limite de temps.

import { cornerCells, hexDistance, parseCellKey, sameCell } from './board.ts';
import { applyMove, getAllLegalMoves } from './game.ts';
import type { Cell, Corner, GameState, Move, PlayerId } from './types.ts';

export type AiLevel = 'easy' | 'medium' | 'hard';

export const AI_LEVELS: readonly AiLevel[] = ['easy', 'medium', 'hard'];

export interface AiOptions {
  /** Temps de réflexion maximal, en millisecondes (niveau difficile). Défaut : `DEFAULT_TIME_LIMIT_MS`. */
  timeLimitMs?: number;
  /** Profondeur maximale de recherche, en coups (niveau difficile). Défaut : 5. */
  maxDepth?: number;
  /** Générateur aléatoire dans [0, 1[ (pour des tests reproductibles). Défaut : `Math.random`. */
  random?: () => number;
  /** Horloge en millisecondes. Défaut : `Date.now`. */
  now?: () => number;
}

export const DEFAULT_TIME_LIMIT_MS = 800;
const DEFAULT_MAX_DEPTH = 5;
/** Nombre de coups gardés à chaque nœud de la recherche (les plus prometteurs). */
const BEAM_WIDTH = 8;
const ROOT_BEAM_WIDTH = 16;
/** Nombre de nœuds visités entre deux passages de main. */
const NODES_PER_YIELD = 32;
/** Durée d'une tranche de calcul avant de rendre la main à l'interface (ms). */
const SLICE_MS = 12;
const WIN_SCORE = 1_000_000;

// --- Heuristique -----------------------------------------------------------

const ORIGIN: Cell = { q: 0, r: 0 };

/** Pointe de chaque branche (la case la plus éloignée du centre). */
const APEX: readonly Cell[] = ([0, 1, 2, 3, 4, 5] as const).map((corner) =>
  cornerCells(corner).reduce((a, b) => (hexDistance(a, ORIGIN) >= hexDistance(b, ORIGIN) ? a : b)),
);

/** Distance d'une case à la pointe de la branche visée. */
function distanceToGoal(cell: Cell, target: Corner): number {
  return hexDistance(cell, APEX[target]);
}

/**
 * Coût d'un joueur : somme des distances de ses pions à la pointe de sa
 * branche d'arrivée, plus un terme pour le pion le plus en retard (pour ne pas
 * l'oublier en fin de partie). Il est minimal quand la branche est remplie :
 * ses 10 cases sont exactement les 10 cases les plus proches de la pointe.
 */
export function playerCost(state: GameState, player: PlayerId): number {
  const target = state.players[player].target;
  let sum = 0;
  let max = 0;
  for (const key in state.board) {
    if (state.board[key] !== player) continue;
    const d = distanceToGoal(parseCellKey(key), target);
    sum += d;
    if (d > max) max = d;
  }
  return sum + 0.5 * max;
}

/** Avancée d'un coup pour le joueur qui le joue (positive si le pion se rapproche). */
export function moveProgress(state: GameState, move: Move, player: PlayerId = state.currentPlayer): number {
  const target = state.players[player].target;
  const to = move.path[move.path.length - 1];
  return distanceToGoal(move.from, target) - distanceToGoal(to, target);
}

/** Évaluation d'une position du point de vue de `me` (plus c'est grand, mieux c'est). */
export function evaluate(state: GameState, me: PlayerId): number {
  if (state.winner !== null) return state.winner === me ? WIN_SCORE : -WIN_SCORE;
  const opponents = state.players.filter((p) => p.id !== me);
  const opponentsCost = opponents.reduce((sum, p) => sum + playerCost(state, p.id), 0) / opponents.length;
  return opponentsCost - playerCost(state, me);
}

// --- Niveaux ---------------------------------------------------------------

/** Vrai si le coup annule exactement le dernier coup du même joueur (évite les allers-retours). */
function undoesLastMove(state: GameState, move: Move, player: PlayerId): boolean {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const entry = state.history[i];
    if (entry.player !== player) continue;
    const last = entry.move;
    return sameCell(move.from, last.path[last.path.length - 1]) && sameCell(move.path[move.path.length - 1], last.from);
  }
  return false;
}

function pickWeighted<T>(items: T[], weights: number[], random: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = random() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x < 0) return items[i];
  }
  return items[items.length - 1];
}

function chooseEasy(state: GameState, moves: Move[], random: () => number): Move {
  // Surtout du hasard, mais un coup qui avance de 2 cases est ~3 fois plus probable qu'un pas de côté.
  const weights = moves.map((m) => Math.exp(0.55 * Math.max(-4, Math.min(6, moveProgress(state, m)))));
  return pickWeighted(moves, weights, random);
}

function chooseMedium(state: GameState, moves: Move[], random: () => number): Move {
  const me = state.currentPlayer;
  let best: Move[] = [];
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = applyMove(state, move);
    if (next.winner === me) return move;
    // Avancée d'abord ; à égalité, faire bouger le pion le plus en retard ; éviter les allers-retours.
    const straggler = distanceToGoal(move.from, state.players[me].target) / 100;
    const score = moveProgress(state, move) + straggler - (undoesLastMove(state, move, me) ? 5 : 0);
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = [move];
    } else if (Math.abs(score - bestScore) <= 1e-9) {
      best.push(move);
    }
  }
  return best[Math.floor(random() * best.length)];
}

class SearchTimeout extends Error {}

interface SearchContext {
  me: PlayerId;
  deadline: number;
  now: () => number;
  random: () => number;
  nodes: number;
}

/** Coups triés du plus prometteur au moins prometteur pour le joueur courant, tronqués à `width`. */
function orderedMoves(state: GameState, width: number, random: () => number): Move[] {
  const player = state.currentPlayer;
  return getAllLegalMoves(state, player)
    .map((move) => ({ move, key: moveProgress(state, move, player) + random() * 0.01 }))
    .sort((a, b) => b.key - a.key)
    .slice(0, width)
    .map((entry) => entry.move);
}

/** Coups de `player` dans `state` (même si ce n'est pas son tour), triés et tronqués. */
function orderedMovesOf(state: GameState, player: PlayerId, width: number, random: () => number): Move[] {
  return orderedMoves({ ...state, currentPlayer: player }, width, random);
}

/** Joue `move` pour `player`, puis rend la main à `nextPlayer` (recherche uniquement). */
function playAs(state: GameState, player: PlayerId, move: Move, nextPlayer: PlayerId): GameState {
  const next = applyMove({ ...state, currentPlayer: player }, move);
  return next.status === 'playing' ? { ...next, currentPlayer: nextPlayer } : next;
}

/**
 * Minimax alpha-bêta en « meilleure réponse » (Best-Reply Search) : les niveaux
 * alternent entre un coup de l'IA (max) et UNE réponse adverse (min), choisie
 * parmi les coups de tous les adversaires (les autres passent). À deux joueurs,
 * c'est exactement le minimax classique ; à plus, cela évite l'hypothèse trop
 * pessimiste où tous les adversaires jouent l'un après l'autre contre l'IA.
 */
function* alphaBeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  ctx: SearchContext,
): Generator<void, number> {
  ctx.nodes++;
  if (ctx.nodes % NODES_PER_YIELD === 0) {
    if (ctx.now() >= ctx.deadline) throw new SearchTimeout();
    yield;
  }
  if (depth === 0 || state.status !== 'playing') {
    const score = evaluate(state, ctx.me);
    // Une victoire (ou une défaite) plus proche compte plus qu'une lointaine.
    return state.winner === null ? score : score + Math.sign(score) * depth;
  }

  const opponents = state.players.filter((p) => p.id !== ctx.me).map((p) => p.id);
  const children: [PlayerId, Move][] = maximizing
    ? orderedMovesOf(state, ctx.me, BEAM_WIDTH, ctx.random).map((m): [PlayerId, Move] => [ctx.me, m])
    : opponents.flatMap((opp) =>
        orderedMovesOf(state, opp, Math.max(2, Math.ceil(BEAM_WIDTH / opponents.length)), ctx.random).map(
          (m): [PlayerId, Move] => [opp, m],
        ),
      );
  if (children.length === 0) return yield* alphaBeta(state, depth - 1, alpha, beta, !maximizing, ctx);

  let value = maximizing ? -Infinity : Infinity;
  for (const [player, move] of children) {
    const next = playAs(state, player, move, maximizing ? opponents[0] : ctx.me);
    const score = yield* alphaBeta(next, depth - 1, alpha, beta, !maximizing, ctx);
    if (maximizing) {
      value = Math.max(value, score);
      alpha = Math.max(alpha, value);
    } else {
      value = Math.min(value, score);
      beta = Math.min(beta, value);
    }
    if (alpha >= beta) break;
  }
  return value;
}

function* searchHard(state: GameState, options: AiOptions): Generator<void, Move> {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const ctx: SearchContext = {
    me: state.currentPlayer,
    deadline: now() + (options.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS),
    now,
    random,
    nodes: 0,
  };
  // L'historique ne sert pas à la recherche : on l'enlève pour éviter de le recopier à chaque coup.
  const root: GameState = { ...state, history: [] };
  const rootMoves = orderedMoves(root, ROOT_BEAM_WIDTH, random);
  let best = rootMoves[0];

  for (let depth = 1; depth <= (options.maxDepth ?? DEFAULT_MAX_DEPTH); depth++) {
    let depthBest = best;
    let bestScore = -Infinity;
    try {
      // On commence par le meilleur coup de la profondeur précédente : meilleur élagage.
      const ordered = [best, ...rootMoves.filter((m) => m !== best)];
      for (const move of ordered) {
        const next = playAs(root, ctx.me, move, ctx.me);
        const score = yield* alphaBeta(next, depth - 1, bestScore, Infinity, false, ctx);
        const adjusted = score - (undoesLastMove(state, move, ctx.me) ? 3 : 0);
        if (adjusted > bestScore) {
          bestScore = adjusted;
          depthBest = move;
        }
      }
    } catch (error) {
      if (error instanceof SearchTimeout) break; // profondeur inachevée : on garde la précédente
      throw error;
    }
    best = depthBest;
    if (bestScore >= WIN_SCORE) break; // victoire assurée, inutile de chercher plus loin
  }
  return best;
}

/**
 * Recherche du coup, sous forme de générateur qui rend la main régulièrement.
 * Renvoie null si la partie est finie ou si le joueur courant ne peut pas jouer.
 */
export function* searchMove(state: GameState, level: AiLevel, options: AiOptions = {}): Generator<void, Move | null> {
  if (state.status !== 'playing') return null;
  const moves = getAllLegalMoves(state, state.currentPlayer);
  if (moves.length === 0) return null;
  const random = options.random ?? Math.random;
  switch (level) {
    case 'easy':
      return chooseEasy(state, moves, random);
    case 'medium':
      return chooseMedium(state, moves, random);
    case 'hard':
      return yield* searchHard(state, options);
  }
}

/** Choisit un coup pour le joueur courant, d'un seul tenant (serveur, tests). */
export function chooseMove(state: GameState, level: AiLevel, options: AiOptions = {}): Move | null {
  const search = searchMove(state, level, options);
  for (;;) {
    const step = search.next();
    if (step.done) return step.value;
  }
}

/**
 * Choisit un coup sans bloquer l'interface : le calcul est découpé en tranches
 * de quelques millisecondes séparées par un `setTimeout(0)`, et le niveau
 * difficile s'arrête à `timeLimitMs`. Rejette avec une `AbortError` si `signal` est annulé.
 */
export async function chooseMoveAsync(
  state: GameState,
  level: AiLevel,
  options: AiOptions & { signal?: AbortSignal } = {},
): Promise<Move | null> {
  const now = options.now ?? Date.now;
  const search = searchMove(state, level, options);
  for (;;) {
    const sliceEnd = now() + SLICE_MS;
    let step = search.next();
    while (!step.done && now() < sliceEnd) step = search.next();
    if (step.done) return step.value;
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (options.signal?.aborted) {
      const error = new Error('Recherche annulée');
      error.name = 'AbortError';
      throw error;
    }
  }
}
