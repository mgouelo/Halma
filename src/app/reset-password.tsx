import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { AUTH_LINK_PATHS } from '@/auth/auth-links';
import { sessionFromLink, updatePassword } from '@/auth/auth-service';
import { AuthFailure, describeAuthError } from '@/auth/errors';
import { useScreenHost } from '@/auth/open-app';
import { useAuthAction } from '@/auth/use-auth-action';
import { useIncomingAuthLink, useLinkVerification, useStripAuthParamsFromAddressBar } from '@/auth/use-auth-link';
import { useAutoHome } from '@/auth/use-auto-home';
import { hasErrors, PASSWORD_MIN_LENGTH, validateNewPassword, type FieldError } from '@/auth/validation';
import { AuthScreen, authStyles, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { DrawnTextInput } from '@/components/drawn-text-input';
import { OpenAppButton } from '@/components/open-app-button';
import { ErrorState, LoadingState } from '@/components/state-view';
import { playerColor, Typography } from '@/constants/theme';
import { useT } from '@/i18n';
import { getSupabase } from '@/lib/supabase';

/**
 * Lien « mot de passe oublié » : ouvre la session de récupération portée par
 * le lien, puis demande le nouveau mot de passe (avec confirmation). Seule
 * façon de changer de mot de passe dans l'application.
 *
 * Le lien de l'e-mail mène au site (https://…/reset-password) : tout se passe
 * dans le navigateur, sans l'application. Après le changement, le site invite à
 * retourner dans l'application (bouton pour l'ouvrir sur téléphone) au lieu de
 * repartir tout seul vers l'accueil.
 */
export default function ResetPasswordScreen() {
  const t = useT();
  const { configured } = useAuth();
  const link = useIncomingAuthLink(AUTH_LINK_PATHS.resetPassword);
  // Client de l'application, pas un client jetable : `updateUser({ password })`
  // a besoin de la session de recuperation. Elle remplace une session deja
  // ouverte dans ce navigateur ; apres le changement, on reste connecte a ce compte.
  const verification = useLinkVerification(link, (incoming) => sessionFromLink(getSupabase(), incoming));
  useStripAuthParamsFromAddressBar(verification.status !== 'pending');

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [done, setDone] = useState(false);
  const { pending, error, run } = useAuthAction();
  const host = useScreenHost();
  useAutoHome(done && host === 'app');

  const submit = async () => {
    if (pending) return;
    const fieldErrors = validateNewPassword({ password, confirmation });
    setErrors(fieldErrors);
    if (hasErrors(fieldErrors)) return;
    if (await run(() => updatePassword(getSupabase(), password))) setDone(true);
  };

  const content = () => {
    if (!configured) return <NotConfiguredCard />;
    if (verification.status === 'pending') return <LoadingState label={t('reset.verifying')} />;
    if (verification.status === 'error') {
      if (!(verification.error instanceof AuthFailure)) {
        return (
          <ErrorState
            title={t('reset.verifyFailed')}
            message={describeAuthError(t, verification.error)}
            onRetry={verification.retry}
          />
        );
      }
      return (
        <DrawnCard contentStyle={authStyles.card}>
          <Text style={Typography.heading} accessibilityRole="header">
            {t('reset.linkInvalid')}
          </Text>
          <Text style={Typography.body}>{describeAuthError(t, verification.error)}</Text>
          <Text style={Typography.caption}>{t('reset.linkOnce')}</Text>
          <DrawnButton
            label={t('reset.newLink')}
            onPress={() => router.replace('/forgot-password')}
            color={playerColor(0).piece}
          />
        </DrawnCard>
      );
    }
    if (done && host !== 'app') {
      return (
        <DrawnCard contentStyle={authStyles.card}>
          <Text style={Typography.title} accessibilityRole="header" accessibilityLiveRegion="polite">
            {t('reset.changed')}
          </Text>
          <Text style={Typography.body}>{t('reset.changedWeb')}</Text>
          <OpenAppButton />
          <DrawnButton
            label={t('reset.playOnSite')}
            size="small"
            onPress={() => router.dismissTo('/')}
            accessibilityHint={t('reset.playOnSiteHint')}
          />
        </DrawnCard>
      );
    }
    if (done) {
      return (
        <DrawnCard contentStyle={authStyles.card}>
          <Text style={Typography.title} accessibilityRole="header" accessibilityLiveRegion="polite">
            {t('reset.changed')}
          </Text>
          <Text style={Typography.body}>{t('reset.signedIn')}</Text>
          <DrawnButton label={t('reset.goHome')} onPress={() => router.dismissTo('/')} color={playerColor(1).piece} />
        </DrawnCard>
      );
    }
    return (
      <DrawnCard contentStyle={authStyles.card}>
        <DrawnTextInput
          label={t('reset.newPassword')}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setErrors((prev) => ({ ...prev, password: null }));
          }}
          error={errors.password ? t.msg(errors.password) : null}
          hint={t('common.passwordHint', { n: PASSWORD_MIN_LENGTH })}
          revealable
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <DrawnTextInput
          label={t('reset.confirmPassword')}
          value={confirmation}
          onChangeText={(value) => {
            setConfirmation(value);
            setErrors((prev) => ({ ...prev, confirmation: null }));
          }}
          error={errors.confirmation ? t.msg(errors.confirmation) : null}
          revealable
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={submit}
        />
        {error && <Notice>{error}</Notice>}
        <DrawnButton
          label={pending ? t('common.saving') : t('reset.savePassword')}
          busy={pending}
          onPress={submit}
          color={playerColor(0).piece}
        />
      </DrawnCard>
    );
  };

  return (
    <AuthScreen header="back" title={t('reset.title')} subtitle={t('reset.subtitle')}>
      {content()}
    </AuthScreen>
  );
}
