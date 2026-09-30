// Barre de navigation du bas : quelle entrée est active, et comment y aller.
// Logique pure (sans React), testée à part ; l'affichage est dans
// src/components/nav-bar/.

export type NavTab = 'profile' | 'home' | 'leaderboard';

export type NavHref = '/' | '/profile' | '/leaderboard' | '/sign-in';

/** Entrées de la barre, de gauche à droite. */
export const NAV_TABS: readonly NavTab[] = ['profile', 'home', 'leaderboard'];

export const NAV_LABELS: Record<NavTab, string> = {
  profile: 'Profil',
  home: 'Accueil',
  leaderboard: 'Classements',
};

/** Écran d'arrivée de chaque entrée. Non connecté, « Profil » mène à la connexion. */
export function navHref(tab: NavTab, signedIn: boolean): NavHref {
  switch (tab) {
    case 'home':
      return '/';
    case 'leaderboard':
      return '/leaderboard';
    case 'profile':
      return signedIn ? '/profile' : '/sign-in';
  }
}

/**
 * Entrée active pour l'écran affiché : le profil couvre aussi l'éditeur
 * d'avatar ; les autres écrans de la barre (jouer en ligne, réglage d'une
 * partie contre l'IA) partent de l'accueil.
 */
export function activeTab(pathname: string): NavTab {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/profile' || path === '/avatar') return 'profile';
  if (path === '/leaderboard') return 'leaderboard';
  return 'home';
}

/**
 * Déplacement à faire quand on touche une entrée :
 * - `none` : on y est déjà ;
 * - `dismissTo` : revenir en arrière jusqu'à l'écran (l'accueil est toujours
 *   au fond de la pile ; le profil y est quand on édite son avatar) ;
 * - `push` : depuis l'accueil, ou vers la connexion (écran sans barre) ;
 * - `replace` : d'une entrée à l'autre, sans empiler les écrans de la barre.
 */
export type NavAction = { type: 'none' } | { type: 'dismissTo' | 'push' | 'replace'; href: NavHref };

export function navAction(pathname: string, href: NavHref): NavAction {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === href) return { type: 'none' };
  if (href === '/') return { type: 'dismissTo', href };
  if (href === '/sign-in' || path === '/') return { type: 'push', href };
  if (href === '/profile' && path === '/avatar') return { type: 'dismissTo', href };
  return { type: 'replace', href };
}
