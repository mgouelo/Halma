import { usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { Platform } from 'react-native';

import { siteUrl } from '@/auth/redirect';
import { LANGUAGE_LOCALES, translator, useT } from '@/i18n';

/** Nom du site, à la fin du titre de chaque page. */
export const SITE_NAME = 'Halma';
/** Description par défaut des pages en français (la même que `web.description` dans app.json, rendu statique). */
export const SITE_DESCRIPTION = translator('fr')('page.description');

// Icône de l'application (étoile au trait, pions pastel) : image des aperçus de liens.
const SHARE_IMAGE: { uri?: string } | number = require('../../assets/images/icon.png');

/** Titre de l'onglet : « Confidentialité · Halma », ou « Halma » seul. */
export function pageTitle(title?: string): string {
  return title && title !== SITE_NAME ? `${title} · ${SITE_NAME}` : SITE_NAME;
}

/**
 * Titre, description et aperçu de lien (Open Graph) de la page, dans le HTML
 * exporté (web seulement), dans la langue active : le français au rendu
 * statique, puis la langue du joueur une fois la page ouverte. En SDK 57,
 * `<Head>` d'Expo Router les écrit dans le HTML statique ; la page la plus
 * profonde l'emporte sur la mise en page racine, qui donne les valeurs par
 * défaut. Adresses absolues (`og:url`, `og:image`, lien canonique) seulement si
 * `EXPO_PUBLIC_SITE_URL` est définie.
 */
export function PageHead({ title, description: descriptionProp }: { title?: string; description?: string }) {
  const t = useT();
  const pathname = usePathname();
  if (Platform.OS !== 'web') return null;
  const description = descriptionProp ?? t('page.description');
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
      <meta property="og:locale" content={LANGUAGE_LOCALES[t.language].replace('-', '_')} />
      {url && <meta property="og:url" content={url} />}
      {url && <link rel="canonical" href={url} />}
      {site && imagePath && <meta property="og:image" content={`${site}${imagePath}`} />}
      {site && imagePath && <meta property="og:image:alt" content={t('page.imageAlt')} />}
    </Head>
  );
}
