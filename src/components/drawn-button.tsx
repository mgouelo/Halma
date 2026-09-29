import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadow, Spacing, Stroke, Typography } from '@/constants/theme';

interface DrawnButtonProps {
  label: string;
  onPress: () => void;
  /** Couleur de la face (blanc par défaut, ou un pastel de joueur). */
  color?: string;
  icon?: ReactNode;
  size?: 'regular' | 'small';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

/** Bouton au trait noir : il « s'enfonce » dans son ombre quand on appuie. */
export function DrawnButton({
  label,
  onPress,
  color = Colors.paper,
  icon,
  size = 'regular',
  style,
  accessibilityHint,
}: DrawnButtonProps) {
  const small = size === 'small';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={[styles.wrapper, style]}>
      {({ pressed }) => (
        <>
          <View style={styles.shadow} />
          <View
            style={[
              styles.face,
              small && styles.faceSmall,
              { backgroundColor: color },
              pressed && styles.facePressed,
            ]}>
            {icon}
            <Text style={[Typography.button, small && styles.labelSmall]}>{label}</Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingRight: Shadow.offset,
    paddingBottom: Shadow.offset,
  },
  shadow: {
    ...StyleSheet.absoluteFill,
    top: Shadow.offset,
    left: Shadow.offset,
    borderRadius: Radius.round,
    backgroundColor: Colors.ink,
  },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 52,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.round,
    borderWidth: Stroke.bold,
    borderColor: Colors.ink,
  },
  faceSmall: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
  },
  facePressed: {
    transform: [{ translateX: Shadow.offset }, { translateY: Shadow.offset }],
  },
  labelSmall: {
    fontSize: 15,
  },
});
