// Mutateurs de partie : options d'interface activables ou non. Ils ne changent
// ni le moteur (`src/game/`) ni la validation des coups par le serveur : ils
// décident seulement de ce que l'écran montre et des touches qu'il accepte.
// En ligne, ils ne sont donc pas vérifiés côté serveur.

import { cellKey, getLegalMoves, pieceAt, sameCell, type Cell, type GameState, type Move, type PlayerId } from '@/game';

export interface Mutators {
  /** « Toucher c'est jouer » : un pion qui peut bouger, une fois touché, doit être joué. */
  touchMove: boolean;
  /** « Clairvoyance » : les cases où le pion sélectionné peut aller sont affichées en pointillés. */
  clairvoyance: boolean;
}

export type MutatorKey = keyof Mutators;

export const MUTATOR_KEYS: readonly MutatorKey[] = ['touchMove', 'clairvoyance'];

export const DEFAULT_MUTATORS: Mutators = { touchMove: false, clairvoyance: true };

/** Nom et explication de chaque mutateur, affichés sur les écrans de réglage et la salle d'attente. */
export const MUTATOR_TEXTS: Record<MutatorKey, { label: string; description: string }> = {
  touchMove: {
    label: 'Toucher c’est jouer',
    description: 'Un pion touché qui peut bouger doit être joué : impossible d’en changer ou d’annuler.',
  },
  clairvoyance: {
    label: 'Clairvoyance',
    description: 'Les cases où le pion choisi peut aller sont affichées en pointillés.',
  },
};

// --- Paramètres d'URL (parties locales) -----------------------------------

/** Nom du paramètre d'URL de chaque mutateur (`/game?touch=1&clairvoyance=0`). */
export const MUTATOR_PARAMS: Record<MutatorKey, string> = { touchMove: 'touch', clairvoyance: 'clairvoyance' };

const TRUE_VALUES = new Set(['1', 'true', 'on', 'yes', 'oui']);
const FALSE_VALUES = new Set(['0', 'false', 'off', 'no', 'non']);

function parseFlag(param: string | string[] | undefined, fallback: boolean): boolean {
  const raw = Array.isArray(param) ? param[0] : param;
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim().toLowerCase();
  if (TRUE_VALUES.has(value)) return true;
  if (FALSE_VALUES.has(value)) return false;
  return fallback;
}

/** Mutateurs lus dans les paramètres de l'URL ; une valeur absente ou invalide garde la valeur par défaut. */
export function parseMutatorParams(params: Partial<Record<string, string | string[] | undefined>>): Mutators {
  return {
    touchMove: parseFlag(params[MUTATOR_PARAMS.touchMove], DEFAULT_MUTATORS.touchMove),
    clairvoyance: parseFlag(params[MUTATOR_PARAMS.clairvoyance], DEFAULT_MUTATORS.clairvoyance),
  };
}

/** Paramètres d'URL des mutateurs, pour l'écran de jeu. */
export function serializeMutators(mutators: Mutators): Record<string, string> {
  return {
    [MUTATOR_PARAMS.touchMove]: mutators.touchMove ? '1' : '0',
    [MUTATOR_PARAMS.clairvoyance]: mutators.clairvoyance ? '1' : '0',
  };
}

// --- Réglages d'une room (colonne jsonb `rooms.settings`) ------------------

/** Clé de chaque mutateur dans `rooms.settings` (voir la migration `room_settings`). */
export const SETTINGS_KEYS: Record<MutatorKey, string> = { touchMove: 'touch_move', clairvoyance: 'clairvoyance' };

/**
 * Mutateurs d'une room à partir de sa colonne `settings`. La base valide déjà
 * la forme ; une valeur absente ou d'un autre type garde la valeur par défaut
 * (room créée avant la migration, par exemple).
 */
export function mutatorsFromSettings(settings: unknown): Mutators {
  const record = settings !== null && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
  const read = (key: MutatorKey) => {
    const value = record[SETTINGS_KEYS[key]];
    return typeof value === 'boolean' ? value : DEFAULT_MUTATORS[key];
  };
  return { touchMove: read('touchMove'), clairvoyance: read('clairvoyance') };
}

