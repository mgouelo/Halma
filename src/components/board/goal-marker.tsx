import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Polygon } from 'react-native-svg';

import { Colors, GoalPulseDuration, playerColor, Stroke } from '@/constants/theme';
import type { Corner, PlayerId } from '@/game';

import { GOAL_OVERFLOW, goalGeometry } from './goal';
import type { BoardLayout } from './layout';

interface GoalMarkerProps {
  layout: BoardLayout;
  corner: Corner;
  player: PlayerId;
}

/** Opacité au creux de la pulsation lente. */
const PULSE_LOW = 0.5;

/**
 * Contour en pointillés et drapeau de la branche d'arrivée, dans un calque posé
 * au-dessus du plateau (sans toucher : la zone tactile reste celle du plateau).
 * Le contour pulse lentement (le drapeau reste fixe), sauf si l'utilisateur a demandé de réduire les animations.
 * Décoratif : la consigne du tour suffit aux lecteurs d'écran.
 */
export function GoalMarker({ layout, corner, player }: GoalMarkerProps) {
  const { outline, flag, flagRadius } = useMemo(() => goalGeometry(layout, corner), [layout, corner]);
  const color = playerColor(player);
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withTiming(PULSE_LOW, { duration: GoalPulseDuration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const dash = `${layout.spacing * 0.22} ${layout.spacing * 0.16}`;
  // Fanion dessiné dans la pastille : mât noir et triangle pastel.
  const r = flagRadius;
  const poleX = flag.x - r * 0.3;
  const top = flag.y - r * 0.55;
  const bottom = flag.y + r * 0.6;
  const pennant = `${poleX},${top} ${poleX + r * 0.75},${top + r * 0.3} ${poleX},${top + r * 0.6}`;

  const size = { width: layout.width + 2 * GOAL_OVERFLOW, height: layout.height + 2 * GOAL_OVERFLOW };
  const shift = `translate(${GOAL_OVERFLOW} ${GOAL_OVERFLOW})`;

  return (
    <View
      style={[styles.layer, size]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {/* Contour qui pulse : pointillés pastel bordés de noir, visibles sur le blanc comme sur la teinte. */}
      <Animated.View style={[styles.fill, pulse]}>
        <Svg {...size}>
          <G transform={shift}>
            <Polygon
              points={outline}
              fill="none"
              stroke={Colors.ink}
              strokeWidth={Stroke.bold + 2.5}
              strokeDasharray={dash}
              strokeLinejoin="round"
            />
            <Polygon
              points={outline}
              fill="none"
              stroke={color.piece}
              strokeWidth={Stroke.bold + 0.5}
              strokeDasharray={dash}
              strokeLinejoin="round"
            />
          </G>
        </Svg>
      </Animated.View>
      {/* Drapeau fixe, toujours lisible. */}
      <Svg {...size} style={styles.fill}>
        <G transform={shift}>
          <Circle cx={flag.x + 1.5} cy={flag.y + 1.5} r={r} fill={Colors.ink} />
          <Circle cx={flag.x} cy={flag.y} r={r} fill={Colors.paper} stroke={Colors.ink} strokeWidth={Stroke.regular} />
          <Polygon points={pennant} fill={color.piece} stroke={Colors.ink} strokeWidth={Stroke.thin} strokeLinejoin="round" />
          <Path
            d={`M${poleX} ${top - r * 0.05} L${poleX} ${bottom}`}
            stroke={Colors.ink}
            strokeWidth={Stroke.regular}
            strokeLinecap="round"
          />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: -GOAL_OVERFLOW,
    left: -GOAL_OVERFLOW,
    pointerEvents: 'none',
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
});
