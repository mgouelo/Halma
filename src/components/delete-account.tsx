import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { deleteMyAccount } from '@/auth/auth-service';
import { useAuthAction } from '@/auth/use-auth-action';
import { Colors, Radius, Spacing, Stroke, Typography } from '@/constants/theme';
import { useT } from '@/i18n';
import { getSupabase } from '@/lib/supabase';

import { Notice } from './auth-screen';
import { DrawnButton } from './drawn-button';

/**
 * Suppression du compte, en deux temps : un premier bouton ouvre la
 * confirmation, qui explique ce qui sera perdu ; seul le second supprime.
 */
export function DeleteAccount({ pseudo, isGuest }: { pseudo: string; isGuest: boolean }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const { pending, error, run } = useAuthAction();

  const confirm = async () => {
    if (await run(() => deleteMyAccount(getSupabase()))) router.dismissTo('/');
  };

  if (!confirming) {
    return (
      <DrawnButton
        label={t('profile.deleteAccount')}
        onPress={() => setConfirming(true)}
        accessibilityHint={t('profile.deleteHint')}
      />
    );
  }
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <Text style={Typography.heading} accessibilityRole="header">
        {t('profile.deleteTitle', { name: pseudo })}
      </Text>
      <Text style={Typography.body}>
        {isGuest ? t('profile.deleteText') : `${t('profile.deleteText')} ${t('profile.deleteEmailText')}`}
      </Text>
      {error && <Notice>{error}</Notice>}
      <View style={styles.actions}>
        <DrawnButton
          label={pending ? t('profile.deleting') : t('profile.deleteConfirm')}
          busy={pending}
          onPress={confirm}
          color={Colors.paper}
          size="small"
        />
        <DrawnButton label={t('common.cancel')} size="small" onPress={() => setConfirming(false)} disabled={pending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
