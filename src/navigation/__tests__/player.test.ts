import { describe, expect, it } from '@jest/globals';

import { playerHref, playerProfileLabel } from '../player';
import { translator } from '@/i18n';

describe('profil d’un joueur depuis une ligne', () => {
  it('un autre joueur : son profil public', () => {
    expect(playerHref('u-zoe', 'me')).toEqual({ pathname: '/player/[id]', params: { id: 'u-zoe' } });
  });

  it('sa propre ligne (« C’est toi ») : son profil', () => {
    expect(playerHref('me', 'me')).toBe('/profile');
  });

  it('sans identifiant ou sans joueur connecté : rien à ouvrir', () => {
    expect(playerHref(null, 'me')).toBeNull();
    expect(playerHref(undefined, 'me')).toBeNull();
    expect(playerHref('u-zoe', null)).toBeNull();
  });

  it('libellé d’accessibilité', () => {
    expect(playerProfileLabel(translator('fr'), 'Zoé')).toBe('Profil de Zoé');
    expect(playerProfileLabel(translator('en'), 'Zoé')).toBe('Zoé’s profile');
  });
});
