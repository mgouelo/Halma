import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { playerColor, Spacing, Typography } from '@/constants/theme';

import { DrawnButton } from './drawn-button';
import { ResendEmailButton } from './resend-email-button';
import { ThinkingDots } from './state-view';

/**
 * Compte du joueur sur l'accueil : bouton de connexion, ou seulement les
 * rappels utiles (invité, e-mail en attente, profil indisponible). Le pseudo et
 * l'avatar sont en haut à droite ; la déconnexion est sur le profil.
 */
export function AccountBar() {
  const { configured, loading, session, isGuest, pendingEmail, profileError, refreshProfile } = useAuth();

  if (!configured) return null;
  // Pendant le chargement, rien : le pseudo et l'avatar du coin se chargent d'eux-mêmes.
  if (loading) return null;
  if (!session) {
    return (
      <View style={styles.row}>
        <Text style={[Typography.caption, styles.flex]}>Connecte-toi pour conserver ta progression.</Text>
        <DrawnButton label="Se connecter" size="small" onPress={() => router.push('/sign-in')} />
      </View>
    );
  }

  // Rien à dire à un joueur connecté dont tout va bien : pas de ligne vide.
  if (!isGuest && !profileError) return null;

  return (
    <View style={styles.account}>
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
        <View style={styles.pending}>
          <View style={styles.row}>
            <ThinkingDots />
            <Text style={[Typography.caption, styles.flex]}>
              Clique sur le lien envoyé à {pendingEmail} : l’appli s’en apercevra toute seule.
            </Text>
          </View>
          <ResendEmailButton type="email_change" email={pendingEmail} />
        </View>
      )}
      {profileError && (
        <View style={styles.row}>
          <Text style={[Typography.caption, styles.flex]}>Profil indisponible (connexion ?).</Text>
          <DrawnButton label="Réessayer" size="small" onPress={refreshProfile} />
        </View>
      )}
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
  pending: {
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
