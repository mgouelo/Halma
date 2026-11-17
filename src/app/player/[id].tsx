import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { AuthScreen, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { FriendsIcon } from '@/components/nav-bar/icons';
import { PublicProfileView } from '@/components/player/public-profile-view';
import { EmptyState, LoadingState } from '@/components/state-view';
import { Colors, playerColor } from '@/constants/theme';
import { useIsClient } from '@/hooks/use-is-client';
import { useT } from '@/i18n';

/**
 * Profil public d'un autre joueur, ouvert en touchant sa ligne (classements,
 * amis, demandes reçues). Sans barre de navigation, un seul bouton « ‹ Retour ».
 * Son propre identifiant mène à son profil (`/profile`). Réservé aux comptes
 * e-mail : un invité est invité à créer son compte, sans requête au serveur.
 */
export default function PlayerScreen() {
  // L'identifiant vient de l'URL, inconnue lors de l'export statique web.
  const isClient = useIsClient();
  return isClient ? <PlayerGate /> : <SafeAreaView style={styles.screen} />;
}

function PlayerGate() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { configured, loading, session, isGuest } = useAuth();
  const TITLE = t('profile.title');
  const SUBTITLE = t('profile.playerSubtitle');

  if (!configured) {
    return (
      <AuthScreen header="back" title={TITLE} subtitle={t('common.accountsUnavailable')}>
        <NotConfiguredCard />
      </AuthScreen>
    );
  }
  if (loading) {
    return (
      <AuthScreen header="back" title={TITLE} subtitle={SUBTITLE}>
        <LoadingState label={t('common.loading')} />
      </AuthScreen>
    );
  }
  if (!session) {
    return (
      <AuthScreen header="back" title={TITLE} subtitle={t('common.notSignedIn')}>
        <DrawnButton label={t('common.signIn')} onPress={() => router.push('/sign-in')} color={playerColor(1).piece} />
      </AuthScreen>
    );
  }
  if (id === session.user.id) return <Redirect href="/profile" />;
  if (isGuest) {
    return (
      <AuthScreen header="back" title={TITLE} subtitle={SUBTITLE}>
        <EmptyState
          icon={<FriendsIcon size={88} />}
          title={t('profile.guestPlayerTitle')}
          message={t('profile.guestPlayerText')}
          action={{ label: t('common.createMyAccount'), onPress: () => router.push('/upgrade'), color: playerColor(1).piece }}
          secondaryAction={{ label: t('common.haveAccount'), onPress: () => router.push('/sign-in') }}
        />
      </AuthScreen>
    );
  }
  return (
    <AuthScreen header="back" title={TITLE} subtitle={SUBTITLE}>
      <PublicProfileView key={id} userId={id} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
});
