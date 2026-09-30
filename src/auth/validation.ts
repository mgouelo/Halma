// Validation des formulaires d'inscription et de connexion (côté client).
// Les mêmes règles de pseudo sont imposées par la base (voir la migration profiles).

/**
 * Lettres de tous alphabets (accents compris), chiffres décimaux, « _ » et « - » :
 * mêmes classes que [[:alpha:]] et [[:digit:]] avec la collation ICU côté base.
 */
export const PSEUDO_PATTERN = /^[\p{L}\p{Nd}_-]{3,20}$/u;
export const PASSWORD_MIN_LENGTH = 8;
/** Préfixe réservé aux pseudos générés pour les invités. */
export const GUEST_PSEUDO_PREFIX = 'invite-';

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
 * Forme enregistrée d'un pseudo : sans espaces autour, normalisée en NFC (un « é »
 * tapé comme « e » + accent combinant devient le caractère « é »), comme en base.
 */
export function normalizePseudo(pseudo: string): string {
  return pseudo.trim().normalize('NFC');
}

export function validatePseudo(pseudo: string): FieldError {
  const value = normalizePseudo(pseudo);
  if (!value) return 'Choisis un pseudo.';
  const length = [...value].length; // en caractères, pas en unités UTF-16
  if (length < 3 || length > 20) return 'Le pseudo doit faire entre 3 et 20 caractères.';
  if (!PSEUDO_PATTERN.test(value)) {
    return 'Lettres (accents compris), chiffres, « _ » et « - » seulement.';
  }
  if (value.toLowerCase().startsWith(GUEST_PSEUDO_PREFIX)) return 'Ce début de pseudo est réservé aux invités.';
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
