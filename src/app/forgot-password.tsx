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
import { useT } from '@/i18n';
import { getSupabase } from '@/lib/supabase';

/** « Mot de passe oublié ? » : on saisit son e-mail et on reçoit un lien de réinitialisation. */
export default function ForgotPasswordScreen() {
  const t = useT();
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
      title={t('forgot.title')}
      subtitle={t('forgot.subtitle')}>
      {!configured ? (
        <NotConfiguredCard />
      ) : sentTo ? (
        <DrawnCard contentStyle={authStyles.card}>
          {/* Même message que l'adresse ait un compte ou non. */}
          <Notice tone="info">{t('forgot.sent')}</Notice>
          <Text style={Typography.caption}>{t('forgot.nothing')}</Text>
          <DrawnButton label={t('forgot.backToSignIn')} onPress={() => router.replace('/sign-in')} />
          <DrawnButton label={t('forgot.resend')} size="small" onPress={() => setSentTo(null)} />
        </DrawnCard>
      ) : (
        <DrawnCard contentStyle={authStyles.card}>
          <DrawnTextInput
            label={t('common.email')}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setFieldError(null);
            }}
            error={fieldError ? t.msg(fieldError) : null}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder={t('common.emailPlaceholder')}
            onSubmitEditing={submit}
          />
          {error && <Notice>{error}</Notice>}
          <DrawnButton
            label={pending ? t('common.sending') : t('forgot.receive')}
            busy={pending}
            onPress={submit}
            color={playerColor(0).piece}
          />
        </DrawnCard>
      )}
    </AuthScreen>
  );
}
