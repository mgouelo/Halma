// Création d'une partie, coups légaux, application d'un coup, tour et victoire.
// Toutes les fonctions sont pures : elles ne modifient jamais l'état reçu.

import {
  addCells,
  cellKey,
  cornerCells,
  DIRECTIONS,
  isOnBoard,
  oppositeCorner,
  parseCellKey,
  sameCell,
} from './board.ts';
import type {
  Cell,
  CellKey,
  Corner,
  GameRules,
  GameState,
  Move,
  MoveValidation,
  Player,
  PlayerCount,
  PlayerId,
} from './types.ts';

/**
 * Branches de départ selon le nombre de joueurs, dans l'ordre du tour
 * (sens horaire). Le joueur 0 est en bas quand c'est possible.
 * - 2 joueurs : bas contre haut ;
 * - 3 joueurs : une branche sur deux, chacun vise une branche vide ;
 * - 4 joueurs : deux paires face à face, les branches haut et bas restent vides ;
 * - 5 joueurs : toutes les branches sauf la bas-droite (2), qui reste vide ;
 *   le joueur parti du haut-gauche (5) vise donc une branche vide ;
 * - 6 joueurs : toutes les branches.
 */
export const STARTING_CORNERS: Record<PlayerCount, readonly Corner[]> = {
  2: [3, 0],
  3: [3, 5, 1],
  4: [4, 5, 1, 2],
  5: [3, 4, 5, 0, 1],
  6: [3, 4, 5, 0, 1, 2],
};

export class IllegalMoveError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'IllegalMoveError';
  }
}

export function isPlayerCount(n: number): n is PlayerCount {
  return Number.isInteger(n) && n >= 2 && n <= 6;
}

export const DEFAULT_RULES: GameRules = {
  antiBlocking: true,
};

/** Crée une partie avec les placements de départ standard. */
export function createGame(playerCount: PlayerCount, rules: Partial<GameRules> = {}): GameState {
  if (!isPlayerCount(playerCount)) {
    throw new Error(`Nombre de joueurs invalide : ${playerCount} (de 2 à 6 attendu)`);
  }
  const players: Player[] = STARTING_CORNERS[playerCount].map((home, id) => ({
    id,
    home,
    target: oppositeCorner(home),
  }));
  const board: Record<CellKey, PlayerId> = {};
  for (const player of players) {
    for (const cell of cornerCells(player.home)) {
      board[cellKey(cell)] = player.id;
    }
  }
  return {
    rules: { ...DEFAULT_RULES, ...rules },
    players,
    board,
    currentPlayer: 0,
    turn: 0,
    status: 'playing',
    winner: null,
    history: [],
  };
}

/** Joueur qui occupe la case, ou null si elle est vide. */
export function pieceAt(state: GameState, cell: Cell): PlayerId | null {
  const owner = state.board[cellKey(cell)];
  return owner === undefined ? null : owner;
}

/** Cases occupées par les pions d'un joueur. */
export function piecesOf(state: GameState, player: PlayerId): Cell[] {
  return Object.keys(state.board)
    .filter((key) => state.board[key] === player)
    .map(parseCellKey);
}

/**
 * Case vide pour le pion en mouvement : sa case de départ compte comme libre
 * dès qu'il l'a quittée.
 */
function isFreeFor(state: GameState, cell: Cell, origin: Cell): boolean {
  return isOnBoard(cell) && (sameCell(cell, origin) || pieceAt(state, cell) === null);
}

function isOccupiedFor(state: GameState, cell: Cell, origin: Cell): boolean {
  return isOnBoard(cell) && !sameCell(cell, origin) && pieceAt(state, cell) !== null;
}

/**
 * Tous les coups légaux du pion situé en `from`, un par destination, avec le
 * chemin complet. Les pas simples viennent en premier ; pour une destination
 * atteinte par sauts, le chemin renvoyé est le plus court.
 * Ne vérifie ni le tour ni le propriétaire du pion (voir `validateMove`).
 */
export function getLegalMoves(state: GameState, from: Cell): Move[] {
  if (pieceAt(state, from) === null) return [];

  const moves: Move[] = [];
  for (const d of DIRECTIONS) {
    const to = addCells(from, d);
    if (isOnBoard(to) && pieceAt(state, to) === null) moves.push({ from, path: [to] });
  }

  // Parcours en largeur des sauts enchaînés : chaque case d'arrivée n'est
  // visitée qu'une fois (pas de boucle) et reçoit le chemin le plus court.
  // Une case d'arrivée de saut est toujours à distance paire du départ, elle
  // ne peut donc jamais coïncider avec un pas simple.
  const visited = new Set<CellKey>([cellKey(from)]);
  const queue: Cell[][] = [[]];
  while (queue.length > 0) {
    const path = queue.shift()!;
    const at = path.length > 0 ? path[path.length - 1] : from;
    for (const d of DIRECTIONS) {
      const over = addCells(at, d);
      const to = addCells(over, d);
      const key = cellKey(to);
      if (visited.has(key)) continue;
      if (!isOccupiedFor(state, over, from) || !isFreeFor(state, to, from)) continue;
      visited.add(key);
      const next = [...path, to];
      queue.push(next);
      moves.push({ from, path: next });
    }
  }
  return moves;
}

