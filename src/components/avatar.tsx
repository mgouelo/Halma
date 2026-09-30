import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { parseAvatar, renderAvatarSvg, type AvatarConfig } from '@/avatar/avatar';
import { Colors, Stroke } from '@/constants/theme';

interface AvatarProps {
  /**
   * Avatar à afficher : configuration, ou valeur de `profiles.avatar` (JSON ou
   * graine). Sans valeur, l'avatar est tiré de `seed`.
   */
  value?: AvatarConfig | string | null;
  /** Graine de secours (identifiant du joueur) quand il n'y a pas d'avatar enregistré. */
  seed: string;
  size?: number;
  /** Remplace le fond choisi (hexadécimal sans « # »), par exemple la couleur du joueur. */
  background?: string;
  /** Sans libellé, l'avatar est décoratif (lu avec le nom à côté). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Avatar Humation dans un cercle au trait noir. Le SVG est calculé une fois par
 * configuration (et mis en cache), puis dessiné par react-native-svg, sur
 * mobile comme sur le web.
 */
export const Avatar = memo(function Avatar({ value, seed, size = 40, background, accessibilityLabel, style }: AvatarProps) {
  const xml = useMemo(() => {
    const config = typeof value === 'object' && value !== null ? value : parseAvatar(value, seed);
    return renderAvatarSvg(config, background);
  }, [value, seed, background]);
  const inner = size - Stroke.regular * 2;
  return (
    <View
      style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }, style]}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}>
      <SvgXml xml={xml} width={inner} height={inner} />
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
