import { describe, expect, it } from '@jest/globals';

import {
  hasErrors,
  normalizePseudo,
  normalizePseudoInput,
  pseudoKey,
  samePseudo,
  validateEmail,
  validatePassword,
  validatePseudo,
  validateSignIn,
  validateNewPassword,
  validateSignUp,
} from '../validation';

import { translator, type Msg } from '@/i18n';

const t = translator('fr');
/** Texte français d'une erreur de champ (null si valide). */
const fr = (error: Msg | null) => (error ? t.msg(error) : null);

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

  it.each(['Alice', 'bob_42', 'x-y-z', 'abc', 'a'.repeat(20), 'jean.dupont', 'J.D-2_b', ' Alice ', 'a1-b2.c3', '007bond'])(
    'accepte le pseudo « %s »',
    (pseudo) => {
      expect(validatePseudo(pseudo)).toBeNull();
    },
  );

  it.each(['', 'ab', 'a'.repeat(21), 'avec espace', 'Zoë', 'point!', 'a,b', 'emoji😀', 'invite-abc', 'INVITE-x1'])(
    'refuse le pseudo « %s »',
    (pseudo) => {
      expect(validatePseudo(pseudo)).not.toBeNull();
    },
  );

  it.each(['...', '---', '12345', 'a1b2', 'x.y.1', '__a_b__'])('exige au moins 3 lettres : refuse « %s »', (pseudo) => {
    expect(fr(validatePseudo(pseudo))).toBe('Le pseudo doit contenir au moins 3 lettres.');
  });

  describe('é, è, É, È et apostrophe', () => {
    it.each(['Zoé', 'Élodie', 'Hélène', 'ÈÉée', 'éèÉ', "d'Artagnan", "L'Été", "Dan's", "O'Neil-2", "a'b'c", 'Zoe\u0301', 'd\u2019Artagnan'])(
      'accepte « %s »',
      (pseudo) => {
        expect(validatePseudo(pseudo)).toBeNull();
      },
    );

    it.each(['Zoë', 'Zoê', 'Ève-à', 'Ça va', 'naïve', 'Ñandú', 'Dan‘s', 'Dan`s', 'Dan"s'])('refuse les autres accents et signes : « %s »', (pseudo) => {
      expect(fr(validatePseudo(pseudo))).toBe(
        'Seulement des lettres (accents permis : é, è, É, È), des chiffres, « _ », « - », « . » et l’apostrophe.',
      );
    });

    it.each(["'Dan", "Dan'", "'Dan'", " Dan' ", 'Dan\u2019'])('refuse l’apostrophe au début ou à la fin : « %s »', (pseudo) => {
      expect(fr(validatePseudo(pseudo))).toBe('Le pseudo ne peut ni commencer ni finir par une apostrophe.');
    });

    it.each(["Da''n", 'Da\u2019\u2019n', "Da'\u2019n"])('refuse l’apostrophe doublée : « %s »', (pseudo) => {
      expect(fr(validatePseudo(pseudo))).toBe('Le pseudo ne peut pas contenir deux apostrophes de suite.');
    });

    it('compte é, è, É et È comme des lettres, pas l’apostrophe', () => {
      expect(fr(validatePseudo('é.è'))).toBe('Le pseudo doit contenir au moins 3 lettres.');
      expect(fr(validatePseudo("a'b"))).toBe('Le pseudo doit contenir au moins 3 lettres.');
      expect(validatePseudo('é1è2É')).toBeNull();
    });

    it('refuse aussi le préfixe des invités écrit avec un accent ou une apostrophe', () => {
      for (const pseudo of ['invité-x', 'INVITÉ-bob', "invi'te-x"]) {
        expect(fr(validatePseudo(pseudo))).toBe('Ce début de pseudo est réservé aux invités.');
      }
    });
  });

  describe('normalisation', () => {
    it('recompose les accents (NFC) et convertit l’apostrophe courbe pendant la saisie', () => {
      expect(normalizePseudoInput('Zoe\u0301')).toBe('Zoé');
      expect(normalizePseudoInput('E\u0300ve')).toBe('Ève');
      expect(normalizePseudoInput('d\u2019Artagnan')).toBe("d'Artagnan");
      expect(normalizePseudoInput(' Zoé ')).toBe(' Zoé '); // les espaces restent pendant la frappe
    });

    it('retire en plus les espaces autour pour l’enregistrement', () => {
      expect(normalizePseudo('  d\u2019Arc ')).toBe("d'Arc");
      expect(normalizePseudo(' Zoe\u0301 ')).toBe('Zoé');
    });
  });

  describe('unicité', () => {
    it.each([
      ['Zoé', 'Zoe'],
      ['Zoé', 'ZOE'],
      ['Zoè', 'zoé'],
      ['Élodie', 'elodie'],
      ['ÉLODIE', 'Èlodie'],
      ["Dan'", 'Dan'],
      ["d'Artagnan", 'Dartagnan'],
      ['Jean.Dupont', 'jean.DUPONT'],
      ['Zoe\u0301', 'zoé'],
    ])('« %s » et « %s » sont le même pseudo', (a, b) => {
      expect(samePseudo(a, b)).toBe(true);
    });

    it.each([
      ['Zoé', 'Zoéline'],
      ['Jean.Dupont', 'Jean-Dupont'],
      ['Dan', 'Dan_'],
    ])('« %s » et « %s » sont deux pseudos', (a, b) => {
      expect(samePseudo(a, b)).toBe(false);
    });

    it('construit la même clé que la base', () => {
      expect(pseudoKey('ÉLODIE')).toBe('elodie');
      expect(pseudoKey("D'Arta'gnan")).toBe('dartagnan');
      expect(pseudoKey('Hélène_È.2')).toBe('helene_e.2');
    });
  });

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

  it('nouveau mot de passe : 8 caractères au moins et confirmation identique', () => {
    expect(validateNewPassword({ password: 'motdepasse', confirmation: 'motdepasse' })).toEqual({
      password: null,
      confirmation: null,
    });
    expect(fr(validateNewPassword({ password: '1234567', confirmation: '1234567' }).password)).toBe(
      'Le mot de passe doit faire au moins 8 caractères.',
    );
    expect(fr(validateNewPassword({ password: 'motdepasse', confirmation: '' }).confirmation)).toBe(
      'Confirme ton nouveau mot de passe.',
    );
    expect(fr(validateNewPassword({ password: 'motdepasse', confirmation: 'motdepasse!' }).confirmation)).toBe(
      'Les deux mots de passe ne sont pas identiques.',
    );
  });
});
