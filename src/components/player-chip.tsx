import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { AvatarConfig } from '@/avatar/avatar';
import { Colors, playerColor, Spacing, Stroke, TurnPulseDuration, Typography, WaitingOpacity } from '@/constants/theme';

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
  /**
   * Place du joueur dans le tour : `active` (c'est à lui) entoure l'avatar d'un
   * anneau noir et d'un halo pastel qui pulse ; `waiting` l'atténue (avatar
   * pâli, nom en gris). Sans valeur : affichage neutre.
   */
  turn?: 'active' | 'waiting';
}

/** Écart entre l'avatar et l'anneau du joueur dont c'est le tour, en fraction de la taille de l'avatar. */
const RING_GAP = 0.14;

/**
 * Pastille de couleur (ou avatar sur fond de couleur) d'un joueur suivie de son
 * nom, et d'une précision (ex. « IA · Moyen »).
 */
export function PlayerChip({ player, size = 18, label, detail, avatar, turn }: PlayerChipProps) {
  const color = playerColor(player);
  const face = avatar ? (
    <Avatar value={avatar.value} seed={avatar.seed} size={size} background={color.piece} />
  ) : (
    <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color.piece }]} />
  );
  return (
    <View style={styles.row}>
      {turn ? (
        <TurnRing size={size} color={color.piece} active={turn === 'active'}>
          {face}
        </TurnRing>
      ) : (
        face
      )}
      <Text style={[Typography.heading, styles.label, turn === 'waiting' && styles.waiting]} numberOfLines={1}>
        {label ?? color.name}
      </Text>
      {detail && <Text style={Typography.caption}>{detail}</Text>}
    </View>
  );
}

/**
 * Cadre de l'avatar dans le tour. La place de l'anneau est toujours réservée,
 * pour que rien ne bouge quand le tour passe. Joueur actif : anneau noir épais
 * (la forme, pas seulement la couleur) et halo pastel qui grossit et pâlit
 * lentement ; immobile si l'utilisateur a demandé de réduire les animations.
 */
function TurnRing({ size, color, active, children }: { size: number; color: string; active: boolean; children: ReactNode }) {
  const gap = Math.max(3, Math.round(size * RING_GAP));
  const outer = size + gap * 2 + Stroke.bold * 2;
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!active || reduceMotion) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: TurnPulseDuration, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [active, pulse, reduceMotion]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.9 - pulse.value * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.16 }],
  }));

  const round = { width: outer, height: outer, borderRadius: outer / 2 };
  return (
    <View style={[styles.ringBox, round]}>
      {active && (
        <>
          <Animated.View style={[styles.halo, round, { backgroundColor: color }, haloStyle]} />
          <View style={[styles.ring, round]} />
        </>
      )}
      <View style={!active && styles.waitingFace}>{children}</View>
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
  waiting: {
    color: Colors.inkSoft,
  },
  dot: {
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
  },
  ringBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: Stroke.bold,
    borderColor: Colors.ink,
  },
  waitingFace: {
    opacity: WaitingOpacity,
  },
});