/** Tous les coups légaux d'un joueur, pion par pion. */
export function getAllLegalMoves(state: GameState, player: PlayerId): Move[] {
  return piecesOf(state, player).flatMap((cell) => getLegalMoves(state, cell));
}

export function hasAnyLegalMove(state: GameState, player: PlayerId): boolean {
  return piecesOf(state, player).some((cell) => getLegalMoves(state, cell).length > 0);
}

function isCell(value: unknown): value is Cell {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isInteger((value as Cell).q) &&
    Number.isInteger((value as Cell).r)
  );
}

/**
 * Vérifie qu'un coup est jouable par le joueur dont c'est le tour. Accepte
 * n'importe quel chemin valide, pas seulement celui renvoyé par `getLegalMoves`
 * (utile pour valider un coup reçu d'un client).
 */
export function validateMove(state: GameState, move: Move): MoveValidation {
  if (state.status !== 'playing') return { ok: false, reason: 'La partie est terminée' };
  if (!move || !isCell(move.from) || !Array.isArray(move.path) || !move.path.every(isCell)) {
    return { ok: false, reason: 'Coup mal formé' };
  }
  const { from, path } = move;
  if (!isOnBoard(from) || !path.every(isOnBoard)) {
    return { ok: false, reason: 'Case hors du plateau' };
  }
  const owner = pieceAt(state, from);
  if (owner === null) return { ok: false, reason: 'Aucun pion sur la case de départ' };
  if (owner !== state.currentPlayer) return { ok: false, reason: "Ce pion n'est pas au joueur dont c'est le tour" };
  if (path.length === 0) return { ok: false, reason: 'Chemin vide' };

  const first = path[0];
  const isStep = DIRECTIONS.some((d) => sameCell(addCells(from, d), first));
  if (isStep) {
    if (path.length > 1) return { ok: false, reason: 'Un pas simple ne peut pas être suivi d’un autre déplacement' };
    if (pieceAt(state, first) !== null) return { ok: false, reason: 'Case de destination occupée' };
    return { ok: true };
  }

  const visited = new Set<CellKey>([cellKey(from)]);
  let at = from;
  for (const to of path) {
    const d = DIRECTIONS.find((dir) => sameCell(addCells(addCells(at, dir), dir), to));
    if (!d) return { ok: false, reason: 'Saut invalide : la case d’arrivée doit être à deux cases en ligne droite' };
    if (!isOccupiedFor(state, addCells(at, d), from)) return { ok: false, reason: 'Saut invalide : aucun pion à sauter' };
    if (!isFreeFor(state, to, from)) return { ok: false, reason: 'Saut invalide : case d’arrivée occupée' };
    const key = cellKey(to);
    if (visited.has(key)) return { ok: false, reason: 'Un saut enchaîné ne peut pas repasser par la même case' };
    visited.add(key);
    at = to;
  }
  return { ok: true };
}

/**
 * Vrai si le joueur a rempli sa branche d'arrivée : ses 10 cases sont à lui,
 * ou, avec la règle anti-blocage, elles sont toutes occupées et au moins une
 * l'est par un de ses pions (des pions adverses qui ne bougent pas ne peuvent
 * donc pas l'empêcher de gagner).
 */
export function hasWon(state: GameState, player: PlayerId): boolean {
  const target = state.players[player]?.target;
  if (target === undefined) return false;
  const owners = cornerCells(target).map((cell) => pieceAt(state, cell));
  if (state.rules.antiBlocking) {
    return owners.every((owner) => owner !== null) && owners.includes(player);
  }
  return owners.every((owner) => owner === player);
}

/**
 * Applique un coup et renvoie le nouvel état (l'état reçu n'est pas modifié).
 * Lève `IllegalMoveError` si le coup est illégal.
 *
 * Après le coup : si le joueur a rempli sa branche d'arrivée, il gagne et la
 * partie s'arrête. Avec la règle anti-blocage, un coup peut aussi faire gagner
 * un autre joueur, en complétant sa branche d'arrivée (un coup ne remplit
 * qu'une case, donc un seul joueur peut gagner à la fois). Sinon la main passe
 * au joueur suivant ; un joueur sans aucun coup possible est sauté.
 */
export function applyMove(state: GameState, move: Move): GameState {
  const validation = validateMove(state, move);
  if (!validation.ok) throw new IllegalMoveError(validation.reason);

  const player = state.currentPlayer;
  const destination = move.path[move.path.length - 1];
  const board = { ...state.board };
  delete board[cellKey(move.from)];
  board[cellKey(destination)] = player;

  const recorded: Move = {
    from: { q: move.from.q, r: move.from.r },
    path: move.path.map((c) => ({ q: c.q, r: c.r })),
  };
  const next: GameState = {
    ...state,
    board,
    turn: state.turn + 1,
    history: [...state.history, { player, move: recorded }],
  };

  const count = state.players.length;
  for (let i = 0; i < count; i++) {
    const candidate = (player + i) % count;
    if (hasWon(next, candidate)) return { ...next, status: 'finished', winner: candidate };
  }

  // Le joueur qui vient de jouer peut toujours annuler son coup (le chemin
  // inverse reste libre), donc la boucle trouve au pire lui-même.
  let candidate = player;
  for (let i = 1; i <= count; i++) {
    candidate = (player + i) % count;
    if (hasAnyLegalMove(next, candidate)) break;
  }
  return { ...next, currentPlayer: candidate };
}
