import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { PlayerChip } from '@/components/player-chip';
import { SegmentedPicker } from '@/components/segmented-picker';
import { Stepper } from '@/components/stepper';
import { Colors, MaxContentWidth, playerColor, Spacing, Stroke, Typography } from '@/constants/theme';
import { AI_LEVELS, type AiLevel } from '@/game';
import { AI_LEVEL_LABELS, MAX_AI_COUNT, MIN_AI_COUNT, serializeAiLevels } from '@/hooks/game-setup';

export default function AiSetupScreen() {
  const [count, setCount] = useState(1);
  // On garde les niveaux des 5 places : réduire puis augmenter le nombre d'IA ne perd pas les choix.
  const [levels, setLevels] = useState<AiLevel[]>(() => Array(MAX_AI_COUNT).fill('medium'));

  const setLevel = (index: number, level: AiLevel) =>
    setLevels((prev) => prev.map((current, i) => (i === index ? level : current)));

  const start = () =>
    router.push({ pathname: '/game', params: { ai: serializeAiLevels(levels.slice(0, count)) } });

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <DrawnButton label="‹ Accueil" size="small" onPress={() => router.back()} />
        </View>

        <Text style={Typography.title} accessibilityRole="header">
          Jouer contre l’IA
        </Text>

        <DrawnCard contentStyle={styles.card}>
          <View style={styles.countRow}>
            <View style={styles.flex}>
              <Text style={Typography.heading}>Nombre d’IA</Text>
              <Text style={Typography.caption}>
                {count + 1} joueurs sur le plateau
                {count === 4 ? ', une branche reste vide' : ''}
              </Text>
            </View>
            <Stepper
              value={count}
              min={MIN_AI_COUNT}
              max={MAX_AI_COUNT}
              onChange={setCount}
              accessibilityLabel="Nombre d’IA"
            />
          </View>
        </DrawnCard>

        <DrawnCard contentStyle={styles.card}>
          <PlayerChip player={0} detail="Toi, en bas" />
          {levels.slice(0, count).map((level, index) => {
            const player = index + 1;
            return (
              <View key={player} style={styles.aiRow}>
                <PlayerChip player={player} detail="IA" />
                <SegmentedPicker
                  options={AI_LEVELS}
                  labels={AI_LEVEL_LABELS}
                  value={level}
                  onChange={(value) => setLevel(index, value)}
                  color={playerColor(player).piece}
                  accessibilityLabel={`Niveau de l’IA ${playerColor(player).name}`}
                />
              </View>
            );
          })}
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
    gap: Spacing.four,
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
  aiRow: {
    gap: Spacing.two,
  },
});
