// Langue active : préférence enregistrée par le joueur, sinon langue de
// l'appareil (ou du navigateur), sinon le français. Un simple état partagé,
// suivi par `useLanguage()` ; le choix est gardé avec AsyncStorage.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

import { DEFAULT_LANGUAGE, isLanguage, type Language } from './types';

/** Clé AsyncStorage (localStorage sur le web) de la langue choisie. */
export const LANGUAGE_STORAGE_KEY = 'halma.language';

/**
 * Langue à utiliser : la préférence enregistrée si elle est connue, sinon la
 * première langue de l'appareil que l'application sait parler (dans l'ordre de
 * préférence de l'appareil), sinon le français.
 */
export function detectLanguage(stored: string | null | undefined, deviceLanguages: readonly string[]): Language {
  if (isLanguage(stored)) return stored;
  for (const tag of deviceLanguages) {
    const code = tag.toLowerCase().split(/[-_]/)[0];
    if (isLanguage(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}

/** Langues de l'appareil ou du navigateur, par ordre de préférence (vide pendant le rendu statique). */
function deviceLanguages(): string[] {
  if (Platform.OS === 'web' && typeof window === 'undefined') return [];
  try {
    return getLocales().map((locale) => locale.languageCode ?? locale.languageTag);
  } catch {
    return [];
  }
}

/** Web : la préférence se lit tout de suite (localStorage), sans attendre. */
function readStoredSync(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

const initialStored = readStoredSync();
let current: Language = detectLanguage(initialStored, deviceLanguages());
let preference: Language | null = isLanguage(initialStored) ? initialStored : null;
/** Vrai une fois la préférence relue (immédiat sur le web). */
// Sur mobile, AsyncStorage est asynchrone : l'écran de démarrage attend
// `ready` pour ne pas afficher la langue de l'appareil puis basculer.
let ready = Platform.OS === 'web';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getLanguage(): Language {
  return current;
}

/** Langue choisie explicitement par le joueur, ou null s'il suit celle de l'appareil. */
export function getLanguagePreference(): Language | null {
  return preference;
}

export function isLanguageReady(): boolean {
  return ready;
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Change la langue active tout de suite (sans rien enregistrer). */
export function applyLanguage(language: Language) {
  if (current === language) return;
  current = language;
  emit();
}

/** Choix du joueur : appliqué tout de suite et enregistré sur l'appareil. */
export async function chooseLanguage(language: Language): Promise<void> {
  preference = language;
  applyLanguage(language);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Stockage indisponible (navigation privée…) : le choix vaut pour la session.
  }
}

let loading: Promise<void> | null = null;

/** Relit la préférence enregistrée (une fois) ; sans préférence, la langue de l'appareil reste. */
export function loadLanguagePreference(): Promise<void> {
  loading ??= (async () => {
    let stored: string | null = null;
    try {
      stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      stored = null;
    }
    // Un choix fait entre-temps l'emporte sur la valeur relue.
    if (preference === null && isLanguage(stored)) {
      preference = stored;
      applyLanguage(stored);
    }
    if (!ready) {
      ready = true;
      emit();
    }
  })();
  return loading;
}

/** Langue de l'appareil revue au retour au premier plan (Android permet de la changer sans relancer). */
export function refreshDeviceLanguage() {
  if (preference === null) applyLanguage(detectLanguage(null, deviceLanguages()));
}

/** Tests : revient à l'état de départ, avec une langue donnée. */
export function resetLanguageForTests(language: Language = DEFAULT_LANGUAGE) {
  current = language;
  preference = null;
  ready = true;
  loading = null;
  emit();
}
