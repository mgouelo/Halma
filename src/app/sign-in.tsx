import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { signInAsGuest, signInWithEmail } from '@/auth/auth-service';
import { useAuthAction } from '@/auth/use-auth-action';
import { hasErrors, validateSignIn, type FieldError } from '@/auth/validation';
import { AboutLinks } from '@/components/about-links';
import { AuthScreen, authStyles, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { DrawnTextInput } from '@/components/drawn-text-input';
import { playerColor, Typography } from '@/constants/theme';
import { LanguagePicker } from '@/components/language-picker';
import { getLanguage, rich, useT } from '@/i18n';
import { getSupabase } from '@/lib/supabase';

export default function SignInScreen() {
  const t = useT();
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
    if (await run(() => signInAsGuest(getSupabase(), getLanguage()))) router.dismissTo('/');
  };

  return (
    <AuthScreen header="back" title={t('signIn.title')} subtitle={t('signIn.subtitle')}>
      {!configured ? (
        <NotConfiguredCard />
      ) : (
        <>
          {isGuest && (
            <Notice tone="info">
              {rich(t('signIn.guestWarning'), {
                link: (text) => (
                  <Link href="/upgrade" style={authStyles.inlineLink}>
                    {text}
                  </Link>
                ),
              })}
            </Notice>
          )}
          <DrawnCard contentStyle={authStyles.card}>
            <DrawnTextInput
              label={t('common.email')}
              value={email}
              onChangeText={edit('email', setEmail)}
              error={errors.email ? t.msg(errors.email) : null}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder={t('common.emailPlaceholder')}
            />
            <DrawnTextInput
              label={t('common.password')}
              value={password}
              onChangeText={edit('password', setPassword)}
              error={errors.password ? t.msg(errors.password) : null}
              revealable
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={submit}
            />
            {error && <Notice>{error}</Notice>}
            <DrawnButton
              label={pending ? t('common.signingIn') : t('common.signIn')}
              busy={pending}
              onPress={submit}
              color={playerColor(0).piece}
            />
            <Link
              href={{ pathname: '/forgot-password', params: email.trim() ? { email: email.trim() } : {} }}
              style={authStyles.link}
              accessibilityHint={t('signIn.forgotHint')}>
              {t('signIn.forgot')}
            </Link>
          </DrawnCard>

          <View style={authStyles.links}>
            <Link href="/sign-up" replace style={authStyles.link}>
              {t('signIn.noAccount')}
            </Link>
            <Text style={Typography.caption}>{t('signIn.or')}</Text>
            <DrawnButton label={t('signIn.guest')} size="small" onPress={playAsGuest} disabled={pending} />
            <Text style={[Typography.caption, authStyles.center]}>{t('signIn.guestText')}</Text>
          </View>
        </>
      )}
      <LanguagePicker />
      <AboutLinks />
    </AuthScreen>
  );
}
