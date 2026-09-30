import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { aiAvatar } from '@/avatar/avatar';
import { DrawnButton } from '@/components/drawn-button';
import { GameLayout, TurnStatus } from '@/components/game-layout';
import { PlayerChip } from '@/components/player-chip';
import { VictoryOverlay } from '@/components/victory-overlay';
import { Colors, Typography } from '@/constants/theme';
import { AI_LEVEL_LABELS, parseControllers } from '@/hooks/game-setup';
import type { Controller } from '@/hooks/local-game-reducer';
import { useIsClient } from '@/hooks/use-is-client';
import { useLocalGame } from '@/hooks/use-local-game';

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
  const { session, profile } = useAuth();
  // Contre l'IA : ton avatar (tiré de ton compte, ou d'une graine locale sans compte) et ceux des IA.
  const avatarOf = (player: number) =>
    controllers[player] === 'human'
      ? { value: profile?.avatar ?? null, seed: session?.user.id ?? 'joueur-local' }
      : { value: aiAvatar(`local-${player}`), seed: `local-${player}` };
  const { game, selected, moves, animating, aiThinking, tap, animationEnd, reset } = useLocalGame(controllers);

  const goHome = () => router.dismissTo('/');
  const showVictory = game.status === 'finished' && game.winner !== null && !animating;
  const winnerMoves = game.history.filter((entry) => entry.player === game.winner).length;
  const winnerIsHuman = game.winner !== null && controllers[game.winner] === 'human';
  const finished = game.status === 'finished';
  const hint = finished
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
    <GameLayout
      header={
        <View style={styles.header}>
          <DrawnButton label="‹ Accueil" size="small" onPress={goHome} />
          <Text style={Typography.caption}>Coup {game.turn + 1}</Text>
        </View>
      }
      status={
        <TurnStatus
          turnKey={game.turn}
          thinking={aiThinking}
          hint={hint}
          player={
            finished ? null : (
              <PlayerChip
                player={game.currentPlayer}
                size={vsAi ? 40 : 22}
                detail={describeController(controllers[game.currentPlayer], vsAi)}
                avatar={vsAi ? avatarOf(game.currentPlayer) : undefined}
              />
            )
          }
        />
      }
      board={{ game, selected, moves, animating, onCellPress: tap, onAnimationEnd: animationEnd }}
      footer={<DrawnButton label="Nouvelle partie" size="small" onPress={reset} style={styles.reset} />}
      overlay={
        showVictory && (
          <VictoryOverlay
            winner={game.winner!}
            title={vsAi && !winnerIsHuman ? 'Perdu !' : 'Victoire !'}
            winnerDetail={vsAi ? describeController(controllers[game.winner!], vsAi) : undefined}
            winnerAvatar={vsAi ? avatarOf(game.winner!) : undefined}
            moveCount={winnerMoves}
            onReplay={reset}
            onHome={goHome}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reset: {
    alignSelf: 'center',
  },
});
