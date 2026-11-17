import { describe, expect, it } from '@jest/globals';

import { isPhoneUserAgent, OPEN_APP_URL } from '../open-app';

describe('navigateur d’un téléphone', () => {
  it.each([
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/321.0 Mobile/15E148 Safari/604.1',
  ])('téléphone : %s', (ua) => {
    expect(isPhoneUserAgent(ua)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
    '',
  ])('ordinateur : %s', (ua) => {
    expect(isPhoneUserAgent(ua)).toBe(false);
  });

  it('ouvre l’application par son schéma', () => {
    expect(OPEN_APP_URL).toBe('halma://');
  });
});
