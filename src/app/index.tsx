import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Board } from '@/components/board/board';
import { computeBoardLayout } from '@/components/board/layout';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { PlayerChip } from '@/components/player-chip';
import { Colors, MaxContentWidth, Spacing, Typography } from '@/constants/theme';
import { createGame } from '@/game';
import { useMeasuredSize } from '@/hooks/use-measured-size';

export default function HomeScreen() {
  const area = useMeasuredSize();
  const [preview] = useState(() => createGame(2));
  const layout = useMemo(() => computeBoardLayout(area.width, area.height), [area.width, area.height]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={Typography.display} accessibilityRole="header">
            Halma
          </Text>
          <Text style={Typography.caption}>Dames chinoises</Text>
        </View>

        <View
          style={styles.preview}
          onLayout={area.onLayout}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {layout.width > 0 && <Board game={preview} layout={layout} />}
        </View>

        <DrawnCard contentStyle={styles.card}>
          <Text style={Typography.heading}>Partie locale</Text>
          <Text style={Typography.caption}>À deux sur le même appareil, chacun son tour.</Text>
          <View style={styles.players}>
            <PlayerChip player={0} />
            <Text style={Typography.caption}>contre</Text>
            <PlayerChip player={1} />
          </View>
          <DrawnButton label="Jouer" onPress={() => router.push('/game')} color={Colors.paper} />
        </DrawnCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    justifyContent: 'space-between',
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  preview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  players: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
