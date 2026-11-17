import { Fragment, useSyncExternalStore, type ReactNode } from 'react';

import { getLanguage, isLanguageReady, subscribeLanguage } from './language';
import { translator, type Translator } from './translate';
import { DEFAULT_LANGUAGE, type Language } from './types';

/**
 * Langue active ; l'écran se redessine quand elle change. Pendant le rendu
 * statique du web et l'hydratation, toujours le français (la langue du HTML
 * exporté), puis la langue du joueur juste après : pas d'écart d'hydratation.
 */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribeLanguage, getLanguage, () => DEFAULT_LANGUAGE);
}

/**
 * Traducteur de la langue active. Son identité change avec la langue : les
 * fonctions qui le reçoivent en paramètre (formatRank(t, …)) sont recalculées,
 * même mémoïsées par le React Compiler. Tout composant qui affiche du texte
 * l'appelle lui-même plutôt que de compter sur un parent.
 */
export function useT(): Translator {
  return translator(useLanguage());
}

/** Vrai une fois la préférence de langue relue (sur mobile, l'écran de démarrage attend). */
export function useLanguageReady(): boolean {
  return useSyncExternalStore(subscribeLanguage, isLanguageReady, () => true);
}

/**
 * Texte avec des passages balisés : `rich(t('signIn.guestWarning'), { link:
 * (text) => <Link …>{text}</Link> })` pour « … <link>crée plutôt ton
 * compte</link>. » Une balise inconnue est rendue comme du texte simple.
 */
export function rich(text: string, tags: Record<string, (chunk: string) => ReactNode>): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const render = tags[match[1]];
    parts.push(<Fragment key={`${match[1]}-${match.index}`}>{render ? render(match[2]) : match[2]}</Fragment>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
