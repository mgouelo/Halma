// Document HTML du web (export statique). Uniquement pour le web : ce fichier
// n'est pas utilisé sur iOS ni Android.

import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { Colors } from '@/constants/theme';

/**
 * - `lang="fr"` : les lecteurs d'écran prononcent le texte en français ;
 * - anneau de focus bien visible pour la navigation au clavier (trait noir épais,
 *   comme le reste de la DA), uniquement quand on navigue au clavier (`:focus-visible`) ;
 * - fond blanc dès le premier affichage, et couleur de thème du navigateur.
 */
const globalCss = `
body { background-color: ${Colors.paper}; }
:focus { outline: none; }
:focus-visible { outline: 3px solid ${Colors.ink}; outline-offset: 3px; border-radius: 12px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;

export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html lang="fr" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="description" content="Dames chinoises (Halma) de 2 à 6 joueurs : contre l’IA, à deux ou en ligne." />
        <meta name="theme-color" content={Colors.paper} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: globalCss }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
