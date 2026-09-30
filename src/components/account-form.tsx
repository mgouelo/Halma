import { useState } from 'react';

import { hasErrors, PASSWORD_MIN_LENGTH, validateSignUp, type FieldError, type SignUpFields } from '@/auth/validation';
import { playerColor } from '@/constants/theme';

import { authStyles, Notice } from './auth-screen';
import { DrawnButton } from './drawn-button';
import { DrawnCard } from './drawn-card';
import { DrawnTextInput } from './drawn-text-input';

interface AccountFormProps {
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  /** Erreur renvoyée par le serveur, déjà traduite. */
  error: string | null;
  onSubmit: (fields: SignUpFields) => void;
}

/** Formulaire pseudo + e-mail + mot de passe (inscription, ou invité qui crée son compte). */
export function AccountForm({ submitLabel, pendingLabel, pending, error, onSubmit }: AccountFormProps) {
  const [pseudo, setPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, FieldError>>({});

  // Corriger un champ efface son erreur ; les autres restent jusqu'au prochain envoi.
  const edit = (field: keyof SignUpFields, set: (value: string) => void) => (value: string) => {
    set(value);
    setErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
  };

  const submit = () => {
    if (pending) return;
    const fields = { pseudo, email, password };
    const fieldErrors = validateSignUp(fields);
    setErrors(fieldErrors);
    if (!hasErrors(fieldErrors)) onSubmit(fields);
  };

  return (
    <DrawnCard contentStyle={authStyles.card}>
      <DrawnTextInput
        label="Pseudo"
        value={pseudo}
        onChangeText={edit('pseudo', setPseudo)}
        error={errors.pseudo}
        hint="3 à 20 caractères : lettres sans accent, chiffres, « _ », « - » ou « . »."
        autoCapitalize="none"
        autoComplete="username-new"
        textContentType="username"
        maxLength={20}
      />
      <DrawnTextInput
        label="E-mail"
        value={email}
        onChangeText={edit('email', setEmail)}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="toi@exemple.fr"
      />
      <DrawnTextInput
        label="Mot de passe"
        value={password}
        onChangeText={edit('password', setPassword)}
        error={errors.password}
        hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères.`}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
      />
      {error && <Notice>{error}</Notice>}
      <DrawnButton label={pending ? pendingLabel : submitLabel} onPress={submit} color={playerColor(0).piece} />
    </DrawnCard>
  );
}
