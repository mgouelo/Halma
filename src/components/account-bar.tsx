import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { signOut } from '@/auth/auth-service';
import { useAuthAction } from '@/auth/use-auth-action';
import { Colors, playerColor, Spacing, Stroke, Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';

import { DrawnButton } from './drawn-button';

/** Compte du joueur sur l'accueil : bouton de connexion, ou pseudo et déconnexion. */
export function AccountBar() {
  const { configured, loading, session, profile, isGuest } = useAuth();
  const { pending, error, run } = useAuthAction();

  if (!configured || loading) return null;
  if (!session) {
    return (
      <View style={styles.account}>
        <Text style={[Typography.caption, styles.flex]}>Connecte-toi pour garder ton pseudo.</Text>
        <DrawnButton label="Se connecter" size="small" onPress={() => router.push('/sign-in')} />
      </View>
    );
  }
  return (
    <View style={styles.account}>
      <View style={[styles.row, styles.flex]}>
        <View style={styles.avatar} />
        <View style={styles.flex}>
          <Text style={Typography.heading} numberOfLines={1}>
            {profile?.pseudo ?? '…'}
          </Text>
          <Text style={Typography.caption}>{isGuest ? 'Invité' : 'Connecté'}</Text>
        </View>
      </View>
      <DrawnButton
        label={pending ? '…' : 'Déconnexion'}
        size="small"
        onPress={() => run(() => signOut(getSupabase()))}
        accessibilityHint={isGuest ? 'Un compte invité ne peut pas être retrouvé après déconnexion.' : undefined}
      />
      {error && <Text style={Typography.caption}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  account: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Emplacement de l'avatar Humation (étape 6).
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    backgroundColor: playerColor(0).tint,
  },
});
