// Types des messages traduits. Le français (fr.ts) est la source : ses clés et
// ses variables d'interpolation définissent ce que chaque autre langue doit
// fournir, et `tsc` signale toute clé manquante ou en trop.

/** Langues de l'application, la première est la langue de référence et de secours. */
export const LANGUAGES = ['fr', 'en', 'de', 'es'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'fr';

/** Nom de chaque langue écrit dans sa propre langue (sélecteur de langue). */
export const LANGUAGE_NAMES: Record<Language, string> = {
  fr: 'Français',
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
};

/** Locale BCP 47 passée à `Intl` (nombres, dates) et aux balises web (`og:locale` en remplaçant « - » par « _ »). */
export const LANGUAGE_LOCALES: Record<Language, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * Message à pluriel : `one` pour 1 (et 0 en français), `other` sinon. Les
 * quatre langues n'ont besoin que de ces deux formes pour des nombres entiers.
 * Le nombre est la variable `{count}`.
 */
export interface Plural {
  readonly one: string;
  readonly other: string;
}

export type MessageValue = string | Plural;

/** Noms des variables `{nom}` d'un texte. */
type ParamsOfText<S extends string> = S extends `${string}{${infer P}}${infer Rest}` ? P | ParamsOfText<Rest> : never;

/** Variables d'un message (un pluriel demande toujours `count`). */
export type ParamNames<V> = V extends Plural
  ? ParamsOfText<V['one']> | ParamsOfText<V['other']> | 'count'
  : V extends string
    ? ParamsOfText<V>
    : never;

export type ParamValue = string | number;
