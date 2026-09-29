import { StyleSheet, Text, View } from 'react-native';

import { Colors, playerColor, Spacing, Stroke, Typography } from '@/constants/theme';

import { DrawnButton } from './drawn-button';
import { DrawnCard } from './drawn-card';

interface VictoryOverlayProps {
  winner: number;
  /** Nombre de coups joués par le vainqueur. */
  moveCount: number;
  onReplay: () => void;
  onHome: () => void;
}

/** Écran de victoire, affiché par-dessus le plateau en fin de partie. */
export function VictoryOverlay({ winner, moveCount, onReplay, onHome }: VictoryOverlayProps) {
  const color = playerColor(winner);
  return (
    <View style={styles.scrim} accessibilityViewIsModal>
      <DrawnCard style={styles.card} contentStyle={styles.content}>
        <View style={[styles.medal, { backgroundColor: color.piece }]} />
        <Text style={Typography.title} accessibilityRole="header">
          Victoire !
        </Text>
        <Text style={[Typography.body, styles.center]}>
          {color.name} a rempli la branche d’en face en {moveCount} coups.
        </Text>
        <View style={styles.actions}>
          <DrawnButton label="Rejouer" onPress={onReplay} color={color.piece} />
          <DrawnButton label="Accueil" onPress={onHome} />
        </View>
      </DrawnCard>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 360,
  },
  content: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  medal: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: Stroke.bold,
    borderColor: Colors.ink,
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
});
