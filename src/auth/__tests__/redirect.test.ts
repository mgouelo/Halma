// Adresse de redirection des e-mails selon EXPO_PUBLIC_SITE_URL (les tests tournent comme sur mobile).

import { afterEach, describe, expect, it } from '@jest/globals';
import { Platform } from 'react-native';

import { redirectUrl, siteUrl } from '../redirect';

const initial = process.env.EXPO_PUBLIC_SITE_URL;

afterEach(() => {
  if (initial === undefined) delete process.env.EXPO_PUBLIC_SITE_URL;
  else process.env.EXPO_PUBLIC_SITE_URL = initial;
});

describe('redirectUrl (mobile)', () => {
  it('les tests tournent comme sur mobile', () => {
    expect(Platform.OS).not.toBe('web');
  });

  it('variable définie : lien https vers le site', () => {
    process.env.EXPO_PUBLIC_SITE_URL = 'https://halma-game.com';
    expect(siteUrl()).toBe('https://halma-game.com');
    expect(redirectUrl('/reset-password')).toBe('https://halma-game.com/reset-password');
    expect(redirectUrl('/auth/confirmed')).toBe('https://halma-game.com/auth/confirmed');
  });

  it('variable absente ou vide : schéma de l’application (développement local)', () => {
    delete process.env.EXPO_PUBLIC_SITE_URL;
    expect(siteUrl()).toBeNull();
    expect(redirectUrl('/reset-password')).toBe('halma://reset-password');
    process.env.EXPO_PUBLIC_SITE_URL = '';
    expect(redirectUrl('/auth/confirmed')).toBe('halma://auth/confirmed');
  });
});
