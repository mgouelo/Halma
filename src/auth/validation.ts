// Validation des formulaires d'inscription et de connexion (côté client).
// Les mêmes règles de pseudo sont imposées par la base (voir les migrations
// profiles et pseudo_accents_and_change). Les erreurs sont des messages à
// traduire au moment de l'affichage (`t.msg(error)`).

import { msg, type Msg } from '@/i18n';

/**
 * Caractères permis : lettres sans accent, « é », « è », « É », « È », chiffres,
 * « _ », « - », « . » et l'apostrophe droite. Même règle que la base.
 */
const PSEUDO_PATTERN = /^[A-Za-z0-9éèÉÈ._'-]{3,20}$/;
/** Lettres d'un pseudo : é, è, É et È comptent comme des lettres. */
const PSEUDO_LETTER = /[A-Za-zéèÉÈ]/g;
/** Nombre minimal de lettres dans un pseudo, où qu'elles soient. */
const PSEUDO_MIN_LETTERS = 3;
const PSEUDO_MIN_LENGTH = 3;
export const PSEUDO_MAX_LENGTH = 20;
export const PASSWORD_MIN_LENGTH = 8;
/** Délai minimal entre deux changements de pseudo (même valeur que change_pseudo côté base). */
export const PSEUDO_CHANGE_DELAY_DAYS = 7;
/** Préfixe réservé aux pseudos générés pour les invités. */
export const GUEST_PSEUDO_PREFIX = 'invite-';

/** Message d'erreur à traduire, ou null si la valeur est valide. */
export type FieldError = Msg | null;

export function validateEmail(email: string): FieldError {
  const value = email.trim();
  if (!value) return msg('validation.emailRequired');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return msg('validation.emailInvalid');
  return null;
}

export function validatePassword(password: string): FieldError {
  if (!password) return msg('validation.passwordRequired');
  if (password.length < PASSWORD_MIN_LENGTH) {
    return msg('validation.passwordTooShort', { n: PASSWORD_MIN_LENGTH });
  }
  return null;
}

/**
 * Normalisation pendant la saisie : unicode NFC (un clavier peut envoyer « e »
 * suivi d'un accent séparé) et apostrophe courbe « ’ » convertie en « ' ».
 * Les espaces autour restent, pour ne pas gêner la frappe.
 */
export function normalizePseudoInput(pseudo: string): string {
  const composed = typeof pseudo.normalize === 'function' ? pseudo.normalize('NFC') : pseudo;
  return composed.replace(/\u2019/g, "'");
}

/** Forme enregistrée d'un pseudo : normalisée, sans espaces autour (comme clean_pseudo côté base). */
export function normalizePseudo(pseudo: string): string {
  return normalizePseudoInput(pseudo.trim());
}

const KEY_MAP: Record<string, string> = { é: 'e', è: 'e', É: 'e', È: 'e' };

/**
 * Clé d'unicité d'un pseudo, comme pseudo_key() côté base : sans casse, sans
 * accents ni apostrophes. « Zoé » et « zoe », « Élodie » et « elodie »,
 * « Dan' » et « Dan » sont le même pseudo.
 */
export function pseudoKey(pseudo: string): string {
  return normalizePseudo(pseudo)
    .replace(/[éèÉÈ]/g, (letter) => KEY_MAP[letter])
    .replace(/'/g, '')
    .replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

export function validatePseudo(pseudo: string): FieldError {
  const value = normalizePseudo(pseudo);
  if (!value) return msg('validation.pseudoRequired');
  if (value.length < PSEUDO_MIN_LENGTH || value.length > PSEUDO_MAX_LENGTH) {
    return msg('validation.pseudoLength', { min: PSEUDO_MIN_LENGTH, max: PSEUDO_MAX_LENGTH });
  }
  if (!PSEUDO_PATTERN.test(value)) {
    return msg('validation.pseudoChars');
  }
  if (value.startsWith("'") || value.endsWith("'")) {
    return msg('validation.pseudoApostropheEdge');
  }
  if (value.includes("''")) return msg('validation.pseudoDoubleApostrophe');
  if ((value.match(PSEUDO_LETTER) ?? []).length < PSEUDO_MIN_LETTERS) {
    return msg('validation.pseudoLetters', { n: PSEUDO_MIN_LETTERS });
  }
  if (pseudoKey(value).startsWith(GUEST_PSEUDO_PREFIX)) return msg('validation.pseudoReserved');
  return null;
}

export interface SignUpFields {
  pseudo: string;
  email: string;
  password: string;
}

export interface SignInFields {
  email: string;
  password: string;
}

export function validateSignUp(fields: SignUpFields): Record<keyof SignUpFields, FieldError> {
  return {
    pseudo: validatePseudo(fields.pseudo),
    email: validateEmail(fields.email),
    password: validatePassword(fields.password),
  };
}

export function validateSignIn(fields: SignInFields): Record<keyof SignInFields, FieldError> {
  return {
    email: validateEmail(fields.email),
    // À la connexion, on ne rappelle pas la longueur minimale : le serveur tranche.
    password: fields.password ? null : msg('validation.passwordRequired'),
  };
}

export interface NewPasswordFields {
  password: string;
  confirmation: string;
}

/** Nouveau mot de passe (réinitialisation) : longueur minimale et confirmation identique. */
export function validateNewPassword(fields: NewPasswordFields): Record<keyof NewPasswordFields, FieldError> {
  return {
    password: validatePassword(fields.password),
    confirmation: !fields.confirmation
      ? msg('validation.confirmRequired')
      : fields.confirmation !== fields.password
        ? msg('validation.confirmMismatch')
        : null,
  };
}

export function hasErrors(errors: Record<string, FieldError>): boolean {
  return Object.values(errors).some((error) => error !== null);
}
