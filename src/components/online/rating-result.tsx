import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Colors, Fonts, playerColor, Radius, Shadow, Spacing, Stroke, Typography } from '@/constants/theme';
import type { GameRatingView } from '@/rooms/use-game-rating';
import { formatPointsDelta, formatScore } from '@/stats/leaderboard';

import { ThinkingDots } from '../state-view';

/**
 * Points gagnés ou perdus, sur l'écran de fin d'une partie en ligne classée :
 * « +27 points », puis le nouveau total. Le signe porte le sens (la couleur,
 * menthe ou rose, n'est qu'un appoint). Rien pour une partie non classée.
 */
export function RatingResult({ view }: { view: GameRatingView }) {
  if (view.status === 'hidden') return null;
  if (view.status === 'pending') {
    return (
      <View style={styles.pending} accessible accessibilityLabel="Calcul des points…" accessibilityLiveRegion="polite">
        <ThinkingDots />
        <Text style={Typography.caption}>Calcul des points…</Text>
      </View>
    );
  }
  if (view.status === 'late') {
    return (
      <Text style={[Typography.caption, styles.center]} accessibilityLiveRegion="polite">
        Tes points arrivent : retrouve-les bientôt sur ton profil.
      </Text>
    );
  }
  const gained = view.delta >= 0;
  const delta = formatPointsDelta(view.delta);
  const total = formatScore('points', view.ratingAfter);
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={styles.result}
      accessible
      accessibilityLabel={`${delta}. Nouveau total : ${total}.`}
      accessibilityLiveRegion="polite">
      <Animated.View entering={ZoomIn.duration(220)} style={styles.badgeWrap}>
        <View style={styles.badgeShadow} />
        <View style={[styles.badge, { backgroundColor: gained ? playerColor(2).piece : playerColor(0).piece }]}>
          <Text style={styles.delta}>{delta}</Text>
        </View>
      </Animated.View>
      <Text style={Typography.caption}>Nouveau total : {total}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 40,
  },
  center: {
    textAlign: 'center',
  },
  result: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  badgeWrap: {
    paddingRight: Shadow.offset,
    paddingBottom: Shadow.offset,
  },
  badgeShadow: {
    ...StyleSheet.absoluteFill,
    top: Shadow.offset,
    left: Shadow.offset,
    borderRadius: Radius.round,
    backgroundColor: Colors.ink,
  },
  badge: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one,
    borderWidth: Stroke.bold,
    borderColor: Colors.ink,
    borderRadius: Radius.round,
  },
  delta: {
    ...Typography.heading,
    fontFamily: Fonts.bold,
    fontSize: 22,
  },
});
