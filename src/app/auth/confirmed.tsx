import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { AUTH_LINK_PATHS } from '@/auth/auth-links';
import { confirmFromLink } from '@/auth/confirm-link';
import { AuthFailure, describeAuthError } from '@/auth/errors';
import { forgetPendingConfirmation, readPendingConfirmation } from '@/auth/pending-confirmation';
import { useIncomingAuthLink, useLinkVerification, useStripAuthParamsFromAddressBar } from '@/auth/use-auth-link';
import { useAutoHome } from '@/auth/use-auto-home';
import { AuthScreen, authStyles, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { StarLogo } from '@/components/nav-bar/icons';
import { ErrorState, LoadingState } from '@/components/state-view';
import { playerColor, Typography } from '@/constants/theme';
import { createEphemeralSupabase, getSupabase } from '@/lib/supabase';

export const CONFIRMED_TITLE = 'Compte validé !';
export const CONFIRMED_ELSEWHERE_TITLE = 'Compte validé';

/**
 * Lien de confirmation d'e-mail. Sur l'appareil de l'inscription : session
 * ouverte, « Compte validé ! » puis l'accueil tout seul. Sur un autre appareil :
 * « Compte validé, retourne dans l'appli » (l'appli le détecte d'elle-même).
 */
export default function ConfirmedScreen() {
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

  const content = () => {
    if (!configured) return <NotConfiguredCard />;
    if (verification.status === 'pending') return <LoadingState label="Validation du compte…" />;
    if (verification.status === 'error') {
      if (!(verification.error instanceof AuthFailure)) {
        return (
          <ErrorState
            title="Validation impossible"
            message={describeAuthError(verification.error)}
            onRetry={verification.retry}
          />
        );
      }
      return (
        <DrawnCard contentStyle={authStyles.card}>
          <Text style={Typography.heading} accessibilityRole="header">
            Lien expiré ou déjà utilisé
          </Text>
          <Text style={Typography.body}>{verification.error.message}</Text>
          <Text style={Typography.caption}>
            Si ton compte est déjà validé, connecte-toi. Sinon, renvoie l’e-mail depuis l’appli.
          </Text>
          <DrawnButton label="Se connecter" onPress={() => router.replace('/sign-in')} color={playerColor(0).piece} />
        </DrawnCard>
      );
    }
    if (here) {
      return (
        <DrawnCard contentStyle={[authStyles.card, styles.center]}>
          <StarLogo size={96} />
          <Text style={[Typography.title, styles.text]} accessibilityRole="header" accessibilityLiveRegion="polite">
            {CONFIRMED_TITLE}
          </Text>
          <Text style={[Typography.body, styles.text]}>Bienvenue dans Halma. Place au jeu…</Text>
          <DrawnButton label="Jouer" onPress={() => router.dismissTo('/')} color={playerColor(1).piece} />
        </DrawnCard>
      );
    }
    return (
      <DrawnCard contentStyle={[authStyles.card, styles.center]}>
        <StarLogo size={96} />
        <Text style={[Typography.title, styles.text]} accessibilityRole="header" accessibilityLiveRegion="polite">
          {CONFIRMED_ELSEWHERE_TITLE}
        </Text>
        <Text style={[Typography.body, styles.text]}>
          Retourne dans l’appli : elle s’en aperçoit toute seule en quelques secondes.
        </Text>
        <Text style={[Typography.caption, styles.text]}>Tu peux fermer cette page.</Text>
      </DrawnCard>
    );
  };

  return (
    <AuthScreen header="none" title="Validation du compte" subtitle="Dernière étape avant de jouer.">
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
