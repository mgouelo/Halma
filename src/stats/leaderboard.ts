// Classements : les cinq tableaux, et la mise en forme des lignes renvoyées par
// la fonction SQL `get_leaderboards` (migration player_stats). Logique pure.

// Les parties lancées sont comptées (profil) mais ne font pas l'objet d'un classement.
export const BOARDS = ['wins', 'wins_easy', 'wins_medium', 'wins_hard', 'best_streak'] as const;

export type Board = (typeof BOARDS)[number];

export interface BoardInfo {
  /** Titre complet, en tête du classement. */
  title: string;
  /** Libellé court de l'onglet. */
  tab: string;
  /** Ce qui est compté. */
  description: string;
}

export const BOARD_INFO: Record<Board, BoardInfo> = {
  wins: { title: 'Victoires', tab: 'Victoires', description: 'Toutes les victoires.' },
  wins_easy: {
    title: 'Hall des débutants',
    tab: 'Débutants',
    description: 'Victoires dont l’IA la plus forte était de niveau facile.',
  },
  wins_medium: {
    title: 'Hall des confirmés',
    tab: 'Confirmés',
    description: 'Victoires dont l’IA la plus forte était de niveau moyen.',
  },
  wins_hard: {
    title: 'Hall des pros',
    tab: 'Pros',
    description: 'Victoires contre au moins une IA difficile.',
  },
  best_streak: {
    title: 'Série de connexion',
    tab: 'Série',
    description: 'La plus longue série de jours de connexion consécutifs.',
  },
};

/** Phrase d'accroche de l'écran des classements. */
export const LEADERBOARD_TAGLINE = 'Seules les légendes apparaissent ici.';

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

/** Codes d'erreur courts renvoyés par `get_leaderboards`, et leur traduction. */
export const LEADERBOARD_ERROR_MESSAGES = {
  guest_not_ranked: 'Connecte-toi à ton compte pour apparaître dans les classements et les consulter.',
  not_authenticated: 'Connecte-toi pour consulter les classements.',
} as const;

const DEFAULT_LEADERBOARD_ERROR = 'Impossible de lire les classements. Vérifie ta connexion.';

/** Message à afficher pour une erreur de lecture des classements. */
export function describeLeaderboardError(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && Object.prototype.hasOwnProperty.call(LEADERBOARD_ERROR_MESSAGES, message)) {
    return LEADERBOARD_ERROR_MESSAGES[message as keyof typeof LEADERBOARD_ERROR_MESSAGES];
  }
  return DEFAULT_LEADERBOARD_ERROR;
}

/** Ligne telle que renvoyée par `get_leaderboards`. */
export interface LeaderboardRow {
  board: string;
  rank: number | null;
  pseudo: string;
  avatar: string | null;
  score: number;
  is_me: boolean;
}

export interface LeaderboardEntry {
  /** Null : le joueur n'a pas encore de score dans ce classement. */
  rank: number | null;
  pseudo: string;
  avatar: string | null;
  score: number;
  isMe: boolean;
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
    };
    if (entry.rank !== null && entry.rank <= TOP_SIZE) view.top.push(entry);
    else if (entry.isMe) view.me = entry;
  }
  for (const board of BOARDS) views[board].top.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  return views;
}

/** Unité d'un score, accordée : « victoire », « victoires », « jours »… */
export function formatUnit(board: Board, score: number): string {
  const plural = score > 1 ? 's' : '';
  switch (board) {
    case 'best_streak':
      return `jour${plural}`;
    default:
      return `victoire${plural}`;
  }
}

/** Score avec son unité : « 1 victoire », « 12 victoires », « 3 jours ». */
export function formatScore(board: Board, score: number): string {
  return `${score} ${formatUnit(board, score)}`;
}

/** Rang écrit en toutes lettres : « 1er », « 2e », … ; « — » sans classement. */
export function formatRank(rank: number | null): string {
  if (rank === null) return '—';
  return rank === 1 ? '1er' : `${rank}e`;
}

/** Place sur le podium (1 à 3), ou null. */
export function podiumPlace(rank: number | null): 1 | 2 | 3 | null {
  return rank === 1 || rank === 2 || rank === 3 ? rank : null;
}

/** Texte lu par le lecteur d'écran pour une ligne. */
export function entryLabel(board: Board, entry: LeaderboardEntry): string {
  const who = entry.isMe ? `${entry.pseudo} (toi)` : entry.pseudo;
  const rank = entry.rank === null ? 'pas encore classé' : `${formatRank(entry.rank)} place`;
  return `${rank}, ${who}, ${formatScore(board, entry.score)}`;
}
