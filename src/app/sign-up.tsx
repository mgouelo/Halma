import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { AUTH_LINK_PATHS } from '@/auth/auth-links';
import { signInIfConfirmed, signUpWithEmail } from '@/auth/auth-service';
import { CONFIRMED_NOTICE, SIGNUP_POLL_MS } from '@/auth/confirmation-timing';
import { forgetPendingConfirmation, rememberPendingConfirmation } from '@/auth/pending-confirmation';
import { redirectUrl } from '@/auth/redirect';
import { useAuthAction } from '@/auth/use-auth-action';
import { useConfirmationWatcher } from '@/auth/use-confirmation-watcher';
import type { SignUpFields } from '@/auth/validation';
import { AccountForm } from '@/components/account-form';
import { AuthScreen, authStyles, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { ResendEmailButton } from '@/components/resend-email-button';
import { ThinkingDots } from '@/components/state-view';
import { Spacing, Typography } from '@/constants/theme';
import { setFlashNotice } from '@/lib/flash-notice';
import { getLanguage, rich, useT } from '@/i18n';
import { getSupabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const t = useT();
  const { configured, isGuest, session } = useAuth();
  // Identifiants gardés en mémoire (jamais enregistrés) le temps d'attendre la confirmation.
  const [waitingFor, setWaitingFor] = useState<SignUpFields | null>(null);
  const { pending, error, run } = useAuthAction();

  // Lien ouvert sur un autre appareil : la connexion finit par réussir, et l'on avance tout seul.
  // (Ouvert sur cet appareil, c'est l'écran /auth/confirmed qui ouvre la session.)
  useConfirmationWatcher(
    Boolean(waitingFor) && !session,
    () => (waitingFor ? signInIfConfirmed(getSupabase(), waitingFor) : Promise.resolve(false)),
    () => {
      void forgetPendingConfirmation();
      setFlashNotice(CONFIRMED_NOTICE);
      router.dismissTo('/');
    },
    SIGNUP_POLL_MS,
  );

  const submit = async (fields: SignUpFields) => {
    let needsConfirmation = false;
    const ok = await run(async () => {
      ({ needsEmailConfirmation: needsConfirmation } = await signUpWithEmail(
        getSupabase(),
        fields,
        redirectUrl(AUTH_LINK_PATHS.confirmed),
        getLanguage(),
      ));
    });
    if (!ok) return;
    if (needsConfirmation) {
      await rememberPendingConfirmation({ email: fields.email.trim(), kind: 'signup' });
      setWaitingFor({ ...fields, email: fields.email.trim() });
    } else router.dismissTo('/');
  };

  return (
    <AuthScreen header="back" title={t('signUp.title')} subtitle={t('signUp.subtitle')}>
      {!configured ? (
        <NotConfiguredCard />
      ) : waitingFor ? (
        <DrawnCard contentStyle={authStyles.card}>
          <Notice tone="info">{t('signUp.almostDone', { email: waitingFor.email })}</Notice>
          <View style={styles.waiting} accessibilityLabel={t('signUp.waitingLabel')}>
            <ThinkingDots />
            <Text style={[Typography.caption, styles.flex]}>{t('signUp.autoAdvance')}</Text>
          </View>
          <ResendEmailButton type="signup" email={waitingFor.email} />
          <DrawnButton label={t('signUp.goToSignIn')} size="small" onPress={() => router.replace('/sign-in')} />
        </DrawnCard>
      ) : (
        <>
          {isGuest && (
            <Notice tone="info">
              {rich(t('signUp.guestWarning'), {
                link: (text) => (
                  <Link href="/upgrade" style={authStyles.inlineLink}>
                    {text}
                  </Link>
                ),
              })}
            </Notice>
          )}
          <AccountForm
            submitLabel={t('common.createMyAccount')}
            pendingLabel={t('signUp.creating')}
            pending={pending}
            error={error}
            onSubmit={submit}
          />
          <View style={authStyles.links}>
            <Link href="/sign-in" replace style={authStyles.link}>
              {t('signUp.haveAccount')}
            </Link>
          </View>
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
});
