// Types du moteur de règles. Tout ce qui compose l'état d'une partie est
// sérialisable en JSON (objets, tableaux, nombres, chaînes, null).

/** Case du plateau en coordonnées axiales (la 3e coordonnée cubique vaut s = -q - r). */
export interface Cell {
  q: number;
  r: number;
}

/** Clé texte d'une case, au format "q,r" (ex. "-4,8"). */
export type CellKey = string;

/**
 * Branche de l'étoile, numérotée dans le sens horaire en partant du haut
 * (disposition « pointe en haut ») :
 * 0 haut, 1 haut-droite, 2 bas-droite, 3 bas, 4 bas-gauche, 5 haut-gauche.
 * La branche opposée à `c` est `(c + 3) % 6`.
 */
export type Corner = 0 | 1 | 2 | 3 | 4 | 5;

/** Nombre de joueurs possibles. */
export type PlayerCount = 2 | 3 | 4 | 6;

/** Indice du joueur dans `GameState.players`. */
export type PlayerId = number;

export interface Player {
  id: PlayerId;
  /** Branche de départ. */
  home: Corner;
  /** Branche à remplir pour gagner (la branche opposée). */
  target: Corner;
}

/**
 * Un coup : le pion part de `from` et passe successivement par chaque case
 * de `path`. La dernière case de `path` est la destination.
 * - pas simple : `path` contient une seule case adjacente ;
 * - saut(s) : chaque case de `path` est à deux cases de la précédente,
 *   au-delà d'un pion.
 */
export interface Move {
  from: Cell;
  path: Cell[];
}

export type GameStatus = 'playing' | 'finished';

/** Variantes de règles, fixées à la création de la partie. */
export interface GameRules {
  /**
   * Règle anti-blocage : un joueur gagne aussi quand sa branche d'arrivée est
   * pleine et contient au moins un de ses pions, même si des pions adverses
   * y restent. Sans elle, il faut que les 10 cases soient à lui.
   */
  antiBlocking: boolean;
}

export interface GameState {
  rules: GameRules;
  players: Player[];
  /** Cases occupées : clé "q,r" → joueur propriétaire du pion. */
  board: Record<CellKey, PlayerId>;
  /** Joueur dont c'est le tour. */
  currentPlayer: PlayerId;
  /** Nombre de coups joués depuis le début. */
  turn: number;
  status: GameStatus;
  /** Vainqueur, ou null tant que la partie continue. */
  winner: PlayerId | null;
  /** Historique des coups, dans l'ordre. */
  history: HistoryEntry[];
}

export interface HistoryEntry {
  player: PlayerId;
  move: Move;
}

export type MoveValidation = { ok: true } | { ok: false; reason: string };
