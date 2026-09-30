import { describe, expect, it } from '@jest/globals';

import {
  hasErrors,
  validateEmail,
  validatePassword,
  validatePseudo,
  validateSignIn,
  validateSignUp,
} from '../validation';

describe('validation', () => {
  it('accepte un e-mail valide, même entouré d’espaces', () => {
    expect(validateEmail('  alice@example.com ')).toBeNull();
  });

  it.each(['', 'alice', 'alice@', 'alice@example', 'a b@example.com'])('refuse l’e-mail « %s »', (email) => {
    expect(validateEmail(email)).not.toBeNull();
  });

  it('exige un mot de passe d’au moins 8 caractères à l’inscription', () => {
    expect(validatePassword('')).not.toBeNull();
    expect(validatePassword('1234567')).not.toBeNull();
    expect(validatePassword('12345678')).toBeNull();
  });

  it.each(['Alice', 'bob_42', 'x-y-z', 'abc', 'a'.repeat(20), 'jean.dupont', 'J.D-2_b', ' Alice '])(
    'accepte le pseudo « %s »',
    (pseudo) => {
      expect(validatePseudo(pseudo)).toBeNull();
    },
  );

  it.each(['', 'ab', 'a'.repeat(21), 'avec espace', 'Élodie', 'Zoë', 'point!', 'a,b', 'emoji😀', 'invite-abc', 'INVITE-x1'])(
    'refuse le pseudo « %s »',
    (pseudo) => {
      expect(validatePseudo(pseudo)).not.toBeNull();
    },
  );

  it('valide tout un formulaire', () => {
    expect(hasErrors(validateSignUp({ pseudo: 'Alice', email: 'a@b.fr', password: '12345678' }))).toBe(false);
    const errors = validateSignUp({ pseudo: '', email: 'a@b.fr', password: '123' });
    expect(errors.pseudo).not.toBeNull();
    expect(errors.email).toBeNull();
    expect(errors.password).not.toBeNull();
  });

  it('à la connexion, ne vérifie pas la longueur du mot de passe', () => {
    expect(validateSignIn({ email: 'a@b.fr', password: '123' })).toEqual({ email: null, password: null });
    expect(validateSignIn({ email: 'a@b.fr', password: '' }).password).not.toBeNull();
  });
});
