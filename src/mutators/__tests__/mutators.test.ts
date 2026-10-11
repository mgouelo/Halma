import { describe, expect, it } from '@jest/globals';

import {
  activeMutators,
  DEFAULT_MUTATORS,
  mutatorsFromSettings,
  parseMutatorParams,
  selectionHint,
  serializeMutators,
  settingsFromMutators,
} from '../mutators';

describe('paramètres d’URL des mutateurs', () => {
  it('garde les valeurs par défaut sans paramètre', () => {
    expect(parseMutatorParams({})).toEqual(DEFAULT_MUTATORS);
    expect(DEFAULT_MUTATORS).toEqual({ touchMove: false, clairvoyance: true });
  });

  it('lit les valeurs valides, dans plusieurs écritures', () => {
    expect(parseMutatorParams({ touch: '1', clairvoyance: '0' })).toEqual({ touchMove: true, clairvoyance: false });
    expect(parseMutatorParams({ touch: ' TRUE ', clairvoyance: 'off' })).toEqual({
      touchMove: true,
      clairvoyance: false,
    });
    expect(parseMutatorParams({ touch: 'non', clairvoyance: 'oui' })).toEqual({ touchMove: false, clairvoyance: true });
  });

  it('ignore les valeurs invalides et prend la première valeur répétée', () => {
    expect(parseMutatorParams({ touch: 'peut-être', clairvoyance: '' })).toEqual(DEFAULT_MUTATORS);
    expect(parseMutatorParams({ touch: '2', clairvoyance: 'yes please' })).toEqual(DEFAULT_MUTATORS);
    expect(parseMutatorParams({ touch: ['1', '0'], clairvoyance: ['0'] })).toEqual({
      touchMove: true,
      clairvoyance: false,
    });
    expect(parseMutatorParams({ touch: [] })).toEqual(DEFAULT_MUTATORS);
  });

  it('fait l’aller-retour avec l’URL', () => {
    for (const touchMove of [true, false]) {
      for (const clairvoyance of [true, false]) {
        const mutators = { touchMove, clairvoyance };
        expect(parseMutatorParams(serializeMutators(mutators))).toEqual(mutators);
      }
    }
  });
});

describe('réglages d’une room (rooms.settings)', () => {
  it('lit la colonne jsonb, avec les valeurs par défaut pour ce qui manque ou est mal formé', () => {
    expect(mutatorsFromSettings({ touch_move: true, clairvoyance: false })).toEqual({
      touchMove: true,
      clairvoyance: false,
    });
    expect(mutatorsFromSettings({ touch_move: true })).toEqual({ touchMove: true, clairvoyance: true });
    expect(mutatorsFromSettings({ touch_move: 'yes', clairvoyance: 0 })).toEqual(DEFAULT_MUTATORS);
    expect(mutatorsFromSettings(null)).toEqual(DEFAULT_MUTATORS);
    expect(mutatorsFromSettings(undefined)).toEqual(DEFAULT_MUTATORS);
    expect(mutatorsFromSettings('touch_move')).toEqual(DEFAULT_MUTATORS);
  });

  it('n’envoie que les clés connues, en booléens', () => {
    expect(settingsFromMutators({ touchMove: true })).toEqual({ touch_move: true });
    expect(settingsFromMutators({ touchMove: false, clairvoyance: false })).toEqual({
      touch_move: false,
      clairvoyance: false,
    });
    expect(settingsFromMutators({})).toEqual({});
  });
});

describe('affichage', () => {
  it('liste les mutateurs actifs pour les badges', () => {
    expect(activeMutators(DEFAULT_MUTATORS)).toEqual(['clairvoyance']);
    expect(activeMutators({ touchMove: true, clairvoyance: false })).toEqual(['touchMove']);
    expect(activeMutators({ touchMove: false, clairvoyance: false })).toEqual([]);
  });

  it('ne parle pas des pointillés sans Clairvoyance', () => {
    const base = {
      selected: { q: 0, r: 0 },
      moves: [{ from: { q: 0, r: 0 }, path: [{ q: 1, r: 0 }] }],
      notice: null,
      idle: 'À toi.',
    };
    expect(selectionHint({ ...base, mutators: DEFAULT_MUTATORS })).toContain('pointillés');
    expect(selectionHint({ ...base, mutators: { touchMove: false, clairvoyance: false } })).not.toContain('pointillés');
    expect(selectionHint({ ...base, selected: null, mutators: DEFAULT_MUTATORS })).toBe('À toi.');
    expect(selectionHint({ ...base, notice: 'locked', mutators: DEFAULT_MUTATORS })).toContain('Toucher c’est jouer');
  });
});
