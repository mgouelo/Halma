import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { AUTH_LINK_PATHS } from '@/auth/auth-links';
import { confirmFromLink } from '@/auth/confirm-link';
import { AuthFailure, describeAuthError } from '@/auth/errors';
import { useScreenHost } from '@/auth/open-app';
import { forgetPendingConfirmation, readPendingConfirmation } from '@/auth/pending-confirmation';
import { useIncomingAuthLink, useLinkVerification, useStripAuthParamsFromAddressBar } from '@/auth/use-auth-link';
import { useAutoHome } from '@/auth/use-auto-home';
import { AuthScreen, authStyles, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { StarLogo } from '@/components/nav-bar/icons';
import { OpenAppButton } from '@/components/open-app-button';
import { ErrorState, LoadingState } from '@/components/state-view';
import { playerColor, Typography } from '@/constants/theme';
import { useT } from '@/i18n';
import { createEphemeralSupabase, getSupabase } from '@/lib/supabase';

/**
 * Lien de confirmation d'e-mail (il mène au site : https://…/auth/confirmed).
 * Dans le navigateur de l'inscription faite sur le site : session ouverte,
 * « Compte validé ! » puis l'accueil tout seul. Ailleurs (inscription faite dans
 * l'application, ou sur un autre appareil) : « Compte validé, tu peux retourner
 * dans l'application » (elle le détecte d'elle-même), avec un bouton pour
 * l'ouvrir dans le navigateur d'un téléphone.
 */
export default function ConfirmedScreen() {
  const t = useT();
  const { configured } = useAuth();
  const link = useIncomingAuthLink(AUTH_LINK_PATHS.confirmed);
  const verification = useLinkVerification(link, (incoming) =>
    confirmFromLink(incoming, {
      client: getSupabase(),
      ephemeralClient: createEphemeralSupabase,
      readPending: readPendingConfirmation,
      forgetPending: forgetPendingConfirmation,
    }),
  );
  useStripAuthParamsFromAddressBar(verification.status !== 'pending');
  const here = verification.status === 'ok' && verification.value === 'here';
  useAutoHome(here);
  const host = useScreenHost();

  const content = () => {
    if (!configured) return <NotConfiguredCard />;
    if (verification.status === 'pending') return <LoadingState label={t('confirmed.validating')} />;
    if (verification.status === 'error') {
      if (!(verification.error instanceof AuthFailure)) {
        return (
          <ErrorState
            title={t('confirmed.failed')}
            message={describeAuthError(t, verification.error)}
            onRetry={verification.retry}
          />
        );
      }
      return (
        <DrawnCard contentStyle={authStyles.card}>
          <Text style={Typography.heading} accessibilityRole="header">
            {t('confirmed.linkUsed')}
          </Text>
          <Text style={Typography.body}>{describeAuthError(t, verification.error)}</Text>
          <Text style={Typography.caption}>{t('confirmed.linkUsedText')}</Text>
          <DrawnButton label={t('common.signIn')} onPress={() => router.replace('/sign-in')} color={playerColor(0).piece} />
        </DrawnCard>
      );
    }
    if (here) {
      return (
        <DrawnCard contentStyle={[authStyles.card, styles.center]}>
          <StarLogo size={96} />
          <Text style={[Typography.title, styles.text]} accessibilityRole="header" accessibilityLiveRegion="polite">
            {t('confirmed.done')}
          </Text>
          <Text style={[Typography.body, styles.text]}>{t('confirmed.welcome')}</Text>
          <DrawnButton label={t('confirmed.play')} onPress={() => router.dismissTo('/')} color={playerColor(1).piece} />
        </DrawnCard>
      );
    }
    return (
      <DrawnCard contentStyle={[authStyles.card, styles.center]}>
        <StarLogo size={96} />
        <Text style={[Typography.title, styles.text]} accessibilityRole="header" accessibilityLiveRegion="polite">
          {t('confirmed.elsewhereTitle')}
        </Text>
        <Text style={[Typography.body, styles.text]}>{t('confirmed.elsewhereText')}</Text>
        <OpenAppButton />
        {host !== 'app' && <Text style={[Typography.caption, styles.text]}>{t('confirmed.closePage')}</Text>}
      </DrawnCard>
    );
  };

  return (
    <AuthScreen header="none" title={t('confirmed.title')} subtitle={t('confirmed.subtitle')}>
      {content()}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  text: {
    textAlign: 'center',
  },
});
