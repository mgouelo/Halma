import { useState, type ReactNode, type Ref } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadow, Spacing, Stroke, TouchTarget, Typography } from '@/constants/theme';

interface DrawnButtonProps {
  label: string;
  onPress: () => void;
  /** Couleur de la face (blanc par défaut, ou un pastel de joueur). */
  color?: string;
  icon?: ReactNode;
  size?: 'regular' | 'small';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  /** Bouton inactif : trait en pointillés, sans ombre, et ne réagit pas. */
  disabled?: boolean;
  /** Action en cours : roue d'attente, et le bouton ne réagit plus (pas de double envoi). */
  busy?: boolean;
  /** Pour donner le focus au bouton (fenêtre de confirmation). */
  ref?: Ref<View>;
}

/**
 * Bouton au trait noir : il « s'enfonce » dans son ombre quand on appuie, et
 * se soulève un peu au survol de la souris (web).
 */
export function DrawnButton({
  label,
  onPress,
  color = Colors.paper,
  icon,
  size = 'regular',
  style,
  accessibilityHint,
  disabled = false,
  busy = false,
  ref,
}: DrawnButtonProps) {
  const [hovered, setHovered] = useState(false);
  const small = size === 'small';
  const inactive = disabled || busy;
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={inactive}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy }}
      style={[styles.wrapper, style]}>
      {({ pressed }) => (
        <>
          {!disabled && <View style={styles.shadow} />}
          <View
            style={[
              styles.face,
              small && styles.faceSmall,
              { backgroundColor: disabled ? Colors.paper : color },
              disabled && styles.faceDisabled,
              hovered && !inactive && !pressed && styles.faceHovered,
              pressed && !inactive && styles.facePressed,
            ]}>
            {busy ? <ActivityIndicator size="small" color={Colors.ink} /> : icon}
            <Text style={[Typography.button, small && styles.labelSmall, disabled && styles.labelDisabled]}>
              {label}
            </Text>
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
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.three,
  },
  faceDisabled: {
    borderStyle: 'dashed',
    borderColor: Colors.inkSoft,
  },
  faceHovered: {
    transform: [{ translateX: -1 }, { translateY: -1 }],
  },
  facePressed: {
    transform: [{ translateX: Shadow.offset }, { translateY: Shadow.offset }],
  },
  labelSmall: {
    fontSize: 15,
  },
  labelDisabled: {
    color: Colors.inkSoft,
  },
});
