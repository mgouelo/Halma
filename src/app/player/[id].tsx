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

const TITLE = 'Profil';
const SUBTITLE = 'Profil d’un joueur';

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { configured, loading, session, isGuest } = useAuth();

  if (!configured) {
    return (
      <AuthScreen header="back" title={TITLE} subtitle="Comptes indisponibles.">
        <NotConfiguredCard />
      </AuthScreen>
    );
  }
  if (loading) {
    return (
      <AuthScreen header="back" title={TITLE} subtitle={SUBTITLE}>
        <LoadingState label="Chargement…" />
      </AuthScreen>
    );
  }
  if (!session) {
    return (
      <AuthScreen header="back" title={TITLE} subtitle="Tu n’es pas connecté.">
        <DrawnButton label="Se connecter" onPress={() => router.push('/sign-in')} color={playerColor(1).piece} />
      </AuthScreen>
    );
  }
  if (id === session.user.id) return <Redirect href="/profile" />;
  if (isGuest) {
    return (
      <AuthScreen header="back" title={TITLE} subtitle={SUBTITLE}>
        <EmptyState
          icon={<FriendsIcon size={88} />}
          title="Crée ton compte"
          message="Les profils des joueurs sont réservés aux comptes. Crée le tien (tu gardes ta progression d’invité) pour voir les profils, ajouter des amis et entrer dans les classements."
          action={{ label: 'Créer mon compte', onPress: () => router.push('/upgrade'), color: playerColor(1).piece }}
          secondaryAction={{ label: 'J’ai déjà un compte', onPress: () => router.push('/sign-in') }}
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
