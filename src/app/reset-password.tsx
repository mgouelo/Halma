import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { AUTH_LINK_PATHS } from '@/auth/auth-links';
import { sessionFromLink, updatePassword } from '@/auth/auth-service';
import { AuthFailure, describeAuthError } from '@/auth/errors';
import { useAuthAction } from '@/auth/use-auth-action';
import { useIncomingAuthLink, useLinkVerification, useStripAuthParamsFromAddressBar } from '@/auth/use-auth-link';
import { useAutoHome } from '@/auth/use-auto-home';
import { hasErrors, PASSWORD_MIN_LENGTH, validateNewPassword, type FieldError } from '@/auth/validation';
import { AuthScreen, authStyles, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { DrawnTextInput } from '@/components/drawn-text-input';
import { ErrorState, LoadingState } from '@/components/state-view';
import { playerColor, Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';

export const PASSWORD_CHANGED_MESSAGE = 'Mot de passe modifié';

/**
 * Lien « mot de passe oublié » : ouvre la session de récupération portée par
 * le lien, puis demande le nouveau mot de passe (avec confirmation). Seule
 * façon de changer de mot de passe dans l'application.
 */
export default function ResetPasswordScreen() {
  const { configured } = useAuth();
  const link = useIncomingAuthLink(AUTH_LINK_PATHS.resetPassword);
  const verification = useLinkVerification(link, (incoming) => sessionFromLink(getSupabase(), incoming));
  useStripAuthParamsFromAddressBar(verification.status !== 'pending');

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [done, setDone] = useState(false);
  const { pending, error, run } = useAuthAction();
  useAutoHome(done);

  const submit = async () => {
    if (pending) return;
    const fieldErrors = validateNewPassword({ password, confirmation });
    setErrors(fieldErrors);
    if (hasErrors(fieldErrors)) return;
    if (await run(() => updatePassword(getSupabase(), password))) setDone(true);
  };

  const content = () => {
    if (!configured) return <NotConfiguredCard />;
    if (verification.status === 'pending') return <LoadingState label="Vérification du lien…" />;
    if (verification.status === 'error') {
      if (!(verification.error instanceof AuthFailure)) {
        return (
          <ErrorState
            title="Vérification impossible"
            message={describeAuthError(verification.error)}
            onRetry={verification.retry}
          />
        );
      }
      return (
        <DrawnCard contentStyle={authStyles.card}>
          <Text style={Typography.heading} accessibilityRole="header">
            Lien expiré ou invalide
          </Text>
          <Text style={Typography.body}>{verification.error.message}</Text>
          <Text style={Typography.caption}>Un lien ne sert qu’une fois et expire au bout d’une heure.</Text>
          <DrawnButton
            label="Recevoir un nouveau lien"
            onPress={() => router.replace('/forgot-password')}
            color={playerColor(0).piece}
          />
        </DrawnCard>
      );
    }
    if (done) {
      return (
        <DrawnCard contentStyle={authStyles.card}>
          <Text style={Typography.title} accessibilityRole="header" accessibilityLiveRegion="polite">
            {PASSWORD_CHANGED_MESSAGE}
          </Text>
          <Text style={Typography.body}>Tu es connecté. Retour à l’accueil…</Text>
          <DrawnButton label="Aller à l’accueil" onPress={() => router.dismissTo('/')} color={playerColor(1).piece} />
        </DrawnCard>
      );
    }
    return (
      <DrawnCard contentStyle={authStyles.card}>
        <DrawnTextInput
          label="Nouveau mot de passe"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setErrors((prev) => ({ ...prev, password: null }));
          }}
          error={errors.password}
          hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères.`}
          revealable
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <DrawnTextInput
          label="Confirme le mot de passe"
          value={confirmation}
          onChangeText={(value) => {
            setConfirmation(value);
            setErrors((prev) => ({ ...prev, confirmation: null }));
          }}
          error={errors.confirmation}
          revealable
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={submit}
        />
        {error && <Notice>{error}</Notice>}
        <DrawnButton
          label={pending ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
          busy={pending}
          onPress={submit}
          color={playerColor(0).piece}
        />
      </DrawnCard>
    );
  };

  return (
    <AuthScreen header="back" title="Nouveau mot de passe" subtitle="Choisis le mot de passe de ton compte.">
      {content()}
    </AuthScreen>
  );
}
