import { describe, expect, it } from '@jest/globals';

import { activeTab, navAction, navHref, NAV_LABELS, NAV_TABS, type NavTab } from '../nav-bar';

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
    ['/profile', 'profile'],
    ['/avatar', 'profile'],
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

  it('revient au profil depuis l’éditeur d’avatar', () => {
    expect(navAction('/avatar', '/profile')).toEqual({ type: 'dismissTo', href: '/profile' });
  });

  it('ouvre la connexion par-dessus l’écran affiché', () => {
    expect(navAction('/leaderboard', '/sign-in')).toEqual({ type: 'push', href: '/sign-in' });
  });
});
