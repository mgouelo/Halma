import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { upgradeGuest } from '@/auth/auth-service';
import { useAuthAction } from '@/auth/use-auth-action';
import type { SignUpFields } from '@/auth/validation';
import { AccountForm } from '@/components/account-form';
import { AuthScreen, authStyles, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';

/** Un invité ajoute un pseudo, un e-mail et un mot de passe à son compte, sans en changer. */
export default function UpgradeScreen() {
  const { configured, loading, session, isGuest, refreshProfile } = useAuth();
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const { pending, error, run } = useAuthAction();

  const submit = async (fields: SignUpFields) => {
    if (!session) return;
    let needsConfirmation = false;
    const ok = await run(async () => {
      ({ needsEmailConfirmation: needsConfirmation } = await upgradeGuest(getSupabase(), session.user.id, fields));
    });
    // Le pseudo a pu changer même si l'e-mail a échoué : on relit le profil dans tous les cas.
    refreshProfile();
    if (!ok) return;
    if (needsConfirmation) setConfirmationSentTo(fields.email.trim());
    else router.dismissTo('/');
  };

  const content = () => {
    if (!configured) return <NotConfiguredCard />;
    if (loading) return null;
    if (confirmationSentTo) {
      return (
        <DrawnCard contentStyle={authStyles.card}>
          <Notice tone="info">
            Un e-mail de confirmation a été envoyé à {confirmationSentTo}. Clique sur le lien pour terminer : ton
            compte invité deviendra alors ton compte, avec ce pseudo et ce mot de passe.
          </Notice>
          <Text style={Typography.caption}>En attendant, tu peux continuer à jouer en invité.</Text>
          <DrawnButton label="Retour à l’accueil" onPress={() => router.dismissTo('/')} />
        </DrawnCard>
      );
    }
    if (!session) {
      return (
        <Notice tone="info">
          Tu n’es pas connecté. <Link href="/sign-in" style={authStyles.inlineLink}>Se connecter</Link>
        </Notice>
      );
    }
    if (!isGuest) return <Notice tone="info">Ton compte est déjà lié à une adresse e-mail.</Notice>;
    return (
      <AccountForm
        submitLabel="Créer mon compte"
        pendingLabel="Enregistrement…"
        pending={pending}
        error={error}
        onSubmit={submit}
      />
    );
  };

  return (
    <AuthScreen
      title="Garder ton compte"
      subtitle="Choisis un pseudo et ajoute un e-mail : tu gardes ce compte et pourras t’y reconnecter partout.">
      {content()}
    </AuthScreen>
  );
}
