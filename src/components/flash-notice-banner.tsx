import { StyleSheet, View } from 'react-native';

import { useFlashNotice } from '@/lib/flash-notice';

import { Notice } from './auth-screen';
import { DrawnButton } from './drawn-button';

/** Message à usage unique (par exemple « L'hôte a fermé la room. »), avec un bouton pour le fermer. */
export function FlashNoticeBanner() {
  const { message, dismiss } = useFlashNotice();
  if (!message) return null;
  return (
    <View style={styles.banner}>
      <Notice tone="info">{message}</Notice>
      <DrawnButton label="OK" size="small" onPress={dismiss} accessibilityHint="Ferme le message" />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: 8,
    alignItems: 'flex-start',
  },
});
