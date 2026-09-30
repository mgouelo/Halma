import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors, playerColor, Spacing, Stroke, Typography } from '@/constants/theme';

import { DrawnButton } from './drawn-button';
import { DrawnCard } from './drawn-card';

const DOT = 12;
const HOP_MS = 260;

function Dot({ index }: { index: number }) {
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    lift.value = withDelay(
      index * (HOP_MS / 2),
      withRepeat(withSequence(withTiming(-DOT * 0.6, { duration: HOP_MS }), withTiming(0, { duration: HOP_MS })), -1),
    );
  }, [index, lift, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: playerColor(index).piece }, style]} />;
}

/**
 * Trois pions pastel qui sautent l'un après l'autre : l'indicateur d'attente de
 * l'application (chargement, IA qui réfléchit). Immobile si l'utilisateur a
 * demandé de réduire les animations.
 */
export function ThinkingDots() {
  return (
    <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} />
      ))}
    </View>
  );
}

/** Écran (ou zone) en cours de chargement. */
export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <Animated.View
      entering={FadeIn.delay(150)}
      style={styles.center}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite">
      <ThinkingDots />
      <Text style={Typography.caption}>{label}</Text>
    </Animated.View>
  );
}

/** Échec de chargement, avec un bouton pour réessayer. */
export function ErrorState({
  title = 'Impossible de charger',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Animated.View entering={FadeIn}>
      <DrawnCard contentStyle={styles.card}>
        <Text style={Typography.heading} accessibilityRole="header">
          {title}
        </Text>
        <Text style={Typography.body} accessibilityLiveRegion="polite">
          {message}
        </Text>
        {onRetry && <DrawnButton label="Réessayer" size="small" onPress={onRetry} style={styles.retry} />}
      </DrawnCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.two,
    height: DOT * 2,
    alignItems: 'flex-end',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  retry: {
    alignSelf: 'flex-start',
  },
});
