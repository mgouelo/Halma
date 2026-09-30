import { StyleSheet, Text, View } from 'react-native';

import type { AvatarConfig } from '@/avatar/avatar';
import { Colors, playerColor, Spacing, Stroke, Typography } from '@/constants/theme';

import { Avatar } from './avatar';

interface PlayerChipProps {
  player: number;
  size?: number;
  /** Nom affiché (par défaut, le nom de la couleur : « Rose », « Bleu »…). */
  label?: string;
  detail?: string;
  /**
   * Avatar à la place de la pastille, sur fond de la couleur du joueur :
   * valeur de `profiles.avatar` ou configuration, avec sa graine de secours.
   */
  avatar?: { value: AvatarConfig | string | null; seed: string };
}

/**
 * Pastille de couleur (ou avatar sur fond de couleur) d'un joueur suivie de son
 * nom, et d'une précision (ex. « IA · Moyen »).
 */
export function PlayerChip({ player, size = 18, label, detail, avatar }: PlayerChipProps) {
  const color = playerColor(player);
  return (
    <View style={styles.row}>
      {avatar ? (
        <Avatar value={avatar.value} seed={avatar.seed} size={size} background={color.piece} />
      ) : (
        <View
          style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color.piece }]}
        />
      )}
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
