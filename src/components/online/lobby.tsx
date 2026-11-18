import { router } from 'expo-router';
import { useState, type MutableRefObject } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice } from '@/components/auth-screen';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { MutatorSettings } from '@/components/mutator-settings';
import { PlayerChip } from '@/components/player-chip';
import { SegmentedPicker } from '@/components/segmented-picker';
import { Colors, MaxContentWidth, playerColor, playerColorName, Spacing, Stroke, Typography } from '@/constants/theme';
import { AI_LEVELS, type AiLevel } from '@/game';
import { aiLevelLabels } from '@/hooks/game-setup';
import { useT } from '@/i18n';
import { getSupabase } from '@/lib/supabase';
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS, type StoredGame } from '@/online';
import { participantAvatar, participantName } from '@/rooms/names';
import { isOnline } from '@/rooms/presence';
import {
  addAi,
  leaveRoom,
  removeAi,
  setAiLevel,
  setRoomMutators,
  shouldConfirmLeave,
  startGame,
  type RoomPlayer,
  type RoomSnapshot,
} from '@/rooms/room-service';
import { useOnlineAction } from '@/rooms/use-online-action';

interface LobbyProps {
  snapshot: RoomSnapshot;
  userId: string;
  now: number;
  onGame: (game: StoredGame | null) => void;
  /** Relit la room (après un changement que Realtime n'aurait pas encore signalé). */
  refresh: () => void;
  /** Passe à vrai quand le joueur quitte lui-même : la room qui disparaît n'est alors pas une fermeture par l'hôte. */
  leavingRef: MutableRefObject<boolean>;
}

/** Salle d'attente : code à partager, participants, IA (pour l'hôte), lancement. */
export function Lobby({ snapshot, userId, now, onGame, refresh, leavingRef }: LobbyProps) {
  const t = useT();
  const { room, players } = snapshot;
  const isHost = room.hostId === userId;
  const count = players.length;
  const { pending, error, run } = useOnlineAction();
  const client = getSupabase();

  const share = () => {
    Share.share({ message: t('lobby.shareMessage', { code: room.code }) }).catch(
      () => {},
    );
  };
  const act = (action: () => Promise<unknown>) =>
    run(async () => {
      await action();
      refresh();
    });
  const start = () =>
    run(async () => {
      onGame(await startGame(client, room.id));
      refresh();
    });
  const [confirmLeave, setConfirmLeave] = useState(false);
  const prompt = shouldConfirmLeave(snapshot, userId);
  // L'hôte ferme la room (supprimée pour tous) ; un autre joueur la quitte simplement.
  const leave = async () => {
    setConfirmLeave(false);
    leavingRef.current = true;
    const ok = await run(async () => {
      await leaveRoom(client, room.id);
      router.dismissTo('/online');
    });
    if (!ok) leavingRef.current = false;
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <DrawnButton label={t('common.back')} size="small" onPress={() => router.dismissTo('/online')} />
        </View>

        <View style={styles.titles}>
          <Text style={Typography.title} accessibilityRole="header">
            {t('lobby.title')}
          </Text>
          <Text style={Typography.caption}>{isHost ? t('lobby.hostText') : t('lobby.guestText')}</Text>
        </View>

        <DrawnCard contentStyle={styles.codeCard}>
          <Text style={Typography.caption}>{t('lobby.code')}</Text>
          <Text style={styles.code} selectable accessibilityLabel={t('lobby.codeSpoken', { letters: room.code.split('').join(' ') })}>
            {room.code}
          </Text>
          <DrawnButton label={t('lobby.shareCode')} size="small" onPress={share} color={playerColor(1).piece} />
        </DrawnCard>

        <DrawnCard contentStyle={styles.card}>
          <Text style={Typography.heading}>
            {t('lobby.participants', { count, max: MAX_PARTICIPANTS })}
          </Text>
          {players.map((player, index) => (
            <ParticipantRow
              key={player.id}
              player={player}
              // La place dans la liste devient l'identifiant du joueur au lancement : même couleur.
              index={index}
              userId={userId}
              hostId={room.hostId}
              online={player.userId === userId || isOnline(player, now)}
              editable={isHost}
              onLevel={(level) => act(() => setAiLevel(client, player.id, level))}
              onRemove={() => act(() => removeAi(client, player.id))}
            />
          ))}
          {isHost && count < MAX_PARTICIPANTS && (
            <DrawnButton
              label={t('lobby.addAi')}
              size="small"
              onPress={() => act(() => addAi(client, room.id, 'medium'))}
            />
          )}
          {count === 5 && <Text style={Typography.caption}>{t('lobby.fiveEmptyBranch')}</Text>}
        </DrawnCard>

        <MutatorSettings
          value={room.mutators}
          onChange={isHost ? (key, value) => act(() => setRoomMutators(client, room.id, { [key]: value })) : undefined}
          disabled={pending}
          caption={isHost ? t('lobby.mutatorsHost') : t('lobby.mutatorsGuest')}
        />

        {error && <Notice>{error}</Notice>}
      </ScrollView>

      <View style={styles.footer}>
        {isHost ? (
          count >= MIN_PARTICIPANTS ? (
            <DrawnButton
              label={t('lobby.launchWith', { count })}
              busy={pending}
              onPress={start}
              color={playerColor(0).piece}
            />
          ) : (
            <Text style={[Typography.caption, styles.center]}>
              {t('lobby.needPlayers')}
            </Text>
          )
        ) : (
          <Text style={[Typography.caption, styles.center]} accessibilityLiveRegion="polite">
            {t('lobby.waitingHost')}
          </Text>
        )}
        <DrawnButton
          label={t('online.leaveRoom')}
          size="small"
          onPress={prompt ? () => setConfirmLeave(true) : leave}
          disabled={pending}
          accessibilityHint={isHost ? t('online.hostDeletesHint') : t('lobby.rejoinHint')}
          style={styles.leave}
        />
      </View>
      {prompt && (
        <ConfirmDialog
          visible={confirmLeave}
          title={t('online.closeRoomTitle')}
          message={t('online.closeRoomMessage')}
          cancelLabel={t('lobby.stay')}
          confirmLabel={t('online.closeRoom')}
          onCancel={() => setConfirmLeave(false)}
          onConfirm={leave}
        />
      )}
    </SafeAreaView>
  );
}

