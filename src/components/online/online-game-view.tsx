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
import { TAP_NOTICE_TEXTS } from '@/mutators/mutators';
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
          ? TAP_NOTICE_TEXTS[notice]
          : selected && moves.length === 0
            ? 'Ce pion ne peut pas bouger.'
            : null
        : currentAway !== null && !current?.aiLevel
          ? `Déconnecté : forfait dans ${currentAway} s s’il ne revient pas.`
          : null;

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
  // Partie classée (au moins deux humains, assez de coups…) : on attend les points du serveur.
  // Sinon, rien n'est demandé ni affiché.
  const rankable =
    server.endReason !== null &&
    players.some((p) => p.userId === userId && p.playerIndex !== null) &&
    ratingOutcome(server, players).ranked;
  const rating = useGameRating(server.id, rankable);
  const winnerMoves = winner === null ? 0 : game.history.filter((entry) => entry.player === winner).length;
  const endTitle = server.endReason === 'abandoned' ? 'Partie arrêtée' : winner === me ? 'Victoire !' : 'Perdu !';
  const endMessage =
    server.endReason === 'abandoned'
      ? 'Il ne reste plus aucun joueur humain dans la partie.'
      : server.endReason === 'forfeit' && winner !== null
        ? winner === me
          ? 'Tu gagnes : les autres joueurs ont quitté la partie.'
          : `${nameOf(winner)} gagne : les autres joueurs ont quitté la partie.`
        : undefined;

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
              <title>{onlineTabTitle(turn)}</title>
            </Head>
          )}
          <Text style={Typography.caption}>
            Room {room.code} · Coup {game.turn + 1}
          </Text>
        </View>
      }
      players={
        <PlayersBar
          entries={game.players.map((player) => {
            const participant = playerAt(player.id);
            // Son propre signe de vie peut paraître ancien juste après une reprise : on est là, par définition.
            const away = participant && participant.userId !== userId ? secondsBeforeForfeit(participant, now) : null;
            const status = server.forfeited.includes(player.id) ? 'parti' : away !== null ? 'déconnecté' : null;
            const isCurrent = player.id === game.currentPlayer && !finished;
            return {
              player: player.id,
              label: nameOf(player.id),
              // Le joueur courant est écrit (« joue ») et entouré, pas seulement coloré.
              detail: status ?? (isCurrent ? 'joue' : undefined),
              avatar: avatarOf(player.id),
              turn: finished ? undefined : isCurrent ? 'active' : 'waiting',
              gone: status === 'parti',
              accessibilityLabel: `${nameOf(player.id)}${status ? `, ${status}` : ''}${isCurrent ? ', à son tour' : ''}`,
            };
          })}
        />
      }
      notice={
        error || resignError ? (
          <Pressable onPress={dismissNotice} accessibilityRole="button" accessibilityHint="Touche pour fermer">
            <Notice>{error ?? resignError}</Notice>
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
        iLeft && !finished ? (
          // Abandon dans une partie qui continue sans toi : on annonce, puis retour à l'accueil.
          <VictoryOverlay
            winner={null}
            title="Tu as abandonné"
            moveCount={0}
            message="La partie continue sans toi."
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
