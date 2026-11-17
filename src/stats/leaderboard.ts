// Classements : les trois tableaux, et la mise en forme des lignes renvoyées par
// la fonction SQL `get_leaderboards` (migration rating). Logique pure.

import { formatNumber, formatOrdinal, type Translator } from '@/i18n';

// Dans l'ordre des onglets ; « Points » est le classement par défaut. Les parties
// lancées et les victoires par niveau d'IA sont comptées mais n'ont pas de classement.
export const BOARDS = ['points', 'wins', 'best_streak'] as const;

export const DEFAULT_BOARD: Board = 'points';

export type Board = (typeof BOARDS)[number];

export interface BoardInfo {
  /** Titre complet, en tête du classement. */
  title: string;
  /** Libellé court de l'onglet. */
  tab: string;
  /** Ce qui est compté. */
  description: string;
}

/** Titre, onglet et explication d'un classement, dans la langue de `t`. */
export function boardInfo(t: Translator, board: Board): BoardInfo {
  switch (board) {
    case 'points':
      return { title: t('leaderboard.pointsTitle'), tab: t('leaderboard.pointsTab'), description: t('leaderboard.pointsText') };
    case 'wins':
      return { title: t('leaderboard.winsTitle'), tab: t('leaderboard.winsTab'), description: t('leaderboard.winsText') };
    case 'best_streak':
      return { title: t('leaderboard.streakTitle'), tab: t('leaderboard.streakTab'), description: t('leaderboard.streakText') };
  }
}

/**
 * Qui peut voir les classements : un compte e-mail. Un invité (connexion
 * anonyme) n'y figure pas et ne peut pas les consulter : l'écran l'invite à
 * créer son compte sans rien demander au serveur. Sans session : connexion.
 */
export type LeaderboardAccess = 'allowed' | 'guest' | 'signed_out';

export function leaderboardAccess(session: { isGuest: boolean } | null): LeaderboardAccess {
  if (!session) return 'signed_out';
  return session.isGuest ? 'guest' : 'allowed';
}

/** Texte d'une erreur de lecture des classements (codes courts de `get_leaderboards`). */
export function describeLeaderboardError(t: Translator, error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  if (message === 'guest_not_ranked') return t('error.leaderboard.guest_not_ranked');
  if (message === 'not_authenticated') return t('error.leaderboard.not_authenticated');
  return t('error.leaderboard.default');
}

/** Ligne telle que renvoyée par `get_leaderboards`. */
export interface LeaderboardRow {
  board: string;
  rank: number | null;
  pseudo: string;
  avatar: string | null;
  score: number;
  is_me: boolean;
  /** Identifiant du joueur (migration public_profile ; absent d'un serveur plus ancien). */
  user_id?: string | null;
}

export interface LeaderboardEntry {
  /** Null : le joueur n'a pas encore de score dans ce classement. */
  rank: number | null;
  pseudo: string;
  avatar: string | null;
  score: number;
  isMe: boolean;
  /** Identifiant du joueur, qui ouvre son profil ; null si le serveur ne l'envoie pas. */
  userId: string | null;
}

export interface BoardView {
  /** Les premiers, dans l'ordre (50 au plus), ligne du joueur comprise s'il en fait partie. */
  top: LeaderboardEntry[];
  /** Ligne du joueur quand il n'est pas dans `top` (plus loin, ou pas encore classé). */
  me: LeaderboardEntry | null;
}

/** Nombre de lignes affichées par classement (le serveur n'en renvoie pas plus). */
export const TOP_SIZE = 50;

/** Répartit les lignes du serveur par classement ; les lignes inattendues sont ignorées. */
export function groupLeaderboards(rows: readonly LeaderboardRow[]): Record<Board, BoardView> {
  const views = Object.fromEntries(BOARDS.map((b) => [b, { top: [], me: null }])) as unknown as Record<Board, BoardView>;
  for (const row of rows) {
    if (!(BOARDS as readonly string[]).includes(row.board)) continue;
    const view = views[row.board as Board];
    const entry: LeaderboardEntry = {
      rank: row.rank,
      pseudo: row.pseudo,
      avatar: row.avatar,
      score: row.score,
      isMe: row.is_me,
      userId: row.user_id ?? null,
    };
    if (entry.rank !== null && entry.rank <= TOP_SIZE) view.top.push(entry);
    else if (entry.isMe) view.me = entry;
  }
  for (const board of BOARDS) views[board].top.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  return views;
}

/** Unité d'un score, accordée : « victoire », « victoires », « jours », « points »… */
export function formatUnit(t: Translator, board: Board, score: number): string {
  switch (board) {
    case 'points':
      return t('leaderboard.unitPoints', { count: score });
    case 'best_streak':
      return t('leaderboard.unitDays', { count: score });
    default:
      return t('leaderboard.unitWins', { count: score });
  }
}

/** Valeur du score, écrite à la façon de la langue : un score négatif garde son signe (« -15 »). */
export function formatValue(t: Translator, score: number): string {
  const value = formatNumber(t.locale, Math.abs(score));
  return score < 0 ? `-${value}` : value;
}

/** Score avec son unité : « 1 victoire », « 12 victoires », « 3 jours », « -15 points ». */
export function formatScore(t: Translator, board: Board, score: number): string {
  return t('leaderboard.score', { value: formatValue(t, score), unit: formatUnit(t, board, score) });
}

/** Variation de points, toujours signée : « +27 points », « -15 points », « +1 point ». */
export function formatPointsDelta(t: Translator, delta: number): string {
  return t('leaderboard.delta', {
    sign: delta < 0 ? '-' : '+',
    value: formatNumber(t.locale, Math.abs(delta)),
    unit: t('leaderboard.unitPoints', { count: delta }),
  });
}

/** Rang écrit à la façon de la langue : « 1er », « 2e » ; « 1st » ; « 1. » ; « 1.º » ; « — » sans classement. */
export function formatRank(t: Translator, rank: number | null): string {
  if (rank === null) return t('common.dash');
  return formatOrdinal(t.language, rank);
}

/** Place sur le podium (1 à 3), ou null. */
export function podiumPlace(rank: number | null): 1 | 2 | 3 | null {
  return rank === 1 || rank === 2 || rank === 3 ? rank : null;
}

/** Rang lu par le lecteur d'écran : « 3e place », ou « pas encore classé ». */
export function rankSpoken(t: Translator, rank: number | null): string {
  return rank === null ? t('leaderboard.notRanked') : t('leaderboard.place', { rank: formatRank(t, rank) });
}

/** Texte lu par le lecteur d'écran pour une ligne. */
export function entryLabel(t: Translator, board: Board, entry: LeaderboardEntry): string {
  const who = entry.isMe ? t('leaderboard.meName', { name: entry.pseudo }) : entry.pseudo;
  return t('leaderboard.entry', { rank: rankSpoken(t, entry.rank), who, score: formatScore(t, board, entry.score) });
}

/** Position du joueur, dans le bloc « C'est toi » : « Tu es 12e », « Tu es 1er » ; null s'il n'est pas classé. */
export function myPositionLabel(t: Translator, rank: number | null): string | null {
  return rank === null ? null : t('leaderboard.myPosition', { rank: formatRank(t, rank) });
}
