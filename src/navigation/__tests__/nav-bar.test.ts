import { describe, expect, it } from '@jest/globals';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  activeTab,
  navAction,
  navHref,
  navLabel,
  NAV_TABS,
  profileHref,
  SCREENS_WITH_PROFILE_BUTTON,
  SCREENS_WITHOUT_NAV_BAR,
  type NavTab,
} from '../nav-bar';
import { translator } from '@/i18n';

const t = translator('fr');

describe('barre de navigation', () => {
  it('a trois entrées, amis à gauche, accueil au milieu, classements à droite (plus de Profil)', () => {
    expect(NAV_TABS).toEqual(['friends', 'home', 'leaderboard']);
    expect(NAV_TABS.map((tab) => navLabel(t, tab))).toEqual(['Amis', 'Accueil', 'Classements']);
    expect(NAV_TABS.map((tab) => navLabel(translator('es'), tab))).toEqual(['Amigos', 'Inicio', 'Ranking']);
  });

  it('chaque entrée mène à son écran', () => {
    expect(navHref('friends')).toBe('/friends');
    expect(navHref('home')).toBe('/');
    expect(navHref('leaderboard')).toBe('/leaderboard');
  });

  it.each([
    ['/', 'home'],
    ['/online', 'home'],
    ['/ai-setup', 'home'],
    ['/local-setup', 'home'],
    ['/friends', 'friends'],
    ['/friends/', 'friends'],
    ['/leaderboard', 'leaderboard'],
    ['/leaderboard/', 'leaderboard'],
  ] as [string, NavTab][])('entrée active sur %s : %s', (path, tab) => {
    expect(activeTab(path)).toBe(tab);
  });

  it('ne bouge pas quand on touche l’entrée de l’écran affiché', () => {
    expect(navAction('/', '/')).toEqual({ type: 'none' });
    expect(navAction('/friends', '/friends')).toEqual({ type: 'none' });
    expect(navAction('/leaderboard', '/leaderboard')).toEqual({ type: 'none' });
  });

  it('revient à l’accueil sans l’empiler une deuxième fois', () => {
    expect(navAction('/leaderboard', '/')).toEqual({ type: 'dismissTo', href: '/' });
    expect(navAction('/friends', '/')).toEqual({ type: 'dismissTo', href: '/' });
    expect(navAction('/online', '/')).toEqual({ type: 'dismissTo', href: '/' });
  });

  it('empile depuis l’accueil, puis remplace d’une entrée à l’autre', () => {
    expect(navAction('/', '/friends')).toEqual({ type: 'push', href: '/friends' });
    expect(navAction('/', '/leaderboard')).toEqual({ type: 'push', href: '/leaderboard' });
    expect(navAction('/friends', '/leaderboard')).toEqual({ type: 'replace', href: '/leaderboard' });
    expect(navAction('/leaderboard', '/friends')).toEqual({ type: 'replace', href: '/friends' });
    expect(navAction('/online', '/friends')).toEqual({ type: 'replace', href: '/friends' });
  });
});

describe('profil par l’avatar', () => {
  it('connecté (invité compris), l’avatar mène au profil ; sinon, la silhouette mène à la connexion', () => {
    expect(profileHref(true)).toBe('/profile');
    expect(profileHref(false)).toBe('/sign-in');
    expect(t('nav.profile')).toBe('Profil');
  });

  it('le profil n’a pas d’entrée active dans la barre : il n’a pas de barre', () => {
    expect(SCREENS_WITHOUT_NAV_BAR).toContain('profile');
  });

  it.each(SCREENS_WITH_PROFILE_BUTTON)('%s affiche l’avatar en haut à droite', (screen) => {
    const source = readFileSync(join(__dirname, '../../app/(main)', `${screen}.tsx`), 'utf8');
    // L'accueil met le pseudo à côté de l'avatar (ProfileCorner, qui contient ProfileButton).
    expect(source).toContain(screen === 'index' ? '<ProfileCorner />' : '<ProfileButton />');
  });

  it('l’avatar est sur l’accueil, les amis et les classements', () => {
    expect([...SCREENS_WITH_PROFILE_BUTTON].sort()).toEqual(['friends', 'index', 'leaderboard']);
  });

  it.each(['game.tsx', 'room/[id].tsx', 'profile.tsx', 'player/[id].tsx'])('pas d’avatar de profil sur %s', (file) => {
    expect(readFileSync(join(__dirname, '../../app', file), 'utf8')).not.toContain('ProfileButton');
  });
});

describe('écrans avec ou sans la barre', () => {
  const app = join(__dirname, '../../app');
  const routes = (dir: string) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
      .map((entry) => entry.name.replace(/\.tsx$/, ''));

  it.each(['index', 'online', 'friends', 'leaderboard', 'ai-setup', 'local-setup'])(
    '%s est dans le groupe (main) : la barre reste affichée',
    (screen) => {
      expect(existsSync(join(app, '(main)', `${screen}.tsx`))).toBe(true);
      expect(existsSync(join(app, `${screen}.tsx`))).toBe(false);
    },
  );

  it('le groupe (main) ne contient que les écrans avec la barre', () => {
    expect(routes(join(app, '(main)')).filter((name) => name !== '_layout').sort()).toEqual(
      ['ai-setup', 'friends', 'index', 'leaderboard', 'local-setup', 'online'].sort(),
    );
  });

  it.each(['profile', 'player/[id]', 'sign-in', 'sign-up', 'upgrade', 'forgot-password', 'reset-password', 'auth/confirmed', 'avatar', 'credits', 'privacy', 'terms'])(
    '%s est par-dessus le groupe : pas de barre, un bouton « ‹ Retour »',
    (screen) => {
      expect(SCREENS_WITHOUT_NAV_BAR).toContain(screen);
      expect(existsSync(join(app, `${screen}.tsx`))).toBe(true);
      expect(existsSync(join(app, '(main)', `${screen}.tsx`))).toBe(false);
    },
  );

  it('les parties et les rooms restent par-dessus, sans la barre', () => {
    expect(SCREENS_WITHOUT_NAV_BAR).toEqual(expect.arrayContaining(['game', 'room/[id]']));
    expect(existsSync(join(app, 'game.tsx'))).toBe(true);
    expect(existsSync(join(app, 'room', '[id].tsx'))).toBe(true);
    expect(existsSync(join(app, '(main)', 'game.tsx'))).toBe(false);
  });

  it('chaque écran sans barre est déclaré dans la pile principale', () => {
    const layout = readFileSync(join(app, '_layout.tsx'), 'utf8');
    for (const screen of SCREENS_WITHOUT_NAV_BAR) expect(layout).toContain(`name="${screen}"`);
  });
});
