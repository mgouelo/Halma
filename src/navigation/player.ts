// Profil d'un joueur, ouvert en touchant sa ligne (classements, amis, demandes
// reçues). Logique pure, testée à part.

/** Écran du profil d'un joueur : le sien (`/profile`) ou celui d'un autre (`/player/[id]`). */
export type PlayerHref = '/profile' | { pathname: '/player/[id]'; params: { id: string } };

/**
 * Où mène une ligne : son propre profil pour sa propre ligne (« C'est toi »),
 * le profil public d'un autre joueur sinon ; rien sans identifiant (serveur pas
 * encore à jour) ni sans joueur connecté.
 */
export function playerHref(userId: string | null | undefined, myId: string | null | undefined): PlayerHref | null {
  if (!userId || !myId) return null;
  return userId === myId ? '/profile' : { pathname: '/player/[id]', params: { id: userId } };
}

/** Libellé d'accessibilité d'une ligne qui ouvre un profil. */
export function playerProfileLabel(pseudo: string): string {
  return `Profil de ${pseudo}`;
}
