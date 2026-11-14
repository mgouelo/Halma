// Mémoire locale « une confirmation d'e-mail est attendue sur cet appareil ».
// Elle permet à l'écran /auth/confirmed de savoir si le lien est ouvert sur
// l'appareil de l'inscription (on ouvre alors la session ici) ou sur un autre
// (on valide seulement, et l'appareil d'origine le détecte tout seul).
// Rien de secret : seulement l'e-mail et le type de confirmation.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'halma.pendingConfirmation';

export interface PendingConfirmation {
  email: string;
  /** Inscription par e-mail, ou invité qui ajoute un e-mail à son compte. */
  kind: 'signup' | 'email_change';
}

export async function rememberPendingConfirmation(pending: PendingConfirmation): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(pending)).catch(() => {});
}

export async function readPendingConfirmation(): Promise<PendingConfirmation | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingConfirmation>;
    if (typeof value.email !== 'string' || (value.kind !== 'signup' && value.kind !== 'email_change')) return null;
    return { email: value.email, kind: value.kind };
  } catch {
    return null;
  }
}

export async function forgetPendingConfirmation(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
