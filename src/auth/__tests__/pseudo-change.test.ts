import { describe, expect, it } from '@jest/globals';

import { formatDay, translator } from '@/i18n';

import { tooSoonMessage } from '../errors';
import { nextPseudoChange, PSEUDO_CHANGE_DELAY_DAYS } from '../pseudo-change';

const t = translator('fr');

const now = new Date(2026, 10, 14, 12, 0);
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 3600 * 1000).toISOString();

describe('délai entre deux changements de pseudo', () => {
  it('est de 7 jours', () => {
    expect(PSEUDO_CHANGE_DELAY_DAYS).toBe(7);
  });

  it('ne s’applique pas à un pseudo jamais changé depuis l’inscription', () => {
    expect(nextPseudoChange({ pseudo: 'Alice', pseudo_changed_at: null }, now)).toBeNull();
  });

  it('ne s’applique pas au premier choix d’un invité', () => {
    expect(nextPseudoChange({ pseudo: 'invite-a1b2c3', pseudo_changed_at: daysAgo(1) }, now)).toBeNull();
  });

  it('donne la date du prochain changement pendant le délai', () => {
    const next = nextPseudoChange({ pseudo: 'Alice', pseudo_changed_at: daysAgo(2) }, now);
    expect(next?.getTime()).toBe(now.getTime() + 5 * 24 * 3600 * 1000);
  });

  it('permet de nouveau le changement après 7 jours', () => {
    expect(nextPseudoChange({ pseudo: 'Alice', pseudo_changed_at: daysAgo(7) }, now)).toBeNull();
    expect(nextPseudoChange({ pseudo: 'Alice', pseudo_changed_at: daysAgo(30) }, now)).toBeNull();
  });

  it('ignore une date illisible (le serveur tranche)', () => {
    expect(nextPseudoChange({ pseudo: 'Alice', pseudo_changed_at: 'n’importe quoi' }, now)).toBeNull();
  });
});

describe('messages', () => {
  it('écrit la date en français', () => {
    expect(formatDay(t, new Date(2026, 10, 21), now)).toBe('21 novembre');
    expect(formatDay(t, new Date(2026, 11, 1), now)).toBe('1er décembre');
    expect(formatDay(t, new Date(2027, 0, 3), now)).toBe('3 janvier 2027');
  });

  it('annonce le prochain changement possible', () => {
    expect(tooSoonMessage(t, PSEUDO_CHANGE_DELAY_DAYS, new Date(2026, 10, 21, 9, 5), now)).toBe(
      'Tu ne peux changer de pseudo qu’une fois tous les 7 jours. Prochain changement possible le 21 novembre à 9 h 05.',
    );
    expect(tooSoonMessage(t, PSEUDO_CHANGE_DELAY_DAYS, null, now)).toBe('Tu ne peux changer de pseudo qu’une fois tous les 7 jours.');
  });

  it('écrit la date et l’heure dans les autres langues', () => {
    const next = new Date(2026, 10, 21, 15, 38);
    // L'anglais sépare « PM » par une espace insécable fine (selon la version d'ICU).
    expect(tooSoonMessage(translator('en'), 7, next, now)).toMatch(
      /^You can only change your username once every 7 days\. Next change possible on November 21 at 3:38\sPM\.$/,
    );
    expect(formatDay(translator('de'), next, now)).toBe('21. November');
    expect(formatDay(translator('es'), next, now)).toBe('21 de noviembre');
  });
});
