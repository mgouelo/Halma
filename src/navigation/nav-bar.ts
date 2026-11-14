// Barre de navigation du bas : quelle entrée est active, et comment y aller.
// Logique pure (sans React), testée à part ; l'affichage est dans
// src/components/nav-bar/.

export type NavTab = 'friends' | 'home' | 'leaderboard';

export type NavHref = '/' | '/friends' | '/leaderboard';

/** Entrées de la barre, de gauche à droite. */
export const NAV_TABS: readonly NavTab[] = ['friends', 'home', 'leaderboard'];

export const NAV_LABELS: Record<NavTab, string> = {
  friends: 'Amis',
  home: 'Accueil',
  leaderboard: 'Classements',
};

/** Écran d'arrivée de chaque entrée (le même, connecté ou non). */
export function navHref(tab: NavTab): NavHref {
  switch (tab) {
    case 'home':
      return '/';
    case 'friends':
      return '/friends';
    case 'leaderboard':
      return '/leaderboard';
  }
}

/**
 * Le profil ne fait plus partie de la barre : il s'ouvre en touchant son avatar,
 * en haut à droite des écrans de la barre. Non connecté, la silhouette mène à
 * la connexion ; connecté (invité compris), à la page de profil. Les deux
 * s'ouvrent par-dessus (`push`) : leur « ‹ Retour » revient là où l'on était.
 */
export function profileHref(signedIn: boolean): '/profile' | '/sign-in' {
  return signedIn ? '/profile' : '/sign-in';
}

/** Libellé d'accessibilité du bouton de profil (avatar en haut à droite). */
export const PROFILE_BUTTON_LABEL = 'Profil';

/** Écrans de la barre qui montrent l'avatar du joueur en haut à droite. */
export const SCREENS_WITH_PROFILE_BUTTON: readonly string[] = ['index', 'friends', 'leaderboard'];

/**
 * Écrans qui ne montrent pas la barre : ils sont affichés par-dessus le groupe
 * (main) et n'ont qu'un bouton « ‹ Retour ». C'est le cas des parties, des
 * rooms, du profil, des écrans de compte (connexion, inscription, création de
 * compte), de l'éditeur d'avatar et des pages d'information.
 */
export const SCREENS_WITHOUT_NAV_BAR: readonly string[] = [
  'game',
  'room/[id]',
  'matchmaking',
  'profile',
  'sign-in',
  'sign-up',
  'upgrade',
  'forgot-password',
  'reset-password',
  'auth/confirmed',
  'avatar',
  'credits',
  'privacy',
  'terms',
];

function normalize(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

/**
 * Entrée active pour l'écran affiché : amis et classements sont chacun le seul
 * écran de leur entrée ; les autres écrans de la barre (jouer en ligne, réglage
 * d'une partie contre l'IA ou entre amis) partent de l'accueil.
 */
export function activeTab(pathname: string): NavTab {
  const path = normalize(pathname);
  if (path === '/friends') return 'friends';
  if (path === '/leaderboard') return 'leaderboard';
  return 'home';
}

/**
 * Déplacement à faire quand on touche une entrée :
 * - `none` : on y est déjà ;
 * - `dismissTo` : revenir en arrière jusqu'à l'accueil, toujours au fond de la pile ;
 * - `push` : depuis l'accueil ;
 * - `replace` : d'une entrée à l'autre, sans empiler les écrans de la barre.
 */
export type NavAction = { type: 'none' } | { type: 'dismissTo' | 'push' | 'replace'; href: NavHref };

export function navAction(pathname: string, href: NavHref): NavAction {
  const path = normalize(pathname);
  if (path === href) return { type: 'none' };
  if (href === '/') return { type: 'dismissTo', href };
  if (path === '/') return { type: 'push', href };
  return { type: 'replace', href };
}
