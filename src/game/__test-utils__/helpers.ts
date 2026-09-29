import { cellKey, createGame, type Cell, type GameState, type PlayerCount, type PlayerId } from '..';

export const c = (q: number, r: number): Cell => ({ q, r });

/** Partie à `playerCount` joueurs avec uniquement les pions donnés : [q, r, joueur]. */
export function stateWith(
  pieces: [number, number, PlayerId][],
  options: { playerCount?: PlayerCount; currentPlayer?: PlayerId } = {},
): GameState {
  const base = createGame(options.playerCount ?? 2);
  const board: GameState['board'] = {};
  for (const [q, r, player] of pieces) board[cellKey({ q, r })] = player;
  return { ...base, board, currentPlayer: options.currentPlayer ?? 0 };
}

export const destinations = (moves: { path: Cell[] }[]): string[] =>
  moves.map((m) => cellKey(m.path[m.path.length - 1])).sort();

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
