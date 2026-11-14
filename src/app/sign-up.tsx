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
import { getSupabase } from '@/lib/supabase';

export default function SignUpScreen() {
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
      ));
    });
    if (!ok) return;
    if (needsConfirmation) {
      await rememberPendingConfirmation({ email: fields.email.trim(), kind: 'signup' });
      setWaitingFor({ ...fields, email: fields.email.trim() });
    } else router.dismissTo('/');
  };

  return (
    <AuthScreen header="back" title="Inscription" subtitle="Un pseudo pour jouer en ligne et retrouver tes parties.">
      {!configured ? (
        <NotConfiguredCard />
      ) : waitingFor ? (
        <DrawnCard contentStyle={authStyles.card}>
          <Notice tone="info">
            Presque fini ! Un e-mail de confirmation a été envoyé à {waitingFor.email}. Clique sur le lien qu’il
            contient, sur ce téléphone ou ailleurs.
          </Notice>
          <View style={styles.waiting} accessibilityLabel="En attente de la validation">
            <ThinkingDots />
            <Text style={[Typography.caption, styles.flex]}>Cet écran avance tout seul dès que ton compte est validé.</Text>
          </View>
          <ResendEmailButton type="signup" email={waitingFor.email} />
          <DrawnButton label="Aller à la connexion" size="small" onPress={() => router.replace('/sign-in')} />
        </DrawnCard>
      ) : (
        <>
          {isGuest && (
            <Notice tone="info">
              Tu joues en invité. Pour conserver ta progression, crée plutôt ton compte depuis le compte invité :{' '}
              <Link href="/upgrade" style={authStyles.inlineLink}>créer mon compte</Link>.
            </Notice>
          )}
          <AccountForm submitLabel="Créer mon compte" pendingLabel="Création…" pending={pending} error={error} onSubmit={submit} />
          <View style={authStyles.links}>
            <Link href="/sign-in" replace style={authStyles.link}>
              Déjà un compte ? Connecte-toi
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
