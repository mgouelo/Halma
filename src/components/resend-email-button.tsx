import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AUTH_LINK_PATHS } from '@/auth/auth-links';
import { resendConfirmation } from '@/auth/auth-service';
import { redirectUrl } from '@/auth/redirect';
import { useAuthAction } from '@/auth/use-auth-action';
import { Spacing, Typography } from '@/constants/theme';
import { useT } from '@/i18n';
import { getSupabase } from '@/lib/supabase';

import { DrawnButton } from './drawn-button';

/** « Renvoyer l'e-mail » de confirmation (inscription, ou e-mail ajouté par un invité), avec son retour. */
export function ResendEmailButton({ type, email }: { type: 'signup' | 'email_change'; email: string }) {
  const t = useT();
  const { pending, error, run } = useAuthAction();
  const [sent, setSent] = useState(false);

  const resend = async () => {
    setSent(false);
    if (await run(() => resendConfirmation(getSupabase(), type, email, redirectUrl(AUTH_LINK_PATHS.confirmed)))) {
      setSent(true);
    }
  };

  return (
    <View style={styles.box}>
      <DrawnButton label={pending ? t('common.sending') : t('resend.button')} busy={pending} size="small" onPress={resend} />
      {(sent || error) && (
        <Text style={Typography.caption} accessibilityLiveRegion="polite">
          {error ?? t('resend.sent', { email })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'flex-start',
    gap: Spacing.one,
  },
});
