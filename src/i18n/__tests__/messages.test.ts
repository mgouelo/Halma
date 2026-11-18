import { describe, expect, it } from '@jest/globals';

import { de } from '../de';
import { en } from '../en';
import { es } from '../es';
import { fr } from '../fr';
import { formatOrdinal, interpolate, msg, pluralForm, translator } from '../translate';
import { LANGUAGES, type MessageValue } from '../types';

const ALL: Record<string, Record<string, MessageValue>> = { fr, en, de, es };
const OTHERS = { en, de, es } as Record<string, Record<string, MessageValue>>;

/** Variables `{nom}` d'un texte, triées et sans doublons. */
function variables(value: MessageValue): string[] {
  const texts = typeof value === 'string' ? [value] : [value.one, value.other];
  const names = texts.flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
  if (typeof value !== 'string') names.push('count');
  return [...new Set(names)].sort();
}

/** Balises de texte enrichi (`<link>…</link>`) d'un texte. */
function tags(value: MessageValue): string[] {
  const texts = typeof value === 'string' ? [value] : [value.one, value.other];
  return texts.flatMap((text) => [...text.matchAll(/<(\w+)>/g)].map((m) => m[1])).sort();
}

describe('fichiers de traduction', () => {
  it('les quatre langues sont là, le français en premier (langue de référence)', () => {
    expect(LANGUAGES).toEqual(['fr', 'en', 'de', 'es']);
  });

  it.each(Object.keys(OTHERS))('%s a exactement les clés du français, ni plus ni moins', (language) => {
    const keys = Object.keys(OTHERS[language]).sort();
    expect(keys).toEqual(Object.keys(fr).sort());
  });

  it.each(Object.keys(OTHERS))('%s a les mêmes variables et balises que le français, clé par clé', (language) => {
    const messages = OTHERS[language];
    const mismatches = Object.entries(fr as Record<string, MessageValue>)
      .filter(([key, value]) => {
        const other = messages[key];
        return (
          other === undefined ||
          typeof other !== typeof value ||
          variables(other).join() !== variables(value).join() ||
          tags(other).join() !== tags(value).join()
        );
      })
      .map(([key]) => key);
    expect(mismatches).toEqual([]);
  });

  it('aucun texte vide, ni espace en trop au début ou à la fin', () => {
    for (const [language, messages] of Object.entries(ALL)) {
      for (const [key, value] of Object.entries(messages)) {
        const texts = typeof value === 'string' ? [value] : [value.one, value.other];
        for (const text of texts) {
          // « (toi) » commence volontairement par une espace : il suit un pseudo.
          if (key === 'common.youSuffix') continue;
          expect({ language, key, ok: text.length > 0 && text === text.trim() }).toEqual({ language, key, ok: true });
        }
      }
    }
  });

  it('en, de, es : aucune phrase restée en français', () => {
    // Quelques mots très français qui n'ont rien à faire ailleurs (sauf noms propres et exemples).
    // (« Partie » et « des » sont aussi des mots allemands : ils n'y figurent pas.)
    const french = /\b(le|la|les|une|est|pour|avec|ton|tes|vous|joueur|connexion)\b/i;
    const allowed = new Set(['common.appName', 'avatar.part.ramune', 'avatar.part.takoyaki']);
    for (const [language, messages] of Object.entries(OTHERS)) {
      // L'espagnol partage « la », « las »… : on ne vérifie que l'anglais et l'allemand avec cette liste.
      if (language === 'es') continue;
      for (const [key, value] of Object.entries(messages)) {
        if (allowed.has(key)) continue;
        const text = typeof value === 'string' ? value : `${value.one} ${value.other}`;
        expect({ language, key, french: french.test(text.replace(/\{\w+\}/g, '')) }).toEqual({
          language,
          key,
          french: false,
        });
      }
    }
  });
});

describe('traducteur', () => {
  it('remplace les variables et choisit le pluriel selon la langue', () => {
    expect(translator('fr')('game.move', { n: 3 })).toBe('Coup 3');
    expect(translator('en')('game.move', { n: 3 })).toBe('Move 3');
    expect(translator('fr')('leaderboard.unitWins', { count: 0 })).toBe('victoire');
    expect(translator('en')('leaderboard.unitWins', { count: 0 })).toBe('wins');
    expect(translator('de')('leaderboard.unitWins', { count: 1 })).toBe('Sieg');
    expect(translator('es')('leaderboard.unitWins', { count: 2 })).toBe('victorias');
  });

  it('règles de pluriel : 0 et 1 au singulier en français, 1 seulement ailleurs, signe ignoré', () => {
    expect([0, 1, 2, -1].map((n) => pluralForm('fr', n))).toEqual(['one', 'one', 'other', 'one']);
    for (const language of ['en', 'de', 'es'] as const) {
      expect([0, 1, 2, -1].map((n) => pluralForm(language, n))).toEqual(['other', 'one', 'other', 'one']);
    }
  });

  it('écrit les nombres à la façon de la langue', () => {
    const normalize = (text: string) => text.replace(/\s/g, ' ');
    expect(normalize(interpolate('{n}', { n: 12345 }, 'fr-FR'))).toBe('12 345');
    expect(interpolate('{n}', { n: 12345 }, 'en-US')).toBe('12,345');
    expect(interpolate('{n}', { n: 12345 }, 'de-DE')).toBe('12.345');
    expect(interpolate('{code}', { code: 'K7QM3X' }, 'de-DE')).toBe('K7QM3X');
  });

  it('écrit les rangs à la façon de la langue', () => {
    expect([1, 2, 21].map((n) => formatOrdinal('fr', n))).toEqual(['1er', '2e', '21e']);
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map((n) => formatOrdinal('en', n))).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '103rd',
    ]);
    expect(formatOrdinal('de', 3)).toBe('3.');
    expect(formatOrdinal('es', 3)).toBe('3.º');
  });

  it('un message gardé pour plus tard se traduit dans la langue du moment', () => {
    const notice = msg('online.hostClosed');
    expect(translator('fr').msg(notice)).toBe('L’hôte a fermé la room.');
    expect(translator('en').msg(notice)).toBe('The host closed the room.');
    expect(translator('es').msg(msg('friends.requestSentTo', { name: 'Zoé' }))).toBe('Solicitud enviada a Zoé.');
  });

  it('le même traducteur est rendu pour une langue (identité stable)', () => {
    expect(translator('de')).toBe(translator('de'));
    expect(translator('de')).not.toBe(translator('en'));
  });
});
