import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Colors, Fonts, playerColor, Shadow, Stroke, TouchTarget } from '@/constants/theme';
import { badgeLabel } from '@/friends/friends-service';

/** Épaisseur du trait dans la boîte 48 × 48 pour qu'il mesure `width` points à l'écran. */
function strokeFor(width: number, size: number) {
  return (width * 48) / size;
}

// Boîte aux lettres vue de côté (boîte 48 × 48) : toit arrondi, porte, poteau.
const BOX = 'M8 22 C8 13 14 9 21 9 H32 C38 9 42 13 42 21 V32 H8 Z';
const DOOR = 'M8 22 C8 15.5 11.5 12 15.5 12 C19.5 12 23 15.5 23 22 V32 H8 Z';

/** Boîte aux lettres au trait noir, drapeau pastel levé et enveloppe qui dépasse. Décorative. */
export function MailboxIcon({ size }: { size: number }) {
  const stroke = strokeFor(Stroke.regular, size);
  const shadow = strokeFor(2, size);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {/* Poteau. */}
        <Rect x={22} y={32} width={6} height={12} fill={Colors.paper} stroke={Colors.ink} strokeWidth={stroke} />
        <Path d="M14 44 H36" stroke={Colors.ink} strokeWidth={stroke} strokeLinecap="round" />
        {/* Drapeau levé. */}
        <Path d="M36 22 V8 H44 V13 H36" fill={playerColor(0).piece} stroke={Colors.ink} strokeWidth={stroke} strokeLinejoin="round" />
        <Path d={BOX} transform={`translate(${shadow} ${shadow})`} fill={Colors.ink} />
        <Path d={BOX} fill={Colors.paper} stroke={Colors.ink} strokeWidth={stroke} strokeLinejoin="round" />
        {/* Enveloppe qui dépasse de la porte. */}
        <Path d="M10 17 L22 14 L24 22 L12 25 Z" fill={playerColor(3).piece} stroke={Colors.ink} strokeWidth={stroke * 0.8} strokeLinejoin="round" />
        <Path d={DOOR} fill="none" stroke={Colors.ink} strokeWidth={stroke} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

const SIZE = 52;

/**
 * Bouton « boîte aux lettres » : ouvre les demandes d'ami reçues. Pastille du
 * nombre de demandes (le libellé le dit aussi : pas seulement un dessin).
 */
export function MailboxButton({ count, onPress }: { count: number; onPress: () => void }) {
  const badge = badgeLabel(count);
  const label =
    count === 0 ? 'Demandes d’ami : aucune' : `Demandes d’ami : ${count} en attente`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Affiche les demandes d’ami reçues"
      hitSlop={4}
      style={styles.wrapper}>
      {({ pressed }) => (
        <>
          <View style={styles.shadow} />
          <View style={[styles.face, pressed && styles.pressed]}>
            <MailboxIcon size={36} />
          </View>
          {badge && (
            <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: SIZE + Shadow.offset,
    height: SIZE + Shadow.offset,
    minWidth: TouchTarget,
    minHeight: TouchTarget,
  },
  shadow: {
    position: 'absolute',
    top: Shadow.offset,
    left: Shadow.offset,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: Colors.ink,
  },
  face: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: Stroke.bold,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ translateX: Shadow.offset / 2 }, { translateY: Shadow.offset / 2 }],
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    backgroundColor: playerColor(0).piece,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.ink,
  },
});
