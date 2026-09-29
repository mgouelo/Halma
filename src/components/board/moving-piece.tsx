import { useEffect, useEffectEvent, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';

import { Colors, MoveHopDuration, Stroke } from '@/constants/theme';

import type { Point } from './layout';

interface MovingPieceProps {
  /** Case de départ puis chaque case traversée, en pixels. */
  points: Point[];
  radius: number;
  color: string;
  onDone: () => void;
}

const useNativeDriver = Platform.OS !== 'web';

/**
 * Pion animé le long du chemin d'un coup, posé au-dessus du plateau SVG.
 * Chaque étape est un petit bond (le pion grossit puis retombe).
 */
export function MovingPiece({ points, radius, color, onDone }: MovingPieceProps) {
  const [position] = useState(() => new Animated.ValueXY(points[0]));
  const [scale] = useState(() => new Animated.Value(1));
  const finish = useEffectEvent(onDone);

  useEffect(() => {
    const hops = points.slice(1).map((to) =>
      Animated.parallel([
        Animated.timing(position, {
          toValue: to,
          duration: MoveHopDuration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.25, duration: MoveHopDuration / 2, useNativeDriver }),
          Animated.timing(scale, { toValue: 1, duration: MoveHopDuration / 2, useNativeDriver }),
        ]),
      ]),
    );
    const animation = Animated.sequence(hops);
    animation.start(({ finished }) => {
      if (finished) finish();
    });
    return () => animation.stop();
  }, [points, position, scale]);

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: radius * 2,
          height: radius * 2,
          borderRadius: radius,
          marginLeft: -radius,
          marginTop: -radius,
          backgroundColor: color,
          transform: [...position.getTranslateTransform(), { scale }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    pointerEvents: 'none',
    left: 0,
    top: 0,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
  },
});
