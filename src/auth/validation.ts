// Validation des formulaires d'inscription et de connexion (côté client).
// Les mêmes règles de pseudo sont imposées par la base (voir les migrations
// profiles et pseudo_accents_and_change).

/**
 * Caractères permis : lettres sans accent, « é », « è », « É », « È », chiffres,
 * « _ », « - », « . » et l'apostrophe droite. Même règle que la base.
 */
export const PSEUDO_PATTERN = /^[A-Za-z0-9éèÉÈ._'-]{3,20}$/;
/** Lettres d'un pseudo : é, è, É et È comptent comme des lettres. */
const PSEUDO_LETTER = /[A-Za-zéèÉÈ]/g;
/** Nombre minimal de lettres dans un pseudo, où qu'elles soient. */
export const PSEUDO_MIN_LETTERS = 3;
export const PSEUDO_MIN_LENGTH = 3;
export const PSEUDO_MAX_LENGTH = 20;
export const PASSWORD_MIN_LENGTH = 8;
/** Préfixe réservé aux pseudos générés pour les invités. */
export const GUEST_PSEUDO_PREFIX = 'invite-';

/** Aide affichée sous le champ pseudo (inscription, création de compte, changement). */
export const PSEUDO_HINT =
  '3 à 20 caractères, dont au moins 3 lettres : lettres (accents : é, è, É, È), chiffres, « _ », « - », « . » ou l’apostrophe.';

/** Message d'erreur, ou null si la valeur est valide. */
export type FieldError = string | null;

export function validateEmail(email: string): FieldError {
  const value = email.trim();
  if (!value) return 'Indique ton adresse e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Cette adresse e-mail ne semble pas valide.';
  return null;
}

export function validatePassword(password: string): FieldError {
  if (!password) return 'Indique ton mot de passe.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères.`;
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

/** Vrai si les deux pseudos sont le même aux yeux de l'unicité. */
export function samePseudo(a: string, b: string): boolean {
  return pseudoKey(a) === pseudoKey(b);
}

export function validatePseudo(pseudo: string): FieldError {
  const value = normalizePseudo(pseudo);
  if (!value) return 'Choisis un pseudo.';
  if (value.length < PSEUDO_MIN_LENGTH || value.length > PSEUDO_MAX_LENGTH) {
    return `Le pseudo doit faire entre ${PSEUDO_MIN_LENGTH} et ${PSEUDO_MAX_LENGTH} caractères.`;
  }
  if (!PSEUDO_PATTERN.test(value)) {
    return 'Seulement des lettres (accents permis : é, è, É, È), des chiffres, « _ », « - », « . » et l’apostrophe.';
  }
  if (value.startsWith("'") || value.endsWith("'")) {
    return 'Le pseudo ne peut ni commencer ni finir par une apostrophe.';
  }
  if (value.includes("''")) return 'Le pseudo ne peut pas contenir deux apostrophes de suite.';
  if ((value.match(PSEUDO_LETTER) ?? []).length < PSEUDO_MIN_LETTERS) {
    return `Le pseudo doit contenir au moins ${PSEUDO_MIN_LETTERS} lettres.`;
  }
  if (pseudoKey(value).startsWith(GUEST_PSEUDO_PREFIX)) return 'Ce début de pseudo est réservé aux invités.';
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
    password: fields.password ? null : 'Indique ton mot de passe.',
  };
}

export function hasErrors(errors: Record<string, FieldError>): boolean {
  return Object.values(errors).some((error) => error !== null);
}
