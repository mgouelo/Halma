import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  APP_SCHEME,
  AUTH_LINK_PATHS,
  authLinkFromParams,
  authRedirectUrl,
  linkMatchesPath,
  parseAuthLink,
  stripAuthParams,
} from '../auth-links';
import { linkErrorMessage } from '../errors';
import { translator } from '@/i18n';

describe('adresses de redirection', () => {
  it('le schéma est celui de app.json', () => {
    const app = JSON.parse(readFileSync(join(__dirname, '../../../app.json'), 'utf8'));
    expect(app.expo.scheme).toBe(APP_SCHEME);
  });

  it('mobile : schéma de l’application', () => {
    expect(authRedirectUrl(AUTH_LINK_PATHS.resetPassword, 'native')).toBe('halma://reset-password');
    expect(authRedirectUrl(AUTH_LINK_PATHS.confirmed, 'native')).toBe('halma://auth/confirmed');
  });

  it('mobile, avec l’adresse du site (EXPO_PUBLIC_SITE_URL) : lien https vers le site', () => {
    expect(authRedirectUrl(AUTH_LINK_PATHS.resetPassword, 'native', null, 'https://halma-game.com')).toBe(
      'https://halma-game.com/reset-password',
    );
    expect(authRedirectUrl(AUTH_LINK_PATHS.confirmed, 'native', null, ' https://halma-game.com/ ')).toBe(
      'https://halma-game.com/auth/confirmed',
    );
  });

  it('mobile, adresse du site absente ou vide : schéma de l’application', () => {
    expect(authRedirectUrl(AUTH_LINK_PATHS.resetPassword, 'native', null, null)).toBe('halma://reset-password');
    expect(authRedirectUrl(AUTH_LINK_PATHS.confirmed, 'native', null, '   ')).toBe('halma://auth/confirmed');
  });

  it('web : l’origine de la page passe avant l’adresse du site', () => {
    expect(authRedirectUrl(AUTH_LINK_PATHS.resetPassword, 'web', 'http://localhost:8081', 'https://halma-game.com')).toBe(
      'http://localhost:8081/reset-password',
    );
  });

  it('web : route du site', () => {
    expect(authRedirectUrl(AUTH_LINK_PATHS.resetPassword, 'web', 'https://halma.example')).toBe(
      'https://halma.example/reset-password',
    );
    expect(authRedirectUrl(AUTH_LINK_PATHS.confirmed, 'web', 'http://localhost:8081/')).toBe(
      'http://localhost:8081/auth/confirmed',
    );
  });
});

describe('analyse des liens', () => {
  it('mobile, modèles de docs/emails : jeton à vérifier', () => {
    expect(parseAuthLink('halma://reset-password?token_hash=abc123&type=recovery')).toEqual({
      kind: 'otp',
      tokenHash: 'abc123',
      type: 'recovery',
    });
    expect(parseAuthLink('halma://auth/confirmed?token_hash=h&type=email')).toMatchObject({ kind: 'otp', type: 'email' });
    expect(parseAuthLink('halma://auth/confirmed?token_hash=h&type=email_change')).toMatchObject({ type: 'email_change' });
  });

  it('web : jeton dans la requête', () => {
    expect(parseAuthLink('https://halma.example/reset-password?token_hash=x%2By&type=recovery')).toEqual({
      kind: 'otp',
      tokenHash: 'x+y',
      type: 'recovery',
    });
  });

  it('client de développement (exp://…/--/route)', () => {
    expect(parseAuthLink('exp://192.168.1.2:8081/--/reset-password?token_hash=t&type=recovery')).toMatchObject({
      kind: 'otp',
    });
  });

  it('flux implicite (modèles par défaut) : jetons de session après « # »', () => {
    expect(
      parseAuthLink('halma://reset-password#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=recovery'),
    ).toEqual({ kind: 'session', accessToken: 'a.b.c', refreshToken: 'r1', type: 'recovery' });
    expect(parseAuthLink('https://halma.example/auth/confirmed#access_token=a&refresh_token=r&type=signup')).toMatchObject({
      kind: 'session',
      type: 'signup',
    });
  });

  it('erreur renvoyée par Supabase (lien expiré)', () => {
    expect(
      parseAuthLink(
        'https://halma.example/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({ kind: 'error', code: 'otp_expired', description: 'Email link is invalid or has expired' });
    expect(parseAuthLink('halma://auth/confirmed?error=access_denied')).toMatchObject({ kind: 'error', code: 'access_denied' });
  });

  it.each([
    null,
    '',
    'halma://reset-password',
    'https://halma.example/reset-password?type=recovery',
    'https://halma.example/reset-password?token_hash=x',
    'https://halma.example/reset-password?token_hash=x&type=magiclink',
    // PKCE : non utilisé (le code ne s'échange que sur l'appareil qui a fait la demande).
    'https://halma.example/reset-password?code=4c2f',
    'halma://reset-password#access_token=a',
  ])('lien sans jeton utilisable : %s', (url) => {
    expect(parseAuthLink(url)).toEqual({ kind: 'none' });
  });

  it('à partir des paramètres de route', () => {
    expect(authLinkFromParams({ token_hash: 'abc', type: 'recovery' })).toEqual({
      kind: 'otp',
      tokenHash: 'abc',
      type: 'recovery',
    });
    expect(authLinkFromParams({ token_hash: ['a', 'b'] })).toEqual({ kind: 'none' });
    expect(authLinkFromParams({})).toEqual({ kind: 'none' });
  });

  it('retire les jetons de l’adresse', () => {
    expect(stripAuthParams('https://h.example/reset-password?token_hash=x&type=recovery#a=b')).toBe(
      'https://h.example/reset-password',
    );
  });

  it('reconnaît la route du lien', () => {
    expect(linkMatchesPath('halma://reset-password?token_hash=x', '/reset-password')).toBe(true);
    expect(linkMatchesPath('halma://auth/confirmed#access_token=a', '/auth/confirmed')).toBe(true);
    expect(linkMatchesPath('https://h.example/auth/confirmed/', '/auth/confirmed')).toBe(true);
    expect(linkMatchesPath('exp://1.2.3.4:8081/--/reset-password', '/reset-password')).toBe(true);
    expect(linkMatchesPath('halma://auth/confirmed?token_hash=x', '/reset-password')).toBe(false);
  });

  it('messages des liens inutilisables', () => {
    const t = translator('fr');
    const expired = 'Ce lien a expiré ou a déjà servi.';
    const invalid = 'Ce lien n’est pas valide. Ouvre le dernier e-mail reçu, ou demande un nouveau lien.';
    expect(linkErrorMessage(t, 'otp_expired')).toBe(expired);
    expect(linkErrorMessage(t, 'access_denied')).toBe(expired);
    expect(linkErrorMessage(t, null)).toBe(invalid);
    expect(linkErrorMessage(t, 'bad_jwt')).toBe(invalid);
    expect(linkErrorMessage(translator('en'), 'otp_expired')).toBe('This link has expired or has already been used.');
  });
});
