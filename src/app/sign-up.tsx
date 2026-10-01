import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { signUpWithEmail } from '@/auth/auth-service';
import { useAuthAction } from '@/auth/use-auth-action';
import type { SignUpFields } from '@/auth/validation';
import { AccountForm } from '@/components/account-form';
import { AuthScreen, authStyles, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { getSupabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const { configured, isGuest } = useAuth();
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const { pending, error, run } = useAuthAction();

  const submit = async (fields: SignUpFields) => {
    let needsConfirmation = false;
    const ok = await run(async () => {
      ({ needsEmailConfirmation: needsConfirmation } = await signUpWithEmail(getSupabase(), fields));
    });
    if (!ok) return;
    if (needsConfirmation) setConfirmationSentTo(fields.email.trim());
    else router.dismissTo('/');
  };

  return (
    <AuthScreen header="back" title="Inscription" subtitle="Un pseudo pour jouer en ligne et retrouver tes parties.">
      {!configured ? (
        <NotConfiguredCard />
      ) : confirmationSentTo ? (
        <DrawnCard contentStyle={authStyles.card}>
          <Notice tone="info">
            Presque fini ! Un e-mail de confirmation a été envoyé à {confirmationSentTo}. Clique sur le lien, puis
            connecte-toi.
          </Notice>
          <DrawnButton label="Aller à la connexion" onPress={() => router.replace('/sign-in')} />
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
