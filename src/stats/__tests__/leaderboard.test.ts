import { describe, expect, it } from '@jest/globals';

import {
  BOARD_INFO,
  BOARDS,
  describeLeaderboardError,
  entryLabel,
  formatRank,
  formatScore,
  formatUnit,
  groupLeaderboards,
  LEADERBOARD_ERROR_MESSAGES,
  LEADERBOARD_TAGLINE,
  leaderboardAccess,
  podiumPlace,
  type LeaderboardRow,
} from '../leaderboard';

const row = (board: string, rank: number | null, pseudo: string, score: number, isMe = false): LeaderboardRow => ({
  board,
  rank,
  pseudo,
  avatar: null,
  score,
  is_me: isMe,
});

describe('classements', () => {
  it('a cinq classements, dans l’ordre demandé (plus de « Parties lancées »)', () => {
    expect(BOARDS.map((b) => BOARD_INFO[b].title)).toEqual([
      'Victoires',
      'Hall des débutants',
      'Hall des confirmés',
      'Hall des pros',
      'Série de connexion',
    ]);
  });

  it('range les lignes par classement, dans l’ordre des rangs', () => {
    const views = groupLeaderboards([
      row('wins', 2, 'Bob', 3),
      row('wins', 1, 'Alice', 5, true),
      row('best_streak', 1, 'Carol', 9),
    ]);
    expect(views.wins.top.map((e) => e.pseudo)).toEqual(['Alice', 'Bob']);
    expect(views.wins.top[0].isMe).toBe(true);
    expect(views.wins.me).toBeNull();
    expect(views.best_streak.top).toHaveLength(1);
    expect(views.wins_hard).toEqual({ top: [], me: null });
  });

  it('met à part la ligne du joueur hors du top 50', () => {
    const top = Array.from({ length: 50 }, (_, i) => row('best_streak', i + 1, `J${i + 1}`, 100 - i));
    const views = groupLeaderboards([...top, row('best_streak', 73, 'Moi', 4, true)]);
    expect(views.best_streak.top).toHaveLength(50);
    expect(views.best_streak.me).toMatchObject({ rank: 73, pseudo: 'Moi', score: 4, isMe: true });
  });

  it('garde la ligne du joueur pas encore classé (rang null, score 0)', () => {
    const views = groupLeaderboards([row('wins_easy', null, 'Moi', 0, true)]);
    expect(views.wins_easy.top).toEqual([]);
    expect(views.wins_easy.me).toMatchObject({ rank: null, score: 0 });
  });

  it('ignore un classement inconnu', () => {
    expect(() => groupLeaderboards([row('triche', 1, 'X', 1000)])).not.toThrow();
  });

  it('ignore les « parties lancées » d’un serveur pas encore migré', () => {
    const views = groupLeaderboards([row('games_started', 1, 'Alice', 40), row('wins', 1, 'Alice', 2)]);
    expect(Object.keys(views)).toEqual(['wins', 'wins_easy', 'wins_medium', 'wins_hard', 'best_streak']);
    expect(views.wins.top).toHaveLength(1);
  });

  it('écrit les scores avec leur unité, au singulier et au pluriel', () => {
    expect(formatUnit('wins_easy', 3)).toBe('victoires');
    expect(formatScore('wins', 0)).toBe('0 victoire');
    expect(formatScore('wins_hard', 1)).toBe('1 victoire');
    expect(formatScore('wins', 12)).toBe('12 victoires');
    expect(formatScore('best_streak', 1)).toBe('1 jour');
    expect(formatScore('best_streak', 30)).toBe('30 jours');
  });

  it('écrit les rangs et repère le podium', () => {
    expect([1, 2, 3, 51, null].map(formatRank)).toEqual(['1er', '2e', '3e', '51e', '—']);
    expect([1, 2, 3, 4, null].map(podiumPlace)).toEqual([1, 2, 3, null, null]);
  });

  it('donne un libellé complet au lecteur d’écran', () => {
    expect(entryLabel('wins', { rank: 1, pseudo: 'Alice', avatar: null, score: 5, isMe: true })).toBe(
      '1er place, Alice (toi), 5 victoires',
    );
    expect(entryLabel('best_streak', { rank: null, pseudo: 'Bob', avatar: null, score: 0, isMe: true })).toBe(
      'pas encore classé, Bob (toi), 0 jour',
    );
  });
});

describe('accès aux classements', () => {
  it('réservé aux comptes e-mail : un invité est invité à se connecter', () => {
    expect(leaderboardAccess({ isGuest: false })).toBe('allowed');
    expect(leaderboardAccess({ isGuest: true })).toBe('guest');
    expect(leaderboardAccess(null)).toBe('signed_out');
  });

  it('traduit le refus du serveur pour un invité', () => {
    expect(describeLeaderboardError({ message: 'guest_not_ranked', code: 'P0001' })).toBe(
      'Connecte-toi à ton compte pour apparaître dans les classements et les consulter.',
    );
    expect(describeLeaderboardError(new Error('not_authenticated'))).toBe(LEADERBOARD_ERROR_MESSAGES.not_authenticated);
  });

  it('message générique pour les autres erreurs', () => {
    expect(describeLeaderboardError(new Error('Failed to fetch'))).toMatch(/Vérifie ta connexion/);
    expect(describeLeaderboardError(null)).toMatch(/Vérifie ta connexion/);
    expect(describeLeaderboardError({ message: 'toString' })).toMatch(/Vérifie ta connexion/);
  });

  it('reste discret sur ce qui compte : une seule phrase d’accroche', () => {
    expect(LEADERBOARD_TAGLINE).toBe('Seules les légendes apparaissent ici.');
    for (const board of BOARDS) {
      expect(BOARD_INFO[board].description).not.toMatch(/en ligne|hors ligne|serveur/);
    }
  });
});
