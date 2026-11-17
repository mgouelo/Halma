// Document HTML du web (export statique). Uniquement pour le web : ce fichier
// n'est pas utilisé sur iOS ni Android.

import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { Colors } from '@/constants/theme';

/**
 * - `lang="fr"` : le HTML exporté est en français (langue de référence) ; une
 *   fois la page ouverte, l'application passe à la langue du joueur et met à
 *   jour `document.documentElement.lang` (src/app/_layout.tsx, `useHtmlLang`),
 *   pour que les lecteurs d'écran prononcent le texte dans la bonne langue ;
 * - balises communes à toutes les pages pour les aperçus de liens (Open Graph) ;
 *   le titre, la description, `og:title`, `og:description`, `og:locale`, `og:url`
 *   et `og:image` changent d'une page à l'autre : ils viennent de `<PageHead>`
 *   (src/components/page-head.tsx, `<Head>` d'Expo Router). Pas de `<title>` ni
 *   de description ici : Expo Router écrit déjà sa propre balise `<title>` (vide
 *   sans `<Head>`), et deux balises en double se contrediraient ;
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
        <meta name="theme-color" content={Colors.paper} />
        <meta property="og:site_name" content="Halma" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
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
