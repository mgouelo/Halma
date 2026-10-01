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
 * Écrans qui ne montrent pas la barre : ils sont affichés par-dessus le groupe
 * (main) et n'ont qu'un bouton « ‹ Retour ». C'est le cas des parties, des
 * rooms, des écrans de compte (connexion, inscription, création de compte),
 * de l'éditeur d'avatar et des pages d'information.
 */
export const SCREENS_WITHOUT_NAV_BAR: readonly string[] = [
  'game',
  'room/[id]',
  'sign-in',
  'sign-up',
  'upgrade',
  'avatar',
  'credits',
  'privacy',
  'terms',
];

function normalize(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

/**
 * Entrée active pour l'écran affiché : le profil est le seul écran de l'entrée
 * « Profil » (ses sous-écrans n'ont pas de barre) ; les autres écrans de la
 * barre (jouer en ligne, réglage d'une partie contre l'IA ou entre amis)
 * partent de l'accueil.
 */
export function activeTab(pathname: string): NavTab {
  const path = normalize(pathname);
  if (path === '/profile') return 'profile';
  if (path === '/leaderboard') return 'leaderboard';
  return 'home';
}

/**
 * Déplacement à faire quand on touche une entrée :
 * - `none` : on y est déjà ;
 * - `dismissTo` : revenir en arrière jusqu'à l'accueil, toujours au fond de la pile ;
 * - `push` : depuis l'accueil, et vers la connexion (écran sans barre, affiché
 *   par-dessus : son bouton « ‹ Retour » revient là où l'on était) ;
 * - `replace` : d'une entrée à l'autre, sans empiler les écrans de la barre.
 */
export type NavAction = { type: 'none' } | { type: 'dismissTo' | 'push' | 'replace'; href: NavHref };

export function navAction(pathname: string, href: NavHref): NavAction {
  const path = normalize(pathname);
  if (path === href) return { type: 'none' };
  if (href === '/') return { type: 'dismissTo', href };
  if (path === '/' || href === '/sign-in') return { type: 'push', href };
  return { type: 'replace', href };
}
