import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice } from '@/components/auth-screen';
import { Board } from '@/components/board/board';
import { computeBoardLayout } from '@/components/board/layout';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { PlayerChip } from '@/components/player-chip';
import { VictoryOverlay } from '@/components/victory-overlay';
import { Colors, MaxContentWidth, Radius, Shadow, Spacing, Stroke, Typography } from '@/constants/theme';
import { useMeasuredSize } from '@/hooks/use-measured-size';
import { participantOfPlayer, type StoredGame } from '@/online';
import { participantName } from '@/rooms/names';
import { secondsBeforeForfeit } from '@/rooms/presence';
import { describeOnlineError, type RoomSnapshot } from '@/rooms/room-service';
import { useOnlineGame } from '@/rooms/use-online-game';

/** Place prise par le cadre de la carte autour du plateau (bords, marge, ombre). */
const CARD_INSET = (Stroke.bold + Spacing.two) * 2 + Shadow.offset;

interface OnlineGameViewProps {
  snapshot: RoomSnapshot & { game: StoredGame };
  userId: string;
  now: number;
  onGame: (game: StoredGame | null) => void;
}

/** Partie en ligne : plateau, tour, joueurs (connectés ou non), abandon et fin de partie. */
export function OnlineGameView({ snapshot, userId, now, onGame }: OnlineGameViewProps) {
  const { room, players } = snapshot;
  const area = useMeasuredSize();
  const { game, server, me, selected, moves, animating, pending, error, tap, animationEnd, dismissError, resign } =
    useOnlineGame({ roomId: room.id, server: snapshot.game, players, userId, now, onGame });
  const [confirmResign, setConfirmResign] = useState(false);
  const [resignError, setResignError] = useState<string | null>(null);

  const layout = useMemo(
    () => computeBoardLayout(area.width - CARD_INSET, area.height - CARD_INSET),
    [area.width, area.height],
  );

  const goHome = () => router.dismissTo('/');
  const playerAt = (index: number) => participantOfPlayer(players, index);
  const nameOf = (index: number) => participantName(playerAt(index), userId);
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
    setConfirmResign(false);
    try {
      await resign();
    } catch (e) {
      setResignError(describeOnlineError(e));
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

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <DrawnButton label="‹ Accueil" size="small" onPress={goHome} />
          <Text style={Typography.caption}>
            Room {room.code} · Coup {game.turn + 1}
          </Text>
        </View>

        <View style={styles.players}>
          {game.players.map((player) => {
            const participant = playerAt(player.id);
            // Son propre signe de vie peut paraître ancien juste après une reprise : on est là, par définition.
            const away = participant && participant.userId !== userId ? secondsBeforeForfeit(participant, now) : null;
            const status = server.forfeited.includes(player.id) ? 'parti' : away !== null ? 'déconnecté' : null;
            return (
              <View
                key={player.id}
                style={[
                  styles.playerTag,
                  player.id === game.currentPlayer && !finished && styles.playerTagCurrent,
                  status === 'parti' && styles.playerTagGone,
                ]}>
                <PlayerChip player={player.id} size={14} label={nameOf(player.id)} detail={status ?? undefined} />
              </View>
            );
          })}
        </View>

        <View style={styles.turn} accessibilityLiveRegion="polite">
          {!finished && (
            <>
              <Text style={Typography.caption}>Au tour de</Text>
              <PlayerChip player={game.currentPlayer} size={22} label={nameOf(game.currentPlayer)} />
            </>
          )}
          <Text style={[Typography.caption, styles.center]}>{hint}</Text>
        </View>

        {(error || resignError) && (
          <Pressable
            onPress={() => {
              dismissError();
              setResignError(null);
            }}
            accessibilityHint="Touche pour fermer">
            <Notice>{error ?? resignError}</Notice>
          </Pressable>
        )}

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

        {!finished && !iLeft && me !== null && (
          <View style={styles.footer}>
            {confirmResign ? (
              <>
                <DrawnButton label="Oui, abandonner" size="small" onPress={doResign} />
                <DrawnButton label="Continuer" size="small" onPress={() => setConfirmResign(false)} />
              </>
            ) : (
              <DrawnButton label="Abandonner" size="small" onPress={() => setConfirmResign(true)} />
            )}
          </View>
        )}
      </View>

      {showEnd && (
        <VictoryOverlay
          winner={winner}
          title={endTitle}
          winnerDetail={winner === null ? undefined : nameOf(winner)}
          moveCount={winnerMoves}
          message={endMessage}
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
  playerTagGone: {
    opacity: 0.45,
  },
  turn: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  center: {
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
