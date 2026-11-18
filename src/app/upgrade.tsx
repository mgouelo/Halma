import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { AUTH_LINK_PATHS } from '@/auth/auth-links';
import { upgradeGuest } from '@/auth/auth-service';
import { rememberPendingConfirmation } from '@/auth/pending-confirmation';
import { redirectUrl } from '@/auth/redirect';
import { useAuthAction } from '@/auth/use-auth-action';
import type { SignUpFields } from '@/auth/validation';
import { AccountForm } from '@/components/account-form';
import { AuthScreen, authStyles, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { ResendEmailButton } from '@/components/resend-email-button';
import { Typography } from '@/constants/theme';
import { rich, useT } from '@/i18n';
import { getSupabase } from '@/lib/supabase';

/** Un invité ajoute un pseudo, un e-mail et un mot de passe à son compte, sans en changer. */
export default function UpgradeScreen() {
  const t = useT();
  const { configured, loading, session, isGuest, refreshProfile } = useAuth();
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const { pending, error, run } = useAuthAction();

  const submit = async (fields: SignUpFields) => {
    if (!session) return;
    let needsConfirmation = false;
    const ok = await run(async () => {
      ({ needsEmailConfirmation: needsConfirmation } = await upgradeGuest(
        getSupabase(),
        fields,
        redirectUrl(AUTH_LINK_PATHS.confirmed),
      ));
    });
    // Le pseudo a pu changer même si l'e-mail a échoué : on relit le profil dans tous les cas.
    refreshProfile();
    if (!ok) return;
    if (needsConfirmation) {
      await rememberPendingConfirmation({ email: fields.email.trim(), kind: 'email_change' });
      setConfirmationSentTo(fields.email.trim());
    }
    else router.dismissTo('/');
  };

  // L'application détecte toute seule la validation (voir AuthProvider) : le compte n'est
  // plus invité, on avance.
  const confirmed = Boolean(confirmationSentTo) && Boolean(session) && !isGuest;
  useEffect(() => {
    if (confirmed) router.dismissTo('/');
  }, [confirmed]);

  const content = () => {
    if (!configured) return <NotConfiguredCard />;
    if (loading) return null;
    if (confirmationSentTo) {
      return (
        <DrawnCard contentStyle={authStyles.card}>
          <Notice tone="info">{t('upgrade.sent', { email: confirmationSentTo })}</Notice>
          <Text style={Typography.caption}>{t('upgrade.autoDetect')}</Text>
          <ResendEmailButton type="email_change" email={confirmationSentTo} />
          <DrawnButton label={t('upgrade.backHome')} onPress={() => router.dismissTo('/')} />
        </DrawnCard>
      );
    }
    if (!session) {
      return (
        <Notice tone="info">
          {rich(t('upgrade.notSignedIn'), {
            link: (text) => (
              <Link href="/sign-in" style={authStyles.inlineLink}>
                {text}
              </Link>
            ),
          })}
        </Notice>
      );
    }
    if (!isGuest) return <Notice tone="info">{t('upgrade.alreadyLinked')}</Notice>;
    return (
      <AccountForm
        submitLabel={t('common.createMyAccount')}
        pendingLabel={t('common.saving')}
        pending={pending}
        error={error}
        onSubmit={submit}
      />
    );
  };

  return (
    <AuthScreen
      header="back"
      title={t('upgrade.title')}
      subtitle={t('upgrade.subtitle')}>
      {content()}
    </AuthScreen>
  );
}
