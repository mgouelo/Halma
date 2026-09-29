import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Board } from '@/components/board/board';
import { computeBoardLayout } from '@/components/board/layout';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { PlayerChip } from '@/components/player-chip';
import { VictoryOverlay } from '@/components/victory-overlay';
import { Colors, MaxContentWidth, Shadow, Spacing, Stroke, Typography } from '@/constants/theme';
import { AI_LEVEL_LABELS, parseControllers } from '@/hooks/game-setup';
import type { Controller } from '@/hooks/local-game-reducer';
import { useIsClient } from '@/hooks/use-is-client';
import { useLocalGame } from '@/hooks/use-local-game';
import { useMeasuredSize } from '@/hooks/use-measured-size';

/** Place prise par le cadre de la carte autour du plateau (bords, marge, ombre). */
const CARD_INSET = (Stroke.bold + Spacing.two) * 2 + Shadow.offset;

function describeController(controller: Controller, vsAi: boolean): string | undefined {
  if (controller !== 'human') return `IA · ${AI_LEVEL_LABELS[controller]}`;
  return vsAi ? 'Toi' : undefined;
}

export default function GameScreen() {
  // Les paramètres de l'URL sont inconnus lors de l'export statique web : on ne
  // dessine la partie qu'au client pour éviter un écart à l'hydratation.
  const isClient = useIsClient();
  return isClient ? <GameView /> : <SafeAreaView style={styles.screen} />;
}

function GameView() {
  const { ai } = useLocalSearchParams<{ ai?: string }>();
  const [controllers] = useState(() => parseControllers(ai));
  const vsAi = controllers.some((c) => c !== 'human');
  const area = useMeasuredSize();
  const { game, selected, moves, animating, aiThinking, tap, animationEnd, reset } = useLocalGame(controllers);

  const layout = useMemo(
    () => computeBoardLayout(area.width - CARD_INSET, area.height - CARD_INSET),
    [area.width, area.height],
  );

  const goHome = () => router.dismissTo('/');
  const showVictory = game.status === 'finished' && game.winner !== null && !animating;
  const winnerMoves = game.history.filter((entry) => entry.player === game.winner).length;
  const winnerIsHuman = game.winner !== null && controllers[game.winner] === 'human';
  const hint = game.status === 'finished'
    ? 'Partie terminée.'
    : aiThinking
    ? 'L’IA réfléchit…'
    : animating
    ? ' '
    : selected
    ? moves.length > 0
      ? 'Touche une case en pointillés pour jouer.'
      : 'Ce pion ne peut pas bouger.'
    : 'Touche un de tes pions.';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <DrawnButton label="‹ Accueil" size="small" onPress={goHome} />
          <Text style={Typography.caption}>Coup {game.turn + 1}</Text>
        </View>

        <View style={styles.turn} accessibilityLiveRegion="polite">
          <Text style={Typography.caption}>Au tour de</Text>
          <PlayerChip
            player={game.currentPlayer}
            size={22}
            detail={describeController(controllers[game.currentPlayer], vsAi)}
          />
          <Text style={[Typography.caption, styles.hint]}>{hint}</Text>
        </View>

        <View style={styles.boardArea} onLayout={area.onLayout}>
          {layout.width > 0 && (
            <DrawnCard contentStyle={styles.boardFace}>
              <Board
                game={game}
                layout={layout}
                selected={selected}
                moves={moves}
                animating={animating}
                onCellPress={tap}
                onAnimationEnd={animationEnd}
              />
            </DrawnCard>
          )}
        </View>

        <DrawnButton label="Nouvelle partie" size="small" onPress={reset} style={styles.reset} />
      </View>

      {showVictory && (
        <VictoryOverlay
          winner={game.winner!}
          title={vsAi && !winnerIsHuman ? 'Perdu !' : 'Victoire !'}
          winnerDetail={vsAi ? describeController(controllers[game.winner!], vsAi) : undefined}
          moveCount={winnerMoves}
          onReplay={reset}
          onHome={goHome}
        />
      )}
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  turn: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  hint: {
    textAlign: 'center',
  },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardFace: {
    padding: Spacing.two,
  },
  reset: {
    alignSelf: 'center',
  },
});
