import { usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { Platform } from 'react-native';

import { siteUrl } from '@/auth/redirect';

/** Nom du site, à la fin du titre de chaque page. */
export const SITE_NAME = 'Halma';
/** Description par défaut des pages (la même que `web.description` dans app.json). */
export const SITE_DESCRIPTION = 'Dames chinoises (Halma) de 2 à 6 joueurs : contre l’IA, entre amis ou en ligne.';

// Icône de l'application (étoile au trait, pions pastel) : image des aperçus de liens.
const SHARE_IMAGE: { uri?: string } | number = require('../../assets/images/icon.png');

/** Titre de l'onglet : « Confidentialité · Halma », ou « Halma » seul. */
export function pageTitle(title?: string): string {
  return title && title !== SITE_NAME ? `${title} · ${SITE_NAME}` : SITE_NAME;
}

/**
 * Titre, description et aperçu de lien (Open Graph) de la page, dans le HTML
 * exporté (web seulement). En SDK 57, `<Head>` d'Expo Router les écrit dans
 * le HTML statique ; la page la plus profonde l'emporte sur la mise en page
 * racine, qui donne les valeurs par défaut. Adresses absolues (`og:url`,
 * `og:image`, lien canonique) seulement si `EXPO_PUBLIC_SITE_URL` est définie.
 */
export function PageHead({ title, description = SITE_DESCRIPTION }: { title?: string; description?: string }) {
  const pathname = usePathname();
  if (Platform.OS !== 'web') return null;
  const fullTitle = pageTitle(title);
  const site = siteUrl()?.replace(/\/+$/, '');
  const imagePath = typeof SHARE_IMAGE === 'object' ? SHARE_IMAGE.uri : undefined;
  // Pas d'adresse canonique pour les routes dynamiques (/room/[id] à l'export statique).
  const url = site && !pathname.includes('[') ? `${site}${pathname}` : null;
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      {url && <meta property="og:url" content={url} />}
      {url && <link rel="canonical" href={url} />}
      {site && imagePath && <meta property="og:image" content={`${site}${imagePath}`} />}
      {site && imagePath && <meta property="og:image:alt" content="Logo de Halma : une étoile à six branches avec des pions pastel" />}
    </Head>
  );
}
