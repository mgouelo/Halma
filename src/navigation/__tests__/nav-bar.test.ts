import { describe, expect, it } from '@jest/globals';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  activeTab,
  navAction,
  navHref,
  NAV_LABELS,
  NAV_TABS,
  SCREENS_WITHOUT_NAV_BAR,
  type NavTab,
} from '../nav-bar';

describe('barre de navigation', () => {
  it('a trois entrées, profil à gauche, accueil au milieu, classements à droite', () => {
    expect(NAV_TABS).toEqual(['profile', 'home', 'leaderboard']);
    expect(NAV_TABS.map((tab) => NAV_LABELS[tab])).toEqual(['Profil', 'Accueil', 'Classements']);
  });

  it('mène à la connexion depuis « Profil » quand on n’est pas connecté', () => {
    expect(navHref('profile', true)).toBe('/profile');
    expect(navHref('profile', false)).toBe('/sign-in');
    expect(navHref('home', false)).toBe('/');
    expect(navHref('leaderboard', false)).toBe('/leaderboard');
  });

  it.each([
    ['/', 'home'],
    ['/online', 'home'],
    ['/ai-setup', 'home'],
    ['/local-setup', 'home'],
    ['/profile', 'profile'],
    ['/profile/', 'profile'],
    ['/leaderboard', 'leaderboard'],
    ['/leaderboard/', 'leaderboard'],
  ] as [string, NavTab][])('entrée active sur %s : %s', (path, tab) => {
    expect(activeTab(path)).toBe(tab);
  });

  it('ne bouge pas quand on touche l’entrée de l’écran affiché', () => {
    expect(navAction('/', '/')).toEqual({ type: 'none' });
    expect(navAction('/leaderboard', '/leaderboard')).toEqual({ type: 'none' });
  });

  it('revient à l’accueil sans l’empiler une deuxième fois', () => {
    expect(navAction('/leaderboard', '/')).toEqual({ type: 'dismissTo', href: '/' });
    expect(navAction('/online', '/')).toEqual({ type: 'dismissTo', href: '/' });
  });

  it('empile depuis l’accueil, puis remplace d’une entrée à l’autre', () => {
    expect(navAction('/', '/leaderboard')).toEqual({ type: 'push', href: '/leaderboard' });
    expect(navAction('/profile', '/leaderboard')).toEqual({ type: 'replace', href: '/leaderboard' });
    expect(navAction('/online', '/profile')).toEqual({ type: 'replace', href: '/profile' });
  });

  it('ouvre la connexion par-dessus l’écran affiché (sans barre : son retour revient là où l’on était)', () => {
    expect(navAction('/', '/sign-in')).toEqual({ type: 'push', href: '/sign-in' });
    expect(navAction('/leaderboard', '/sign-in')).toEqual({ type: 'push', href: '/sign-in' });
    expect(navAction('/profile', '/sign-in')).toEqual({ type: 'push', href: '/sign-in' });
  });

  it('un invité (connecté) va sur sa page de profil, pas sur la connexion', () => {
    const href = navHref('profile', true);
    expect(href).toBe('/profile');
    expect(navAction('/leaderboard', href)).toEqual({ type: 'replace', href: '/profile' });
    expect(activeTab(href)).toBe('profile');
  });
});

describe('écrans avec ou sans la barre', () => {
  const app = join(__dirname, '../../app');
  const routes = (dir: string) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
      .map((entry) => entry.name.replace(/\.tsx$/, ''));

  it.each(['index', 'online', 'profile', 'leaderboard', 'ai-setup', 'local-setup'])(
    '%s est dans le groupe (main) : la barre reste affichée',
    (screen) => {
      expect(existsSync(join(app, '(main)', `${screen}.tsx`))).toBe(true);
      expect(existsSync(join(app, `${screen}.tsx`))).toBe(false);
    },
  );

  it('le groupe (main) ne contient que les écrans avec la barre', () => {
    expect(routes(join(app, '(main)')).filter((name) => name !== '_layout').sort()).toEqual(
      ['ai-setup', 'index', 'leaderboard', 'local-setup', 'online', 'profile'].sort(),
    );
  });

  it.each(['sign-in', 'sign-up', 'upgrade', 'avatar', 'credits', 'privacy', 'terms'])(
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const layout = require('node:fs').readFileSync(join(app, '_layout.tsx'), 'utf8') as string;
    for (const screen of SCREENS_WITHOUT_NAV_BAR) expect(layout).toContain(`name="${screen}"`);
  });
});
