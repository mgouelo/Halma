// Forme des messages, déduite du français (la source).

import type { fr } from './fr';
import type { ParamNames, ParamValue, Plural } from './types';

export type FrenchMessages = typeof fr;

export type MessageKey = keyof FrenchMessages;

/**
 * Ce que chaque langue doit fournir : exactement les clés du français, un texte
 * là où le français a un texte, un pluriel là où il a un pluriel. Les variables
 * (`{n}`, `{name}`…) sont vérifiées par un test (src/i18n/__tests__).
 */
export type Messages = { readonly [K in MessageKey]: FrenchMessages[K] extends Plural ? Plural : string };

/** Variables attendues par un message, avec leur valeur. */
export type MessageParams<K extends MessageKey> = { readonly [P in ParamNames<FrenchMessages[K]>]: ParamValue };

/** Arguments après la clé : rien pour un message sans variable, sinon l'objet des variables. */
export type MessageArgs<K extends MessageKey> = [ParamNames<FrenchMessages[K]>] extends [never]
  ? []
  : [params: MessageParams<K>];
