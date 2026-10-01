import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { refreshAccount } from '@/auth/auth-service';
import { AuthFailure } from '@/auth/errors';
import { useAuthAction } from '@/auth/use-auth-action';
import { useSignOut } from '@/auth/use-sign-out';
import { playerColor, Spacing, Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';

import { Avatar } from './avatar';
import { DrawnButton } from './drawn-button';
import { SignOutDialog } from './sign-out-dialog';
import { ThinkingDots } from './state-view';

/** Compte du joueur sur l'accueil : bouton de connexion, ou pseudo et actions du compte. */
export function AccountBar() {
  const { configured, loading, session, profile, isGuest, pendingEmail, profileError, refreshProfile } = useAuth();
  const { error, run } = useAuthAction();
  const signOut = useSignOut(isGuest);

  if (!configured) return null;
  if (loading) {
    // Même hauteur que la barre finale : l'accueil ne saute pas quand la session arrive.
    return (
      <View style={[styles.row, styles.placeholder]} accessibilityLabel="Chargement du compte">
        <ThinkingDots />
      </View>
    );
  }
  if (!session) {
    return (
      <View style={styles.row}>
        <Text style={[Typography.caption, styles.flex]}>Connecte-toi pour conserver ta progression.</Text>
        <DrawnButton label="Se connecter" size="small" onPress={() => router.push('/sign-in')} />
      </View>
    );
  }

  const checkConfirmation = () =>
    run(async () => {
      if (await refreshAccount(getSupabase())) {
        throw new AuthFailure('not_confirmed', 'Pas encore confirmé : clique sur le lien reçu par e-mail.');
      }
    });

  return (
    <View style={styles.account}>
      <View style={styles.row}>
        <Pressable
          style={[styles.row, styles.flex]}
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel={`Profil de ${profile?.pseudo ?? 'joueur'}`}
          accessibilityHint="Ouvre ton profil et ton avatar">
          <Avatar value={profile?.avatar} seed={session.user.id} size={44} />
          <View style={styles.flex}>
            <Text style={Typography.heading} numberOfLines={1}>
              {profile?.pseudo ?? '…'}
            </Text>
            <Text style={Typography.caption}>{isGuest ? 'Invité · Profil ›' : 'Profil ›'}</Text>
          </View>
        </Pressable>
        <DrawnButton
          label="Déconnexion"
          busy={signOut.pending}
          size="small"
          onPress={signOut.request}
          accessibilityHint={isGuest ? 'Un compte invité ne peut pas être retrouvé après déconnexion.' : undefined}
        />
      </View>

      {isGuest && !pendingEmail && (
        <View style={styles.row}>
          <Text style={[Typography.caption, styles.flex]}>Invité : ce compte n’existe que sur cet appareil.</Text>
          <DrawnButton
            label="Créer mon compte"
            size="small"
            color={playerColor(0).piece}
            onPress={() => router.push('/upgrade')}
          />
        </View>
      )}
      {isGuest && pendingEmail && (
        <View style={styles.row}>
          <Text style={[Typography.caption, styles.flex]}>
            Confirmation envoyée à {pendingEmail}. Clique sur le lien reçu.
          </Text>
          <DrawnButton label="J’ai confirmé" size="small" onPress={checkConfirmation} />
        </View>
      )}
      {profileError && (
        <View style={styles.row}>
          <Text style={[Typography.caption, styles.flex]}>Profil indisponible (connexion ?).</Text>
          <DrawnButton label="Réessayer" size="small" onPress={refreshProfile} />
        </View>
      )}
      {(error ?? signOut.error) && <Text style={Typography.caption}>{error ?? signOut.error}</Text>}
      <SignOutDialog controller={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  account: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  placeholder: {
    minHeight: 48,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
