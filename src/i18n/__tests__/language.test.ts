import { afterEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  chooseLanguage,
  detectLanguage,
  getLanguage,
  getLanguagePreference,
  isLanguageReady,
  LANGUAGE_STORAGE_KEY,
  loadLanguagePreference,
  resetLanguageForTests,
} from '../language';

afterEach(async () => {
  resetLanguageForTests('fr');
  await AsyncStorage.clear();
});

describe('choix de la langue', () => {
  it('la préférence enregistrée passe avant la langue de l’appareil', () => {
    expect(detectLanguage('de', ['en-US', 'fr-FR'])).toBe('de');
  });

  it('sans préférence : la première langue de l’appareil que l’application parle', () => {
    expect(detectLanguage(null, ['en-GB'])).toBe('en');
    expect(detectLanguage(null, ['es-MX', 'fr-FR'])).toBe('es');
    expect(detectLanguage(null, ['it-IT', 'de-AT'])).toBe('de');
    expect(detectLanguage(undefined, ['de_CH'])).toBe('de');
  });

  it('appareil dans une langue non prise en charge : français', () => {
    expect(detectLanguage(null, ['it-IT', 'ja-JP'])).toBe('fr');
    expect(detectLanguage(null, [])).toBe('fr');
  });

  it('une préférence illisible est ignorée', () => {
    expect(detectLanguage('klingon', ['en-US'])).toBe('en');
    expect(detectLanguage('', ['es-ES'])).toBe('es');
  });

  it('l’environnement de test est en français (appareil simulé en fr-FR)', () => {
    expect(getLanguage()).toBe('fr');
  });
});

describe('préférence enregistrée', () => {
  it('le choix du joueur s’applique tout de suite et reste enregistré sur l’appareil', async () => {
    await chooseLanguage('es');
    expect(getLanguage()).toBe('es');
    expect(getLanguagePreference()).toBe('es');
    await expect(AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).resolves.toBe('es');
  });

  it('au démarrage, la préférence relue remplace la langue de l’appareil', async () => {
    resetLanguageForTests('fr');
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    await loadLanguagePreference();
    expect(getLanguage()).toBe('de');
    expect(isLanguageReady()).toBe(true);
  });

  it('au démarrage, une valeur enregistrée inconnue laisse la langue de l’appareil', async () => {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'xx');
    await loadLanguagePreference();
    expect(getLanguage()).toBe('fr');
    expect(getLanguagePreference()).toBeNull();
  });

  it('un stockage indisponible ne bloque rien', async () => {
    const original = AsyncStorage.getItem;
    AsyncStorage.getItem = () => Promise.reject(new Error('stockage bloqué'));
    try {
      await loadLanguagePreference();
      expect(getLanguage()).toBe('fr');
      expect(isLanguageReady()).toBe(true);
    } finally {
      AsyncStorage.getItem = original;
    }
  });
});
