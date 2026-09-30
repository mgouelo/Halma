import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { Avatar } from '@/components/avatar';
import { AuthScreen, authStyles, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { playerColor, Spacing, Typography } from '@/constants/theme';

/** Profil du joueur connecté : avatar, pseudo, type de compte. */
export default function ProfileScreen() {
  const { configured, loading, session, profile, isGuest } = useAuth();

  if (!configured) {
    return (
      <AuthScreen title="Profil" subtitle="Comptes indisponibles.">
        <NotConfiguredCard />
      </AuthScreen>
    );
  }
  if (!loading && !session) {
    return (
      <AuthScreen title="Profil" subtitle="Tu n’es pas connecté.">
        <DrawnButton label="Se connecter" onPress={() => router.push('/sign-in')} />
      </AuthScreen>
    );
  }
  return (
    <AuthScreen title="Profil" subtitle={isGuest ? 'Compte invité' : 'Compte e-mail'}>
      <DrawnCard contentStyle={[authStyles.card, styles.card]}>
        {profile ? (
          <>
            <Avatar value={profile.avatar} seed={profile.id} size={144} accessibilityLabel={`Avatar de ${profile.pseudo}`} />
            <Text style={Typography.title}>{profile.pseudo}</Text>
            <DrawnButton
              label={profile.avatar ? 'Modifier mon avatar' : 'Créer mon avatar'}
              onPress={() => router.push('/avatar')}
              color={playerColor(0).piece}
            />
            {!profile.avatar && (
              <Text style={[Typography.caption, authStyles.center]}>
                Pour l’instant, ton avatar est tiré au hasard à partir de ton compte.
              </Text>
            )}
          </>
        ) : (
          <View style={styles.loading}>
            <Text style={Typography.caption}>Chargement…</Text>
          </View>
        )}
      </DrawnCard>
      {isGuest && (
        <DrawnButton label="Créer mon compte" size="small" onPress={() => router.push('/upgrade')} />
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
  },
  loading: {
    padding: Spacing.four,
  },
});
