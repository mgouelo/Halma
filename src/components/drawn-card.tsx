import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadow, Stroke } from '@/constants/theme';

interface DrawnCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Styles de la face (fond, marges intérieures). */
  contentStyle?: StyleProp<ViewStyle>;
  radius?: number;
}

/** Carte au trait noir avec ombre franche décalée, commune à toute l'interface. */
export function DrawnCard({ children, style, contentStyle, radius = Radius.large }: DrawnCardProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.shadow, { borderRadius: radius }]} />
      <View style={[styles.face, { borderRadius: radius }, contentStyle]}>{children}</View>
    </View>
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
    backgroundColor: Colors.ink,
  },
  face: {
    backgroundColor: Colors.paper,
    borderWidth: Stroke.bold,
    borderColor: Colors.ink,
    overflow: 'hidden',
  },
});
