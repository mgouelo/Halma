import { describe, expect, it } from '@jest/globals';

import {
  boardInfo,
  BOARDS,
  DEFAULT_BOARD,
  formatPointsDelta,
  formatValue,
  describeLeaderboardError,
  entryLabel,
  formatRank,
  formatScore,
  formatUnit,
  groupLeaderboards,
  leaderboardAccess,
  myPositionLabel,
  podiumPlace,
  type LeaderboardRow,
} from '../leaderboard';
import { translator } from '@/i18n';

const t = translator('fr');

const row = (board: string, rank: number | null, pseudo: string, score: number, isMe = false): LeaderboardRow => ({
  board,
  rank,
  pseudo,
  avatar: null,
  score,
  is_me: isMe,
});

describe('classements', () => {
  it('a trois classements, dans l’ordre demandé, « Points » par défaut', () => {
    expect(BOARDS.map((b) => boardInfo(t, b).tab)).toEqual(['Points', 'Victoires', 'Série']);
    expect(DEFAULT_BOARD).toBe('points');
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
    expect(views.points).toEqual({ top: [], me: null });
  });

  it('met à part la ligne du joueur hors du top 50', () => {
    const top = Array.from({ length: 50 }, (_, i) => row('best_streak', i + 1, `J${i + 1}`, 100 - i));
    const views = groupLeaderboards([...top, row('best_streak', 73, 'Moi', 4, true)]);
    expect(views.best_streak.top).toHaveLength(50);
    expect(views.best_streak.me).toMatchObject({ rank: 73, pseudo: 'Moi', score: 4, isMe: true, userId: null });
  });

  it('garde la ligne du joueur pas encore classé (rang null, score 0)', () => {
    const views = groupLeaderboards([row('points', null, 'Moi', 0, true)]);
    expect(views.points.top).toEqual([]);
    expect(views.points.me).toMatchObject({ rank: null, score: 0 });
  });

  it('ignore un classement inconnu', () => {
    expect(() => groupLeaderboards([row('triche', 1, 'X', 1000)])).not.toThrow();
  });

  it('ignore les anciens classements (parties lancées, niveaux d’IA) d’un serveur pas encore migré', () => {
    const views = groupLeaderboards([
      row('games_started', 1, 'Alice', 40),
      row('wins_hard', 1, 'Alice', 1),
      row('wins', 1, 'Alice', 2),
    ]);
    expect(Object.keys(views)).toEqual(['points', 'wins', 'best_streak']);
    expect(views.wins.top).toHaveLength(1);
  });

  it('écrit les scores avec leur unité, au singulier et au pluriel', () => {
    expect(formatUnit(t, 'wins', 3)).toBe('victoires');
    expect(formatScore(t, 'wins', 0)).toBe('0 victoire');
    expect(formatScore(t, 'wins', 1)).toBe('1 victoire');
    expect(formatScore(t, 'wins', 12)).toBe('12 victoires');
    expect(formatScore(t, 'best_streak', 1)).toBe('1 jour');
    expect(formatScore(t, 'best_streak', 30)).toBe('30 jours');
  });

  it('écrit les points avec leur signe quand ils sont négatifs', () => {
    expect(formatScore(t, 'points', 0)).toBe('0 point');
    expect(formatScore(t, 'points', 1)).toBe('1 point');
    expect(formatScore(t, 'points', 128)).toBe('128 points');
    expect(formatScore(t, 'points', -15)).toBe('-15 points');
    expect(formatScore(t, 'points', -1)).toBe('-1 point');
    expect(formatValue(t, -999)).toBe('-999');
    expect(entryLabel(t, 'points', { rank: 7, pseudo: 'Bob', avatar: null, score: -42, isMe: false, userId: null })).toBe(
      '7e place, Bob, -42 points',
    );
  });

  it('écrit une variation de points toujours signée', () => {
    expect(formatPointsDelta(t, 27)).toBe('+27 points');
    expect(formatPointsDelta(t, -15)).toBe('-15 points');
    expect(formatPointsDelta(t, 1)).toBe('+1 point');
    expect(formatPointsDelta(t, 0)).toBe('+0 point');
    expect(formatPointsDelta(translator('en'), 0)).toBe('+0 points');
    expect(formatPointsDelta(translator('en'), -1)).toBe('-1 point');
    expect(formatScore(translator('de'), 'wins', 1500)).toBe('1.500 Siege');
  });

  it('garde l’identifiant de chaque joueur (null pour un serveur pas encore migré)', () => {
    const views = groupLeaderboards([
      { ...row('points', 1, 'Alice', 30), user_id: 'u-alice' },
      row('points', 2, 'Bob', 10),
      { ...row('points', 70, 'Moi', 1, true), user_id: 'u-moi' },
    ]);
    expect(views.points.top.map((e) => e.userId)).toEqual(['u-alice', null]);
    expect(views.points.me?.userId).toBe('u-moi');
  });

  it('annonce la position du joueur dans le bloc « C’est toi »', () => {
    expect(myPositionLabel(t, 12)).toBe('Tu es 12e');
    expect(myPositionLabel(t, 1)).toBe('Tu es 1er');
    expect(myPositionLabel(t, null)).toBeNull();
  });

  it('écrit les rangs et repère le podium', () => {
    expect([1, 2, 3, 51, null].map((rank) => formatRank(t, rank))).toEqual(['1er', '2e', '3e', '51e', '—']);
    expect([1, 2, 3, 11, 22].map((rank) => formatRank(translator('en'), rank))).toEqual(['1st', '2nd', '3rd', '11th', '22nd']);
    expect(formatRank(translator('de'), 4)).toBe('4.');
    expect(formatRank(translator('es'), 4)).toBe('4.º');
    expect([1, 2, 3, 4, null].map(podiumPlace)).toEqual([1, 2, 3, null, null]);
  });

  it('donne un libellé complet au lecteur d’écran', () => {
    expect(entryLabel(t, 'wins', { rank: 1, pseudo: 'Alice', avatar: null, score: 5, isMe: true, userId: null })).toBe(
      '1er place, Alice (toi), 5 victoires',
    );
    expect(entryLabel(t, 'best_streak', { rank: null, pseudo: 'Bob', avatar: null, score: 0, isMe: true, userId: null })).toBe(
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
    expect(describeLeaderboardError(t, { message: 'guest_not_ranked', code: 'P0001' })).toBe(
      'Connecte-toi à ton compte pour apparaître dans les classements et les consulter.',
    );
    expect(describeLeaderboardError(t, new Error('not_authenticated'))).toBe('Connecte-toi pour consulter les classements.');
  });

  it('message générique pour les autres erreurs', () => {
    expect(describeLeaderboardError(t, new Error('Failed to fetch'))).toMatch(/Vérifie ta connexion/);
    expect(describeLeaderboardError(t, null)).toMatch(/Vérifie ta connexion/);
    expect(describeLeaderboardError(t, { message: 'toString' })).toMatch(/Vérifie ta connexion/);
  });

  it('reste discret sur ce qui compte : une seule phrase d’accroche', () => {
    expect(t('leaderboard.tagline')).toBe('Seules les légendes apparaissent ici.');
    for (const board of BOARDS) {
      expect(boardInfo(t, board).description).not.toMatch(/en ligne|hors ligne|serveur/);
    }
  });
});
