import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Notice } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { GameLayout, TurnStatus } from '@/components/game-layout';
import { PlayerChip } from '@/components/player-chip';
import { VictoryOverlay } from '@/components/victory-overlay';
import { Colors, Radius, Spacing, Stroke, Typography } from '@/constants/theme';
import { participantOfPlayer, type StoredGame } from '@/online';
import { participantAvatar, participantName } from '@/rooms/names';
import { secondsBeforeForfeit } from '@/rooms/presence';
import { describeOnlineError, type RoomSnapshot } from '@/rooms/room-service';
import { useOnlineGame } from '@/rooms/use-online-game';

interface OnlineGameViewProps {
  snapshot: RoomSnapshot & { game: StoredGame };
  userId: string;
  now: number;
  onGame: (game: StoredGame | null) => void;
}

/** Partie en ligne : plateau, tour, joueurs (connectés ou non), abandon et fin de partie. */
export function OnlineGameView({ snapshot, userId, now, onGame }: OnlineGameViewProps) {
  const { room, players } = snapshot;
  const { game, server, me, selected, moves, animating, pending, error, tap, animationEnd, dismissError, resign } =
    useOnlineGame({ roomId: room.id, server: snapshot.game, players, userId, now, onGame });
  const [confirmResign, setConfirmResign] = useState(false);
  const [resignError, setResignError] = useState<string | null>(null);
  const [resigning, setResigning] = useState(false);

  const goHome = () => router.dismissTo('/');
  const playerAt = (index: number) => participantOfPlayer(players, index);
  const nameOf = (index: number) => participantName(playerAt(index), userId);
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

  const hint = finished
    ? 'Partie terminée.'
    : iLeft
      ? 'Tu as quitté la partie : tu la regardes.'
      : pending
        ? 'Envoi du coup…'
        : animating
          ? ' '
          : game.currentPlayer === me
            ? selected
              ? moves.length > 0
                ? 'Touche une case en pointillés pour jouer.'
                : 'Ce pion ne peut pas bouger.'
              : 'À toi ! Touche un de tes pions.'
            : current?.aiLevel
              ? 'L’IA réfléchit…'
              : currentAway !== null
                ? `Déconnecté : forfait dans ${currentAway} s s’il ne revient pas.`
                : 'En attente de son coup…';

  const doResign = async () => {
    setResigning(true);
    try {
      await resign();
      setConfirmResign(false);
    } catch (e) {
      setResignError(describeOnlineError(e));
    } finally {
      setResigning(false);
    }
  };

  const winner = game.winner;
  const showEnd = finished && !animating;
  const winnerMoves = winner === null ? 0 : game.history.filter((entry) => entry.player === winner).length;
  const endTitle = server.endReason === 'abandoned' ? 'Partie arrêtée' : winner === me ? 'Victoire !' : 'Perdu !';
  const endMessage =
    server.endReason === 'abandoned'
      ? 'Il ne reste plus aucun joueur humain dans la partie.'
      : server.endReason === 'forfeit' && winner !== null
        ? `${nameOf(winner)} gagne : les autres joueurs ont quitté la partie.`
        : undefined;

  const thinking = !finished && !animating && !pending && Boolean(current?.aiLevel);
  const dismissNotice = () => {
    dismissError();
    setResignError(null);
  };

  return (
    <GameLayout
      header={
        <View style={styles.header}>
          <DrawnButton label="‹ Accueil" size="small" onPress={goHome} />
          <Text style={Typography.caption}>
            Room {room.code} · Coup {game.turn + 1}
          </Text>
        </View>
      }
      players={
        <View style={styles.players} accessibilityRole="list" accessibilityLabel="Joueurs">
          {game.players.map((player) => {
            const participant = playerAt(player.id);
            // Son propre signe de vie peut paraître ancien juste après une reprise : on est là, par définition.
            const away = participant && participant.userId !== userId ? secondsBeforeForfeit(participant, now) : null;
            const status = server.forfeited.includes(player.id) ? 'parti' : away !== null ? 'déconnecté' : null;
            const isCurrent = player.id === game.currentPlayer && !finished;
            return (
              <View
                key={player.id}
                accessibilityLabel={`${nameOf(player.id)}${status ? `, ${status}` : ''}${isCurrent ? ', à son tour' : ''}`}
                style={[
                  styles.playerTag,
                  isCurrent && styles.playerTagCurrent,
                  status === 'parti' && styles.playerTagGone,
                ]}>
                <PlayerChip
                  player={player.id}
                  size={30}
                  label={nameOf(player.id)}
                  detail={status ?? undefined}
                  avatar={avatarOf(player.id)}
                />
              </View>
            );
          })}
        </View>
      }
      status={
        <TurnStatus
          turnKey={game.turn}
          thinking={thinking}
          hint={hint}
          player={
            finished ? null : (
              <PlayerChip
                player={game.currentPlayer}
                size={40}
                label={nameOf(game.currentPlayer)}
                avatar={avatarOf(game.currentPlayer)}
              />
            )
          }
        />
      }
      notice={
        (error || resignError) && (
          <Pressable onPress={dismissNotice} accessibilityRole="button" accessibilityHint="Touche pour fermer">
            <Notice>{error ?? resignError}</Notice>
          </Pressable>
        )
      }
      board={{ game, selected, moves, animating, onCellPress: tap, onAnimationEnd: animationEnd }}
      footer={
        !finished &&
        !iLeft &&
        me !== null && (
          <View style={styles.footer}>
            {confirmResign ? (
              <>
                <DrawnButton label="Oui, abandonner" size="small" onPress={doResign} busy={resigning} />
                <DrawnButton
                  label="Continuer"
                  size="small"
                  onPress={() => setConfirmResign(false)}
                  disabled={resigning}
                />
              </>
            ) : (
              <DrawnButton label="Abandonner" size="small" onPress={() => setConfirmResign(true)} />
            )}
          </View>
        )
      }
      overlay={
        showEnd && (
          <VictoryOverlay
            winner={winner}
            title={endTitle}
            winnerDetail={winner === null ? undefined : nameOf(winner)}
            winnerAvatar={winner === null ? undefined : avatarOf(winner)}
            moveCount={winnerMoves}
            message={endMessage}
            onHome={goHome}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  players: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  playerTag: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderWidth: Stroke.thin,
    borderColor: Colors.line,
    borderRadius: Radius.round,
    maxWidth: '100%',
  },
  playerTagCurrent: {
    borderColor: Colors.ink,
    borderWidth: Stroke.regular,
  },
  // Joueur parti : trait en pointillés plutôt que transparence, pour garder un texte lisible.
  playerTagGone: {
    borderStyle: 'dashed',
    borderColor: Colors.inkSoft,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
