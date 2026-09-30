import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { signUpWithEmail } from '@/auth/auth-service';
import { useAuthAction } from '@/auth/use-auth-action';
import { hasErrors, PASSWORD_MIN_LENGTH, validateSignUp, type FieldError } from '@/auth/validation';
import { AuthScreen, authStyles, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { DrawnTextInput } from '@/components/drawn-text-input';
import { playerColor } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const { configured } = useAuth();
  const [pseudo, setPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [confirmationSent, setConfirmationSent] = useState(false);
  const { pending, error, run } = useAuthAction();

  const submit = async () => {
    const fieldErrors = validateSignUp({ pseudo, email, password });
    setErrors(fieldErrors);
    if (hasErrors(fieldErrors)) return;
    let needsConfirmation = false;
    const ok = await run(async () => {
      ({ needsEmailConfirmation: needsConfirmation } = await signUpWithEmail(getSupabase(), { pseudo, email, password }));
    });
    if (!ok) return;
    if (needsConfirmation) setConfirmationSent(true);
    else router.dismissTo('/');
  };

  return (
    <AuthScreen title="Inscription" subtitle="Un pseudo pour jouer en ligne et retrouver tes parties.">
      {!configured ? (
        <NotConfiguredCard />
      ) : confirmationSent ? (
        <DrawnCard contentStyle={authStyles.card}>
          <Notice tone="info">
            Presque fini ! Un e-mail de confirmation a été envoyé à {email.trim()}. Clique sur le lien, puis
            connecte-toi.
          </Notice>
          <DrawnButton label="Aller à la connexion" onPress={() => router.replace('/sign-in')} />
        </DrawnCard>
      ) : (
        <>
          <DrawnCard contentStyle={authStyles.card}>
            <DrawnTextInput
              label="Pseudo"
              value={pseudo}
              onChangeText={setPseudo}
              error={errors.pseudo}
              hint="3 à 20 caractères : lettres sans accent, chiffres, « _ » ou « - »."
              autoCapitalize="none"
              autoComplete="username-new"
              textContentType="username"
              maxLength={20}
            />
            <DrawnTextInput
              label="E-mail"
              value={email}
              onChangeText={setEmail}
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
              onChangeText={setPassword}
              error={errors.password}
              hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères.`}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              onSubmitEditing={submit}
            />
            {error && <Notice>{error}</Notice>}
            <DrawnButton
              label={pending ? 'Création…' : 'Créer mon compte'}
              onPress={submit}
              color={playerColor(0).piece}
            />
          </DrawnCard>

          <View style={authStyles.links}>
            <Link href="/sign-in" style={authStyles.link}>
              Déjà un compte ? Connecte-toi
            </Link>
          </View>
        </>
      )}
    </AuthScreen>
  );
}
