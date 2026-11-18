import { describe, expect, it } from '@jest/globals';

import { daysBetween, displayedStreak, parisDay, type StreakState } from '../streak';

const fresh: StreakState = { currentStreak: 0, bestStreak: 0, lastLoginDay: null };

describe('jour calendaire de Paris', () => {
  it.each([
    // Heure d'été (UTC+2) : 23 h 30 UTC, c'est déjà le lendemain à Paris.
    ['2026-07-14T21:59:00Z', '2026-07-14'],
    ['2026-07-14T22:00:00Z', '2026-07-15'],
    // Heure d'hiver (UTC+1).
    ['2026-12-31T22:59:59Z', '2026-12-31'],
    ['2026-12-31T23:00:00Z', '2027-01-01'],
    // Changement d'heure (29 mars 2026, 2 h → 3 h).
    ['2026-03-28T23:30:00Z', '2026-03-29'],
  ])('%s → %s', (instant, day) => {
    expect(parisDay(new Date(instant))).toBe(day);
  });

  it('compte les jours entre deux dates, changements d’heure et d’année compris', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-10-02', '2026-10-01')).toBe(-1);
  });
});

describe('série affichée', () => {
  it('affiche la série tant qu’elle n’est pas rompue', () => {
    const state = { currentStreak: 3, bestStreak: 4, lastLoginDay: '2026-10-05' };
    expect(displayedStreak(state, '2026-10-05')).toBe(3);
    expect(displayedStreak(state, '2026-10-06')).toBe(3);
    expect(displayedStreak(state, '2026-10-07')).toBe(0);
    expect(displayedStreak(fresh, '2026-10-07')).toBe(0);
  });
});
