import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { deleteMyAccount } from '@/auth/auth-service';
import { useAuthAction } from '@/auth/use-auth-action';
import { Colors, Radius, Spacing, Stroke, Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';

import { Notice } from './auth-screen';
import { DrawnButton } from './drawn-button';

/**
 * Suppression du compte, en deux temps : un premier bouton ouvre la
 * confirmation, qui explique ce qui sera perdu ; seul le second supprime.
 */
export function DeleteAccount({ pseudo, isGuest }: { pseudo: string; isGuest: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const { pending, error, run } = useAuthAction();

  const confirm = async () => {
    if (await run(() => deleteMyAccount(getSupabase()))) router.dismissTo('/');
  };

  if (!confirming) {
    return (
      <DrawnButton
        label="Supprimer mon compte"
        size="small"
        onPress={() => setConfirming(true)}
        accessibilityHint="Demande une confirmation avant de supprimer"
        style={styles.start}
      />
    );
  }
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <Text style={Typography.heading} accessibilityRole="header">
        Supprimer le compte {pseudo} ?
      </Text>
      <Text style={Typography.body}>
        C’est définitif. Ton profil, ton avatar, tes statistiques et ta place dans les classements seront effacés. Tu
        abandonnes tes parties en cours ; dans les parties des autres, ta place apparaîtra comme « Compte supprimé ».
        {isGuest ? '' : ' Ton adresse e-mail sera supprimée de nos serveurs.'}
      </Text>
      {error && <Notice>{error}</Notice>}
      <View style={styles.actions}>
        <DrawnButton
          label={pending ? 'Suppression…' : 'Oui, supprimer définitivement'}
          busy={pending}
          onPress={confirm}
          color={Colors.paper}
          size="small"
        />
        <DrawnButton label="Annuler" size="small" onPress={() => setConfirming(false)} disabled={pending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  start: {
    alignSelf: 'flex-start',
  },
  box: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: Stroke.bold,
    borderColor: Colors.ink,
    borderStyle: 'dashed',
    borderRadius: Radius.medium,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
