// Bouton de retour des écrans sans barre de navigation : il ramène à l'écran
// d'où l'on vient (historique de navigation), avec une solution de secours
// quand il n'y en a pas (page rechargée sur le web, lien direct).

import { router, type Href } from 'expo-router';

/** Écrans dont le retour de secours est le profil (compte, avatar, pages d'information). */
const PROFILE_FALLBACK_PATHS: readonly string[] = [
  '/avatar',
  '/sign-in',
  '/sign-up',
  '/upgrade',
  '/credits',
  '/privacy',
  '/terms',
];

/** Écran de secours du bouton de retour : le profil pour les écrans de compte et d'information, l'accueil sinon. */
export function backFallback(pathname: string): '/' | '/profile' {
  const path = pathname.replace(/\/+$/, '') || '/';
  return PROFILE_FALLBACK_PATHS.includes(path) ? '/profile' : '/';
}

/** Écran précédent s'il y en a un, sinon `fallback` (qui remplace l'écran affiché). */
export function goBack(fallback: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
