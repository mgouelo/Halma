import { StyleSheet, Text, View } from 'react-native';

import { Colors, playerColor, Spacing, Stroke, Typography } from '@/constants/theme';

/** Pastille de couleur d'un joueur suivie de son nom. */
export function PlayerChip({ player, size = 18 }: { player: number; size?: number }) {
  const color = playerColor(player);
  return (
    <View style={styles.row}>
      <View
        style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color.piece }]}
      />
      <Text style={Typography.heading}>{color.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
  },
});
