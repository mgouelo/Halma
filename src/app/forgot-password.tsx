import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { AUTH_LINK_PATHS } from '@/auth/auth-links';
import { requestPasswordReset } from '@/auth/auth-service';
import { redirectUrl } from '@/auth/redirect';
import { useAuthAction } from '@/auth/use-auth-action';
import { validateEmail, type FieldError } from '@/auth/validation';
import { AuthScreen, authStyles, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { DrawnTextInput } from '@/components/drawn-text-input';
import { playerColor, Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';

/** Message affiché après la demande, que l'adresse ait un compte ou non. */
export const RESET_SENT_MESSAGE =
  'Si un compte existe avec cette adresse, un e-mail vient d’être envoyé. Clique sur le lien qu’il contient pour choisir un nouveau mot de passe.';

/** « Mot de passe oublié ? » : on saisit son e-mail et on reçoit un lien de réinitialisation. */
export default function ForgotPasswordScreen() {
  const { configured } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [fieldError, setFieldError] = useState<FieldError>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { pending, error, run } = useAuthAction();

  const submit = async () => {
    if (pending) return;
    const invalid = validateEmail(email);
    setFieldError(invalid);
    if (invalid) return;
    if (await run(() => requestPasswordReset(getSupabase(), email, redirectUrl(AUTH_LINK_PATHS.resetPassword)))) {
      setSentTo(email.trim());
    }
  };

  return (
    <AuthScreen
      header="back"
      title="Mot de passe oublié"
      subtitle="Indique ton adresse e-mail : tu recevras un lien pour choisir un nouveau mot de passe.">
      {!configured ? (
        <NotConfiguredCard />
      ) : sentTo ? (
        <DrawnCard contentStyle={authStyles.card}>
          <Notice tone="info">{RESET_SENT_MESSAGE}</Notice>
          <Text style={Typography.caption}>
            Rien reçu ? Regarde dans les indésirables, vérifie l’adresse, puis réessaie dans quelques minutes.
          </Text>
          <DrawnButton label="Revenir à la connexion" onPress={() => router.replace('/sign-in')} />
          <DrawnButton label="Renvoyer un lien" size="small" onPress={() => setSentTo(null)} />
        </DrawnCard>
      ) : (
        <DrawnCard contentStyle={authStyles.card}>
          <DrawnTextInput
            label="E-mail"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setFieldError(null);
            }}
            error={fieldError}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="toi@exemple.fr"
            onSubmitEditing={submit}
          />
          {error && <Notice>{error}</Notice>}
          <DrawnButton
            label={pending ? 'Envoi…' : 'Recevoir le lien'}
            busy={pending}
            onPress={submit}
            color={playerColor(0).piece}
          />
        </DrawnCard>
      )}
    </AuthScreen>
  );
}
