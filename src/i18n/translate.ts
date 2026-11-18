// Traduction : choix du message, pluriel, interpolation des variables et mise
// en forme des nombres, rangs et dates selon la langue. Logique pure (sans
// React), utilisable partout ; les écrans passent par `useT()` (react.ts).

import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import type { MessageArgs, MessageKey, Messages } from './messages';
import { DEFAULT_LANGUAGE, LANGUAGE_LOCALES, type Language, type ParamValue, type Plural } from './types';

const MESSAGES: Record<Language, Messages> = { fr, en, de, es };

/** Message à afficher plus tard (erreur gardée dans un état, notice) : sa clé et ses variables. */
export interface Msg {
  readonly key: MessageKey;
  readonly params?: Readonly<Record<string, ParamValue>>;
}

/** Fabrique un message à traduire au moment de l'affichage (dans la langue active à ce moment-là). */
export function msg<K extends MessageKey>(key: K, ...args: MessageArgs<K>): Msg {
  return args[0] === undefined ? { key } : { key, params: args[0] as Record<string, ParamValue> };
}

/** Vrai si `key` est une clé connue (libellés construits à partir d'un identifiant, comme ceux des avatars). */
export function hasMessage(key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(MESSAGES[DEFAULT_LANGUAGE], key);
}

/** Traducteur d'une langue : `t('home.title')`, `t('game.move', { n: 3 })`. */
export interface Translator {
  <K extends MessageKey>(key: K, ...args: MessageArgs<K>): string;
  /** Traduit un message gardé pour plus tard. */
  msg(message: Msg): string;
  readonly language: Language;
  /** Locale BCP 47 pour `Intl` (« fr-FR »…). */
  readonly locale: string;
}

/**
 * Forme du pluriel pour un nombre entier (signe ignoré : « -1 point »).
 * Français : 0 et 1 au singulier ; anglais, allemand, espagnol : 1 seulement.
 */
export function pluralForm(language: Language, count: number): keyof Plural {
  const n = Math.abs(count);
  if (language === 'fr') return n < 2 ? 'one' : 'other';
  return n === 1 ? 'one' : 'other';
}

const numberFormats = new Map<string, Intl.NumberFormat | null>();

/** Nombre écrit à la façon de la langue (« 1 500 », « 1,500 », « 1.500 ») ; à défaut d'`Intl`, tel quel. */
export function formatNumber(locale: string, value: number): string {
  if (!numberFormats.has(locale)) {
    try {
      numberFormats.set(locale, new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }));
    } catch {
      numberFormats.set(locale, null);
    }
  }
  const format = numberFormats.get(locale);
  try {
    return format ? format.format(value) : String(value);
  } catch {
    return String(value);
  }
}

function formatParam(value: ParamValue, locale: string): string {
  return typeof value === 'number' ? formatNumber(locale, value) : value;
}

/** Remplace les `{variables}` d'un texte ; une variable absente reste écrite telle quelle (visible en test). */
export function interpolate(text: string, params: Readonly<Record<string, ParamValue>> | undefined, locale: string): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? formatParam(params[name], locale) : match,
  );
}

function resolve(
  language: Language,
  key: MessageKey,
  params: Readonly<Record<string, ParamValue>> | undefined,
): string {
  const value = MESSAGES[language][key] ?? MESSAGES[DEFAULT_LANGUAGE][key];
  const locale = LANGUAGE_LOCALES[language];
  if (typeof value === 'string') return interpolate(value, params, locale);
  if (value === undefined) return key;
  const count = typeof params?.count === 'number' ? params.count : Number(params?.count ?? 0);
  return interpolate(value[pluralForm(language, count)], params, locale);
}

const translators = new Map<Language, Translator>();

/** Traducteur de `language` (le même objet à chaque appel : une identité stable par langue). */
export function translator(language: Language): Translator {
  const cached = translators.get(language);
  if (cached) return cached;
  const t = ((key: MessageKey, params?: Record<string, ParamValue>) => resolve(language, key, params)) as Translator;
  Object.defineProperties(t, {
    msg: { value: (message: Msg) => resolve(language, message.key, message.params) },
    language: { value: language },
    locale: { value: LANGUAGE_LOCALES[language] },
  });
  translators.set(language, t);
  return t;
}

// --- Rangs et dates ---------------------------------------------------------

/** Rang écrit à la façon de la langue : « 1er », « 2e » ; « 1st », « 2nd » ; « 1. » ; « 1.º ». */
export function formatOrdinal(language: Language, rank: number): string {
  switch (language) {
    case 'fr':
      return rank === 1 ? '1er' : `${rank}e`;
    case 'de':
      return `${rank}.`;
    case 'es':
      return `${rank}.º`;
    case 'en': {
      const tens = rank % 100;
      if (tens >= 11 && tens <= 13) return `${rank}th`;
      const suffix = rank % 10 === 1 ? 'st' : rank % 10 === 2 ? 'nd' : rank % 10 === 3 ? 'rd' : 'th';
      return `${rank}${suffix}`;
    }
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Jour et mois (« 21 novembre », « November 21 », « 21. November », « 21 de
 * noviembre »), avec l'année si elle n'est pas celle de `now`, à l'heure de
 * l'appareil. En français, le premier du mois s'écrit « 1er ».
 */
export function formatDay(t: Translator, date: Date, now: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric';
  let text: string;
  try {
    text = new Intl.DateTimeFormat(t.locale, options).format(date);
  } catch {
    text = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  return t.language === 'fr' ? text.replace(/^1(?=\s)/, '1er') : text;
}

/** Heure et minutes (« 15 h 38 », « 3:38 PM », « 15:38 »), à l'heure de l'appareil. */
export function formatTime(t: Translator, date: Date): string {
  if (t.language === 'fr') return `${date.getHours()} h ${pad(date.getMinutes())}`;
  try {
    return new Intl.DateTimeFormat(t.locale, { hour: 'numeric', minute: '2-digit' }).format(date);
  } catch {
    return `${date.getHours()}:${pad(date.getMinutes())}`;
  }
}
