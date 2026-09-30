import { StyleSheet, Text, View } from 'react-native';

import { Colors, playerColor, Spacing, Stroke, Typography } from '@/constants/theme';

interface PlayerChipProps {
  player: number;
  size?: number;
  /** Nom affiché (par défaut, le nom de la couleur : « Rose », « Bleu »…). */
  label?: string;
  detail?: string;
}

/** Pastille de couleur d'un joueur suivie de son nom (et d'une précision, ex. « IA · Moyen »). */
export function PlayerChip({ player, size = 18, label, detail }: PlayerChipProps) {
  const color = playerColor(player);
  return (
    <View style={styles.row}>
      <View
        style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color.piece }]}
      />
      <Text style={[Typography.heading, styles.label]} numberOfLines={1}>
        {label ?? color.name}
      </Text>
      {detail && <Text style={Typography.caption}>{detail}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    flexShrink: 1,
  },
  dot: {
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
  },
});
