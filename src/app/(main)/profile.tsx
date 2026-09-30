import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { AboutLinks } from '@/components/about-links';
import { Avatar } from '@/components/avatar';
import { AuthScreen, authStyles, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DeleteAccount } from '@/components/delete-account';
import { DrawnCard } from '@/components/drawn-card';
import { ProfileStats } from '@/components/profile-stats';
import { ErrorState, LoadingState } from '@/components/state-view';
import { playerColor, Typography } from '@/constants/theme';

/** Profil du joueur connecté : avatar, pseudo, type de compte, statistiques, suppression du compte. */
export default function ProfileScreen() {
  const { configured, loading, session, profile, isGuest, profileError, refreshProfile } = useAuth();

  if (!configured) {
    return (
      <AuthScreen title="Profil" subtitle="Comptes indisponibles.">
        <NotConfiguredCard />
        <AboutLinks />
      </AuthScreen>
    );
  }
  if (!loading && !session) {
    return (
      <AuthScreen title="Profil" subtitle="Tu n’es pas connecté.">
        <DrawnButton label="Se connecter" onPress={() => router.push('/sign-in')} />
        <AboutLinks />
      </AuthScreen>
    );
  }
  return (
    <AuthScreen title="Profil" subtitle={isGuest ? 'Compte invité' : 'Compte e-mail'}>
      {profile ? (
        <DrawnCard contentStyle={[authStyles.card, styles.card]}>
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
        </DrawnCard>
      ) : profileError ? (
        <ErrorState
          title="Profil indisponible"
          message="Impossible de lire ton profil. Vérifie ta connexion."
          onRetry={refreshProfile}
        />
      ) : (
        <LoadingState label="Chargement du profil…" />
      )}
      {session && <ProfileStats userId={session.user.id} />}
      {isGuest && (
        <DrawnButton
          label="Créer mon compte"
          size="small"
          onPress={() => router.push('/upgrade')}
          style={styles.secondary}
        />
      )}
      {profile && (
        <DrawnCard contentStyle={authStyles.card}>
          <Text style={Typography.heading} accessibilityRole="header">
            Compte
          </Text>
          <DeleteAccount pseudo={profile.pseudo} isGuest={isGuest} />
        </DrawnCard>
      )}
      <AboutLinks />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
  },
  secondary: {
    alignSelf: 'center',
  },
});
