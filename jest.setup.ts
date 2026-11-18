// Environnement des tests : l'appareil est en français, la langue de référence
// de l'application. Les tests qui vérifient une autre langue la choisissent
// eux-mêmes (`translator('en')`, ou `applyLanguage('de')` pour un écran).

import { jest } from '@jest/globals';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr', languageTag: 'fr-FR' }],
}));
