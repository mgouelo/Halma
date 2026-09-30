import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountBar } from '@/components/account-bar';
import { Board } from '@/components/board/board';
import { computeBoardLayout } from '@/components/board/layout';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { Colors, MaxContentWidth, playerColor, Spacing, Typography } from '@/constants/theme';
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
          <View style={styles.titles}>
            <Text style={Typography.display} accessibilityRole="header">
              Halma
            </Text>
            <Text style={Typography.caption}>Dames chinoises</Text>
          </View>
          <AccountBar />
        </View>

        <View
          style={styles.preview}
          onLayout={area.onLayout}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {layout.width > 0 && <Board game={preview} layout={layout} />}
        </View>

        <View style={styles.modes}>
          <DrawnCard contentStyle={styles.card}>
            <Text style={Typography.heading}>En ligne</Text>
            <Text style={Typography.caption}>Crée une room ou rejoins tes amis avec un code, IA en renfort.</Text>
            <DrawnButton
              label="Jouer en ligne"
              onPress={() => router.push('/online')}
              color={playerColor(1).piece}
            />
          </DrawnCard>
          <DrawnCard contentStyle={styles.card}>
            <Text style={Typography.heading}>Hors ligne</Text>
            <Text style={Typography.caption}>
              Contre 1 à 5 IA (trois niveaux), ou à deux sur le même appareil.
            </Text>
            <View style={styles.buttonRow}>
              <DrawnButton
                label="Contre l’IA"
                onPress={() => router.push('/ai-setup')}
                color={playerColor(0).piece}
                size="small"
                style={styles.flexButton}
              />
              <DrawnButton label="À deux" onPress={() => router.push('/game')} size="small" style={styles.flexButton} />
            </View>
          </DrawnCard>
        </View>
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
    gap: Spacing.three,
  },
  titles: {
    gap: Spacing.one,
  },
  preview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modes: {
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flexButton: {
    flex: 1,
  },
});
