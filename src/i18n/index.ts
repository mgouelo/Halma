// Traductions de l'application (fr, en, de, es). Le français est la source :
// voir README, section « Traductions ».

export type { MessageArgs, MessageKey, Messages } from './messages';
export {
  chooseLanguage,
  detectLanguage,
  getLanguage,
  getLanguagePreference,
  loadLanguagePreference,
  refreshDeviceLanguage,
} from './language';
export { rich, useLanguage, useLanguageReady, useT } from './react';
export {
  formatDay,
  formatNumber,
  formatOrdinal,
  formatTime,
  hasMessage,
  isMsg,
  msg,
  pluralForm,
  translator,
  type Msg,
  type Translator,
} from './translate';
export {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_LOCALES,
  LANGUAGE_NAMES,
  LANGUAGES,
  type Language,
  type Plural,
} from './types';