/** Valeur à envoyer à `set_room_settings` pour changer des mutateurs. */
export function settingsFromMutators(mutators: Partial<Mutators>): Record<string, boolean> {
  const settings: Record<string, boolean> = {};
  for (const key of MUTATOR_KEYS) {
    const value = mutators[key];
    if (typeof value === 'boolean') settings[SETTINGS_KEYS[key]] = value;
  }
  return settings;
}

/** Mutateurs actifs, dans l'ordre d'affichage (badges pendant la partie). */
export function activeMutators(mutators: Mutators): MutatorKey[] {
  return MUTATOR_KEYS.filter((key) => mutators[key]);
}

// --- Touche sur le plateau ------------------------------------------------

/** Retour discret après une touche refusée : case illégale, ou autre pion alors que « Toucher c'est jouer » verrouille. */
export type TapNotice = 'illegal' | 'locked';

export type TapOutcome =
  | { kind: 'play'; move: Move }
  | { kind: 'select'; selected: Cell; moves: Move[] }
  | { kind: 'clear' }
  | { kind: 'ignore'; notice: TapNotice | null };

interface TapInput {
  game: GameState;
  /** Joueur qui touche (celui dont c'est le tour). */
  player: PlayerId;
  selected: Cell | null;
  /** Coups légaux du pion sélectionné, calculés par le moteur (affichés ou non). */
  moves: readonly Move[];
  cell: Cell;
  mutators: Mutators;
}

/** Vrai quand « Toucher c'est jouer » oblige à jouer le pion sélectionné (il peut bouger). */
export function isSelectionLocked(mutators: Mutators, selected: Cell | null, moves: readonly Move[]): boolean {
  return mutators.touchMove && selected !== null && moves.length > 0;
}

/**
 * Effet d'une touche du joueur dont c'est le tour, partagé par les parties
 * locales et en ligne. Les coups viennent toujours du moteur : un coup n'est
 * joué que s'il fait partie des coups légaux du pion sélectionné.
 * - « Toucher c'est jouer » : un pion sélectionné qui peut bouger ne se change
 *   ni ne s'annule ; un pion bloqué ne verrouille rien.
 * - Sans « Clairvoyance » : une touche sur une case où le pion ne peut pas aller
 *   garde la sélection et donne un retour discret, sans montrer les bonnes cases.
 */
export function resolveTap({ game, player, selected, moves, cell, mutators }: TapInput): TapOutcome {
  const move = moves.find((m) => sameCell(m.path[m.path.length - 1], cell));
  if (move) return { kind: 'play', move };

  const locked = isSelectionLocked(mutators, selected, moves);
  const tappedOwnPiece = pieceAt(game, cell) === player;
  const tappedSelected = selected !== null && cellKey(selected) === cellKey(cell);

  if (locked) {
    if (tappedSelected) return { kind: 'ignore', notice: null };
    return { kind: 'ignore', notice: tappedOwnPiece ? 'locked' : 'illegal' };
  }
  if (tappedOwnPiece && !tappedSelected) {
    return { kind: 'select', selected: cell, moves: getLegalMoves(game, cell) };
  }
  if (selected === null) return { kind: 'ignore', notice: null };
  // Case vide ou adverse avec un pion qui peut bouger, cases cachées : on ne joue rien et on garde la sélection.
  if (!tappedSelected && !mutators.clairvoyance && moves.length > 0) return { kind: 'ignore', notice: 'illegal' };
  return { kind: 'clear' };
}

/** Message du retour discret, à la place de la consigne du tour. */
export const TAP_NOTICE_TEXTS: Record<TapNotice, string> = {
  illegal: 'Ce pion ne peut pas aller là.',
  locked: 'Toucher c’est jouer : joue le pion choisi.',
};

/**
 * Consigne pendant son tour : retour discret d'une touche refusée, sinon ce
 * qu'il faut toucher. Sans « Clairvoyance », elle ne parle pas des pointillés.
 */
export function selectionHint(options: {
  selected: Cell | null;
  moves: readonly Move[];
  notice: TapNotice | null;
  mutators: Mutators;
  /** Consigne sans pion sélectionné. */
  idle: string;
}): string {
  const { selected, moves, notice, mutators, idle } = options;
  if (notice) return TAP_NOTICE_TEXTS[notice];
  if (!selected) return idle;
  if (moves.length === 0) return 'Ce pion ne peut pas bouger.';
  return mutators.clairvoyance ? 'Touche une case en pointillés pour jouer.' : 'Touche la case où aller.';
}
