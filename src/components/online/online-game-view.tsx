import { router } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Notice } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { goalPlayer } from '@/components/board/goal';
import { GameLayout } from '@/components/game-layout';
import { MutatorBadges } from '@/components/mutator-settings';
import { PlayersBar } from '@/components/players-bar';
import { VictoryOverlay } from '@/components/victory-overlay';
import { playerColor, Spacing, Typography } from '@/constants/theme';
import { useT } from '@/i18n';
import { tapNoticeText } from '@/mutators/mutators';
import { participantOfPlayer, ratingOutcome, type StoredGame } from '@/online';
import { participantAvatar, participantName } from '@/rooms/names';
import { secondsBeforeForfeit } from '@/rooms/presence';
import { describeOnlineError, type RoomSnapshot } from '@/rooms/room-service';
import { isMyTurn, onlineTabTitle, type OnlineTurn } from '@/rooms/turn-display';
import { useGameRating } from '@/rooms/use-game-rating';
import { useOnlineGame } from '@/rooms/use-online-game';

import { RatingResult } from './rating-result';

interface OnlineGameViewProps {
  snapshot: RoomSnapshot & { game: StoredGame };
  userId: string;
  now: number;
  onGame: (game: StoredGame | null) => void;
}

/** Partie en ligne : plateau, tour, joueurs (connectés ou non), abandon et fin de partie. */
export function OnlineGameView({ snapshot, userId, now, onGame }: OnlineGameViewProps) {
  const t = useT();
  const { room, players } = snapshot;
  // Mutateurs réglés par l'hôte dans la salle d'attente, figés au lancement (la room n'est plus modifiable).
  const { mutators } = room;
  const {
    game,
    server,
    me,
    selected,
    moves,
    animating,
    error,
    notice,
    tap,
    animationEnd,
    dismissError,
    resign,
  } = useOnlineGame({ roomId: room.id, server: snapshot.game, players, userId, now, onGame, mutators });
  const [confirmResign, setConfirmResign] = useState(false);
  const [resignError, setResignError] = useState<{ error: unknown } | null>(null);
  const [resigning, setResigning] = useState(false);

  const goHome = () => router.dismissTo('/');
  const playerAt = (index: number) => participantOfPlayer(players, index);
  const nameOf = (index: number) => participantName(t, playerAt(index), userId);
  const avatarOf = (index: number) => {
    const participant = playerAt(index);
    return participant
      ? { value: participantAvatar(participant), seed: participant.userId ?? participant.id }
      : undefined;
  };
  const iLeft = me !== null && server.forfeited.includes(me);
  const finished = game.status === 'finished';
  const current = playerAt(game.currentPlayer);
  const currentAway = current ? secondsBeforeForfeit(current, now) : null;
  const turn: OnlineTurn = {
    finished,
    me,
    forfeited: server.forfeited,
    currentPlayer: game.currentPlayer,
    currentName: nameOf(game.currentPlayer),
  };
  const myTurn = isMyTurn(turn);

  // Plus de bloc d'état : seuls les messages utiles apparaissent, par-dessus le bas du plateau.
  const info =
    finished || iLeft || animating
      ? null
      : myTurn
        ? notice
          ? tapNoticeText(t, notice)
          : selected && moves.length === 0
            ? t('mutators.cannotMove')
            : null
        : currentAway !== null && !current?.aiLevel
          ? t('game.awayForfeit', { n: currentAway })
          : null;

  const doResign = async () => {
    setResigning(true);
    try {
      await resign();
      setConfirmResign(false);
    } catch (e) {
      setResignError({ error: e });
    } finally {
      setResigning(false);
    }
  };

  const winner = game.winner;
  const showEnd = finished && !animating;
  // Partie classée (au moins deux humains, assez de coups…) : on attend les points du serveur.
  // Sinon, rien n'est demandé ni affiché.
  const rankable =
    server.endReason !== null &&
    players.some((p) => p.userId === userId && p.playerIndex !== null) &&
    ratingOutcome(server, players).ranked;
  const rating = useGameRating(server.id, rankable);
  const winnerMoves = winner === null ? 0 : game.history.filter((entry) => entry.player === winner).length;
  const endTitle =
    server.endReason === 'abandoned' ? t('game.stopped') : winner === me ? t('game.victory') : t('game.defeat');
  const endMessage =
    server.endReason === 'abandoned'
      ? t('game.noHumansLeft')
      : server.endReason === 'forfeit' && winner !== null
        ? winner === me
          ? t('game.youWinForfeit')
          : t('game.otherWinsForfeit', { name: nameOf(winner) })
        : undefined;
  // Erreur affichée (refus d'un coup, abandon refusé), traduite à l'affichage.
  const shownError =
    error !== null && error !== undefined
      ? describeOnlineError(t, error)
      : resignError
        ? describeOnlineError(t, resignError.error)
        : null;

  const dismissNotice = () => {
    dismissError();
    setResignError(null);
  };

  return (
    <GameLayout
      onHome={goHome}
      header={
        <View style={styles.header}>
          {/* Titre de l'onglet (web seulement) : « À toi de jouer ! » ou « En attente de … ». */}
          {Platform.OS === 'web' && (
            <Head>
              <title>{onlineTabTitle(t, turn)}</title>
            </Head>
          )}
          <Text style={Typography.caption}>
            {t('game.roomMove', { code: room.code, n: game.turn + 1 })}
          </Text>
        </View>
      }
      players={
        <PlayersBar
          entries={game.players.map((player) => {
            const participant = playerAt(player.id);
            // Son propre signe de vie peut paraître ancien juste après une reprise : on est là, par définition.
            const away = participant && participant.userId !== userId ? secondsBeforeForfeit(participant, now) : null;
            const gone = server.forfeited.includes(player.id);
            const status = gone ? t('game.statusGone') : away !== null ? t('game.statusAway') : null;
            const isCurrent = player.id === game.currentPlayer && !finished;
            return {
              player: player.id,
              label: nameOf(player.id),
              // Le joueur courant est écrit (« joue ») et entouré, pas seulement coloré.
              detail: status ?? (isCurrent ? t('game.statusPlaying') : undefined),
              avatar: avatarOf(player.id),
              turn: finished ? undefined : isCurrent ? 'active' : 'waiting',
              gone,
              accessibilityLabel: `${nameOf(player.id)}${status ? `, ${status}` : ''}${isCurrent ? t('game.itsTheirTurn') : ''}`,
            };
          })}
        />
      }
      notice={
        shownError ? (
          <Pressable onPress={dismissNotice} accessibilityRole="button" accessibilityHint={t('game.tapToClose')}>
            <Notice>{shownError}</Notice>
          </Pressable>
        ) : info ? (
          <Notice tone="info">{info}</Notice>
        ) : null
      }
      frameTint={finished ? undefined : playerColor(game.currentPlayer).tint}
      badges={<MutatorBadges value={mutators} />}
      board={{
        game,
        selected,
        // Sans « Clairvoyance », les cases atteignables ne sont pas dessinées.
        moves: mutators.clairvoyance ? moves : [],
        animating,
        goal: goalPlayer(game, { me, forfeited: server.forfeited }),
        onCellPress: tap,
        onAnimationEnd: animationEnd,
      }}
      footer={
        !finished &&
        !iLeft &&
        me !== null && (
          <View style={styles.footer}>
            {confirmResign ? (
              <>
                <DrawnButton label={t('game.resignConfirm')} size="small" onPress={doResign} busy={resigning} />
                <DrawnButton
                  label={t('game.resignContinue')}
                  size="small"
                  onPress={() => setConfirmResign(false)}
                  disabled={resigning}
                />
              </>
            ) : (
              <DrawnButton label={t('game.resign')} size="small" onPress={() => setConfirmResign(true)} />
            )}
          </View>
        )
      }
      overlay={
        iLeft && !finished ? (
          // Abandon dans une partie qui continue sans toi : on annonce, puis retour à l'accueil.
          <VictoryOverlay
            winner={null}
            title={t('game.resigned')}
            moveCount={0}
            message={t('game.continuesWithoutYou')}
            onHome={goHome}
          />
        ) : showEnd && (
          <VictoryOverlay
            winner={winner}
            title={endTitle}
            winnerDetail={winner === null ? undefined : nameOf(winner)}
            winnerAvatar={winner === null ? undefined : avatarOf(winner)}
            moveCount={winnerMoves}
            message={endMessage}
            extra={<RatingResult view={rating} />}
            onHome={goHome}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
