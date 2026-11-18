import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { aiAvatar } from '@/avatar/avatar';
import { goalPlayer } from '@/components/board/goal';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Notice } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { GameLayout } from '@/components/game-layout';
import { MutatorBadges } from '@/components/mutator-settings';
import { PlayersBar } from '@/components/players-bar';
import { VictoryOverlay } from '@/components/victory-overlay';
import { Colors, playerColor, playerColorName, Typography } from '@/constants/theme';
import { aiName, parseControllers } from '@/hooks/game-setup';
import { guardTexts, needsConfirmation } from '@/hooks/leave-guard';
import type { Controller } from '@/hooks/local-game-reducer';
import { useIsClient } from '@/hooks/use-is-client';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { useLocalGame } from '@/hooks/use-local-game';
import { useT, type Translator } from '@/i18n';
import { parseMutatorParams, tapNoticeText, type Mutators } from '@/mutators/mutators';

function describeController(t: Translator, controller: Controller, vsAi: boolean): string | undefined {
  if (controller !== 'human') return aiName(t, controller);
  return vsAi ? t('common.you') : undefined;
}

export default function GameScreen() {
  // Les paramètres de l'URL sont inconnus lors de l'export statique web : on ne
  // dessine la partie qu'au client pour éviter un écart à l'hydratation.
  const isClient = useIsClient();
  return isClient ? <GameView /> : <SafeAreaView style={styles.screen} />;
}

function GameView() {
  const t = useT();
  const params = useLocalSearchParams<{ ai?: string; players?: string; touch?: string; clairvoyance?: string }>();
  const [controllers] = useState(() => parseControllers(params.ai, params.players));
  const [mutators] = useState<Mutators>(() => parseMutatorParams(params));
  const vsAi = controllers.some((c) => c !== 'human');
  const { session, profile } = useAuth();
  // Contre l'IA : ton avatar (tiré de ton compte, ou d'une graine locale sans compte) et ceux des IA.
  const avatarOf = (player: number) =>
    controllers[player] === 'human'
      ? { value: profile?.avatar ?? null, seed: session?.user.id ?? 'joueur-local' }
      : { value: aiAvatar(`local-${player}`), seed: `local-${player}` };
  const { game, selected, moves, animating, notice, tap, animationEnd, reset } = useLocalGame(
    controllers,
    mutators,
  );

  // La partie n'existe que dans l'état de cet écran : le quitter la supprime.
  // Tant qu'elle est en cours, on demande d'abord confirmation (voir useLeaveGuard).
  const guard = useLeaveGuard(needsConfirmation(game), reset);
  const goHome = () => router.dismissTo('/');
  const showVictory = game.status === 'finished' && game.winner !== null && !animating;
  const winnerMoves = game.history.filter((entry) => entry.player === game.winner).length;
  const winnerIsHuman = game.winner !== null && controllers[game.winner] === 'human';
  const finished = game.status === 'finished';
  // Plus de bloc d'état : seuls les retours utiles apparaissent, par-dessus le bas du plateau.
  const info =
    finished || animating
      ? null
      : notice
        ? tapNoticeText(t, notice)
        : selected && moves.length === 0
          ? t('mutators.cannotMove')
          : null;

  return (
    <GameLayout
      onHome={goHome}
      header={
        <View style={styles.header}>
          <Text style={Typography.caption}>{t('game.move', { n: game.turn + 1 })}</Text>
        </View>
      }
      players={
        <PlayersBar
          entries={game.players.map((player) => {
            const isCurrent = player.id === game.currentPlayer && !finished;
            const detail = describeController(t, controllers[player.id], vsAi);
            return {
              player: player.id,
              // Contre l'IA : avatars ; entre amis sur le même écran : pastilles de couleur.
              avatar: vsAi ? avatarOf(player.id) : undefined,
              detail: isCurrent ? detail : undefined,
              turn: finished ? undefined : isCurrent ? 'active' : 'waiting',
              accessibilityLabel: `${playerColorName(t, player.id)}${detail ? `, ${detail}` : ''}${isCurrent ? t('game.itsTheirTurn') : ''}`,
            };
          })}
        />
      }
      notice={info ? <Notice tone="info">{info}</Notice> : null}
      frameTint={finished ? undefined : playerColor(game.currentPlayer).tint}
      badges={<MutatorBadges value={mutators} />}
      board={{
        game,
        selected,
        // Sans « Clairvoyance », les cases atteignables ne sont pas dessinées (le réducteur les connaît toujours).
        moves: mutators.clairvoyance ? moves : [],
        animating,
        goal: goalPlayer(game),
        onCellPress: tap,
        onAnimationEnd: animationEnd,
      }}
      footer={
        <DrawnButton label={t('game.newGame')} size="small" onPress={guard.requestRestart} style={styles.reset} />
      }
      overlay={
        <>
          {showVictory && (
            <VictoryOverlay
              winner={game.winner!}
              title={vsAi && !winnerIsHuman ? t('game.defeat') : t('game.victory')}
              winnerDetail={vsAi ? describeController(t, controllers[game.winner!], vsAi) : undefined}
              winnerAvatar={vsAi ? avatarOf(game.winner!) : undefined}
              moveCount={winnerMoves}
              onReplay={reset}
              onHome={goHome}
            />
          )}
          <ConfirmDialog
            visible={guard.kind !== null}
            {...guardTexts(t, guard.kind ?? 'leave')}
            onCancel={guard.cancel}
            onConfirm={guard.confirm}
          />
        </>
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
    alignItems: 'center',
  },
  reset: {
    alignSelf: 'center',
  },
});
