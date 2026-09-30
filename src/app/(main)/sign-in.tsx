import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { signInAsGuest, signInWithEmail } from '@/auth/auth-service';
import { useAuthAction } from '@/auth/use-auth-action';
import { hasErrors, validateSignIn, type FieldError } from '@/auth/validation';
import { AuthScreen, authStyles, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { DrawnTextInput } from '@/components/drawn-text-input';
import { playerColor, Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';

export default function SignInScreen() {
  const { configured, isGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const { pending, error, run } = useAuthAction();

  // Corriger un champ efface son erreur.
  const edit = (field: 'email' | 'password', set: (value: string) => void) => (value: string) => {
    set(value);
    setErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
  };

  const submit = async () => {
    const fieldErrors = validateSignIn({ email, password });
    setErrors(fieldErrors);
    if (hasErrors(fieldErrors)) return;
    if (await run(() => signInWithEmail(getSupabase(), { email, password }))) router.dismissTo('/');
  };

  const playAsGuest = async () => {
    if (await run(() => signInAsGuest(getSupabase()))) router.dismissTo('/');
  };

  return (
    <AuthScreen title="Connexion" subtitle="Retrouve ta progression et tes parties.">
      {!configured ? (
        <NotConfiguredCard />
      ) : (
        <>
          {isGuest && (
            <Notice tone="info">
              Tu joues en invité : te connecter à un autre compte fera perdre ce compte invité. Pour conserver ta progression,{' '}
              <Link href="/upgrade" style={authStyles.inlineLink}>crée plutôt ton compte</Link>.
            </Notice>
          )}
          <DrawnCard contentStyle={authStyles.card}>
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
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={submit}
            />
            {error && <Notice>{error}</Notice>}
            <DrawnButton
              label={pending ? 'Connexion…' : 'Se connecter'}
              busy={pending}
              onPress={submit}
              color={playerColor(0).piece}
            />
          </DrawnCard>

          <View style={authStyles.links}>
            <Link href="/sign-up" style={authStyles.link}>
              Pas encore de compte ? Inscris-toi
            </Link>
            <Text style={Typography.caption}>ou</Text>
            <DrawnButton label="Jouer en invité" size="small" onPress={playAsGuest} disabled={pending} />
            <Text style={[Typography.caption, authStyles.center]}>
              Un compte invité reçoit un pseudo automatique. Il reste lié à cet appareil.
            </Text>
          </View>
        </>
      )}
    </AuthScreen>
  );
}
