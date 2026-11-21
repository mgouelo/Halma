import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { MutatorSettings } from '@/components/mutator-settings';
import { useNavBarInset, useScreenEdges } from '@/components/nav-bar/screen-edges';
import { PlayerChip } from '@/components/player-chip';
import { SegmentedPicker } from '@/components/segmented-picker';
import { Stepper } from '@/components/stepper';
import { Colors, MaxContentWidth, playerColor, playerColorName, Spacing, Stroke, Typography } from '@/constants/theme';
import { AI_LEVELS, type AiLevel } from '@/game';
import { aiLevelLabels, MAX_AI_COUNT, MIN_AI_COUNT, serializeAiLevels } from '@/hooks/game-setup';
import { useT } from '@/i18n';
import { DEFAULT_MUTATORS, serializeMutators, type Mutators } from '@/mutators/mutators';

export default function AiSetupScreen() {
  const t = useT();
  const [count, setCount] = useState(1);
  const edges = useScreenEdges();
  const navInset = useNavBarInset();
  const [mutators, setMutators] = useState<Mutators>(DEFAULT_MUTATORS);
  // On garde les niveaux des 5 places : réduire puis augmenter le nombre d'IA ne perd pas les choix.
  const [levels, setLevels] = useState<AiLevel[]>(() => Array(MAX_AI_COUNT).fill('medium'));

  const setLevel = (index: number, level: AiLevel) =>
    setLevels((prev) => prev.map((current, i) => (i === index ? level : current)));

  const start = () =>
    router.push({
      pathname: '/game',
      params: { ai: serializeAiLevels(levels.slice(0, count)), ...serializeMutators(mutators) },
    });

  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Spacing.four + navInset }]}>
        <View style={styles.header}>
          <DrawnButton label={t('common.home')} size="small" onPress={() => router.back()} />
        </View>

        <Text style={Typography.title} accessibilityRole="header">
          {t('setup.aiTitle')}
        </Text>

        <DrawnCard contentStyle={styles.card}>
          <View style={styles.countRow}>
            <View style={styles.flex}>
              <Text style={Typography.heading}>{t('setup.aiCount')}</Text>
              <Text style={Typography.caption}>
                {count === 4
                  ? t('setup.boardPlayersEmptyBranch', { count: count + 1 })
                  : t('setup.boardPlayers', { count: count + 1 })}
              </Text>
            </View>
            <Stepper
              value={count}
              min={MIN_AI_COUNT}
              max={MAX_AI_COUNT}
              onChange={setCount}
              accessibilityLabel={t('setup.aiCount')}
            />
          </View>
        </DrawnCard>

        <DrawnCard contentStyle={styles.card}>
          <PlayerChip player={0} detail={t('setup.youAtBottom')} />
          {levels.slice(0, count).map((level, index) => {
            const player = index + 1;
            return (
              <View key={player} style={styles.aiRow}>
                <PlayerChip player={player} detail={t('ai.short')} />
                <SegmentedPicker
                  options={AI_LEVELS}
                  labels={aiLevelLabels(t)}
                  value={level}
                  onChange={(value) => setLevel(index, value)}
                  color={playerColor(player).piece}
                  accessibilityLabel={t('ai.levelOf', { color: playerColorName(t, player) })}
                />
              </View>
            );
          })}
        </DrawnCard>
        <MutatorSettings
          value={mutators}
          onChange={(key, value) => setMutators((prev) => ({ ...prev, [key]: value }))}
          caption={t('setup.options')}
        />
      </ScrollView>

      <View style={styles.footer}>
        <DrawnButton label={t('common.launchGame')} onPress={start} color={playerColor(0).piece} />
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