interface ParticipantRowProps {
  player: RoomPlayer;
  index: number;
  userId: string;
  hostId: string;
  online: boolean;
  editable: boolean;
  onLevel: (level: AiLevel) => void;
  onRemove: () => void;
}

function ParticipantRow({ player, index, userId, hostId, online, editable, onLevel, onRemove }: ParticipantRowProps) {
  const t = useT();
  const details = [
    player.userId === hostId ? t('lobby.host') : null,
    player.userId !== null && !online ? t('lobby.disconnected') : null,
  ].filter(Boolean);
  const name = participantName(t, player, userId);
  return (
    // Arrivées et départs animés : on voit qui rejoint la room.
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOut.duration(150)}
      layout={LinearTransition}
      style={styles.participant}>
      <View style={styles.participantLine}>
        <View style={styles.flex}>
          <PlayerChip
            player={index}
            size={44}
            label={player.aiLevel ? t('ai.short') : name}
            detail={details.length > 0 ? details.join(' · ') : undefined}
            avatar={{ value: participantAvatar(player), seed: player.userId ?? player.id }}
          />
        </View>
        {player.aiLevel && editable && <DrawnButton label={t('common.remove')} size="small" onPress={onRemove} />}
      </View>
      {player.aiLevel &&
        (editable ? (
          <SegmentedPicker
            options={AI_LEVELS}
            labels={aiLevelLabels(t)}
            value={player.aiLevel}
            onChange={onLevel}
            color={playerColor(index).piece}
            accessibilityLabel={t('ai.levelOf', { color: playerColorName(t, index) })}
          />
        ) : (
          <Text style={Typography.caption}>{t(`ai.levelText.${player.aiLevel}`)}</Text>
        ))}
    </Animated.View>
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
  titles: {
    gap: Spacing.one,
  },
  codeCard: {
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  code: {
    ...Typography.display,
    letterSpacing: 6,
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  participant: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
    borderBottomWidth: Stroke.thin,
    borderBottomColor: Colors.line,
  },
  participantLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  footer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
    borderTopWidth: Stroke.regular,
    borderTopColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  center: {
    textAlign: 'center',
  },
  leave: {
    alignSelf: 'center',
  },
});
