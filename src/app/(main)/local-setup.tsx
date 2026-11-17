import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { MutatorSettings } from '@/components/mutator-settings';
import { useNavBarInset, useScreenEdges } from '@/components/nav-bar/screen-edges';
import { PlayerChip } from '@/components/player-chip';
import { Stepper } from '@/components/stepper';
import { Colors, MaxContentWidth, playerColor, playerColorName, Spacing, Stroke, Typography } from '@/constants/theme';
import { MAX_HUMAN_COUNT, MIN_HUMAN_COUNT, serializeHumanCount, turnOrderLabel } from '@/hooks/game-setup';
import { useT } from '@/i18n';
import { DEFAULT_MUTATORS, serializeMutators, type Mutators } from '@/mutators/mutators';

/** Partie entre amis sur le même appareil : de 2 à 6 joueurs qui se passent l'écran. */
export default function LocalSetupScreen() {
  const t = useT();
  const [count, setCount] = useState(MIN_HUMAN_COUNT);
  const edges = useScreenEdges();
  const navInset = useNavBarInset();
  const [mutators, setMutators] = useState<Mutators>(DEFAULT_MUTATORS);

  const start = () =>
    router.push({
      pathname: '/game',
      params: { players: serializeHumanCount(count), ...serializeMutators(mutators) },
    });

  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Spacing.four + navInset }]}>
        <View style={styles.header}>
          <DrawnButton label={t('common.home')} size="small" onPress={() => router.back()} />
        </View>

        <Text style={Typography.title} accessibilityRole="header">
          {t('setup.localTitle')}
        </Text>

        <DrawnCard contentStyle={styles.card}>
          <View style={styles.countRow}>
            <View style={styles.flex}>
              <Text style={Typography.heading}>{t('setup.playerCount')}</Text>
              <Text style={Typography.caption}>
                {count === 5 ? t('setup.sameDeviceEmptyBranch') : t('setup.sameDevice')}
              </Text>
            </View>
            <Stepper
              value={count}
              min={MIN_HUMAN_COUNT}
              max={MAX_HUMAN_COUNT}
              onChange={setCount}
              accessibilityLabel={t('setup.playerCount')}
            />
          </View>
        </DrawnCard>

        <DrawnCard contentStyle={styles.card}>
          <Text style={Typography.heading} accessibilityRole="header">
            {t('setup.turnOrder')}
          </Text>
          <View style={styles.players} accessibilityRole="list">
            {Array.from({ length: count }, (_, player) => (
              <View
                key={player}
                style={styles.playerRow}
                accessible
                accessibilityLabel={t('setup.playsAtLabel', {
                  color: playerColorName(t, player),
                  rank: turnOrderLabel(t, player),
                })}>
                <PlayerChip player={player} size={26} detail={t('setup.playsAt', { rank: turnOrderLabel(t, player) })} />
              </View>
            ))}
          </View>
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
