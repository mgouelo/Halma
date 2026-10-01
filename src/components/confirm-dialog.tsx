import { useEffect, useRef } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';

import { Colors, playerColor, Spacing, Typography } from '@/constants/theme';

import { DrawnButton } from './drawn-button';
import { DrawnCard } from './drawn-card';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  /** Action qui ne change rien (fermer la fenêtre) : c'est elle qui a le focus. */
  cancelLabel: string;
  /** Action demandée (quitter, recommencer…). */
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Troisième choix facultatif, entre les deux autres (par exemple « Créer mon compte »). */
  extraLabel?: string;
  onExtra?: () => void;
}

/**
 * Fenêtre de confirmation dessinée (Alert n'existe pas sur le web). Accessible :
 * rôle « alertdialog », le reste de l'écran est masqué aux lecteurs d'écran,
 * focus placé sur le choix sans risque et gardé dans la fenêtre (web), Échap
 * (web) et le bouton retour d'Android ferment la fenêtre sans rien faire.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  extraLabel,
  onExtra,
}: ConfirmDialogProps) {
  const cancelRef = useRef<View>(null);

  // Web : le focus clavier arrive directement sur le choix sans risque.
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const timer = setTimeout(() => (cancelRef.current as unknown as HTMLElement | null)?.focus?.(), 0);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.scrim}>
        <View
          style={styles.card}
          role="alertdialog"
          aria-modal
          aria-label={title}
          accessibilityViewIsModal
          accessibilityLabel={title}>
          <DrawnCard contentStyle={styles.content}>
            <Text style={Typography.title} accessibilityRole="header">
              {title}
            </Text>
            <Text style={Typography.body}>{message}</Text>
            <View style={styles.actions}>
              <DrawnButton ref={cancelRef} label={cancelLabel} onPress={onCancel} color={playerColor(1).piece} />
              {extraLabel && onExtra && <DrawnButton label={extraLabel} onPress={onExtra} />}
              <DrawnButton label={confirmLabel} onPress={onConfirm} />
            </View>
          </DrawnCard>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: Colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 380,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
  actions: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
});
