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

/**
 * Écran d'arrivée de chaque entrée. Non connecté, « Profil » mène à la
 * connexion ; connecté (invité compris), à la page de profil.
 */
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
 * Écrans rattachés au profil : l'éditeur d'avatar, la connexion, l'inscription
 * et la création de compte d'un invité. Tous gardent la barre de navigation.
 */
const PROFILE_PATHS: readonly string[] = ['/profile', '/avatar', '/sign-in', '/sign-up', '/upgrade'];

function normalize(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

/**
 * Entrée active pour l'écran affiché : le profil couvre aussi ses sous-écrans
 * (voir PROFILE_PATHS) ; les autres écrans de la barre (jouer en ligne,
 * réglage d'une partie contre l'IA ou entre amis) partent de l'accueil.
 */
export function activeTab(pathname: string): NavTab {
  const path = normalize(pathname);
  if (PROFILE_PATHS.includes(path)) return 'profile';
  if (path === '/leaderboard') return 'leaderboard';
  return 'home';
}

/**
 * Déplacement à faire quand on touche une entrée :
 * - `none` : on y est déjà ;
 * - `dismissTo` : revenir en arrière jusqu'à l'écran (l'accueil est toujours
 *   au fond de la pile ; le profil y est souvent sous ses sous-écrans, sinon
 *   `dismissTo` remplace l'écran affiché) ;
 * - `push` : depuis l'accueil ;
 * - `replace` : d'une entrée à l'autre, sans empiler les écrans de la barre.
 */
export type NavAction = { type: 'none' } | { type: 'dismissTo' | 'push' | 'replace'; href: NavHref };

export function navAction(pathname: string, href: NavHref): NavAction {
  const path = normalize(pathname);
  if (path === href) return { type: 'none' };
  if (href === '/') return { type: 'dismissTo', href };
  if (path === '/') return { type: 'push', href };
  if (href === '/profile' && PROFILE_PATHS.includes(path)) return { type: 'dismissTo', href };
  return { type: 'replace', href };
}
