import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { useScreenEdges } from '@/components/nav-bar/screen-edges';
import { PlayerChip } from '@/components/player-chip';
import { Stepper } from '@/components/stepper';
import { Colors, MaxContentWidth, playerColor, Spacing, Stroke, Typography } from '@/constants/theme';
import { MAX_HUMAN_COUNT, MIN_HUMAN_COUNT, serializeHumanCount, turnOrderLabel } from '@/hooks/game-setup';

/** Partie entre amis sur le même appareil : de 2 à 6 joueurs qui se passent l'écran. */
export default function LocalSetupScreen() {
  const [count, setCount] = useState(MIN_HUMAN_COUNT);
  const edges = useScreenEdges();

  const start = () => router.push({ pathname: '/game', params: { players: serializeHumanCount(count) } });

  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <DrawnButton label="‹ Accueil" size="small" onPress={() => router.back()} />
        </View>

        <Text style={Typography.title} accessibilityRole="header">
          Entre amis
        </Text>

        <DrawnCard contentStyle={styles.card}>
          <View style={styles.countRow}>
            <View style={styles.flex}>
              <Text style={Typography.heading}>Nombre de joueurs</Text>
              <Text style={Typography.caption}>
                Sur le même appareil, chacun son tour
                {count === 5 ? ' ; une branche reste vide' : ''}
              </Text>
            </View>
            <Stepper
              value={count}
              min={MIN_HUMAN_COUNT}
              max={MAX_HUMAN_COUNT}
              onChange={setCount}
              accessibilityLabel="Nombre de joueurs"
            />
          </View>
        </DrawnCard>

        <DrawnCard contentStyle={styles.card}>
          <Text style={Typography.heading} accessibilityRole="header">
            Ordre du tour
          </Text>
          <View style={styles.players} accessibilityRole="list">
            {Array.from({ length: count }, (_, player) => (
              <View
                key={player}
                style={styles.playerRow}
                accessible
                accessibilityLabel={`${playerColor(player).name}, joue en ${turnOrderLabel(player)}`}>
                <PlayerChip player={player} size={26} detail={`joue en ${turnOrderLabel(player)}`} />
              </View>
            ))}
          </View>
        </DrawnCard>
      </ScrollView>

      <View style={styles.footer}>
        <DrawnButton label="Lancer la partie" onPress={start} color={playerColor(0).piece} />
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
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
  },
  footer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: Stroke.regular,
    borderTopColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
    gap: Spacing.one,
  },
  players: {
    gap: Spacing.two,
  },
  playerRow: {
    paddingVertical: Spacing.one,
  },
});
