import { router } from 'expo-router';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { PlayerChip } from '@/components/player-chip';
import { SegmentedPicker } from '@/components/segmented-picker';
import { Colors, MaxContentWidth, playerColor, Spacing, Stroke, Typography } from '@/constants/theme';
import { AI_LEVELS, type AiLevel } from '@/game';
import { AI_LEVEL_LABELS } from '@/hooks/game-setup';
import { getSupabase } from '@/lib/supabase';
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS, type StoredGame } from '@/online';
import { participantName } from '@/rooms/names';
import { isOnline } from '@/rooms/presence';
import {
  addAi,
  leaveRoom,
  removeAi,
  setAiLevel,
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
}

/** Salle d'attente : code à partager, participants, IA (pour l'hôte), lancement. */
export function Lobby({ snapshot, userId, now, onGame, refresh }: LobbyProps) {
  const { room, players } = snapshot;
  const isHost = room.hostId === userId;
  const count = players.length;
  const { pending, error, run } = useOnlineAction();
  const client = getSupabase();

  const share = () => {
    Share.share({ message: `Viens jouer aux dames chinoises sur Halma ! Code de la room : ${room.code}` }).catch(
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
  const leave = () =>
    run(async () => {
      await leaveRoom(client, room.id);
      router.dismissTo('/online');
    });

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <DrawnButton label="‹ Retour" size="small" onPress={() => router.dismissTo('/online')} />
        </View>

        <View style={styles.titles}>
          <Text style={Typography.title} accessibilityRole="header">
            Salle d’attente
          </Text>
          <Text style={Typography.caption}>
            {isHost ? 'Partage le code, ajoute des IA si besoin, puis lance la partie.' : 'L’hôte lancera la partie.'}
          </Text>
        </View>

        <DrawnCard contentStyle={styles.codeCard}>
          <Text style={Typography.caption}>Code de la room</Text>
          <Text style={styles.code} selectable accessibilityLabel={`Code ${room.code.split('').join(' ')}`}>
            {room.code}
          </Text>
          <DrawnButton label="Partager le code" size="small" onPress={share} color={playerColor(1).piece} />
        </DrawnCard>

        <DrawnCard contentStyle={styles.card}>
          <Text style={Typography.heading}>
            Participants · {count}/{MAX_PARTICIPANTS}
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
              label="+ Ajouter une IA"
              size="small"
              onPress={() => act(() => addAi(client, room.id, 'medium'))}
            />
          )}
          {count === 5 && <Text style={Typography.caption}>À 5, une branche du plateau reste vide.</Text>}
        </DrawnCard>

        {error && <Notice>{error}</Notice>}
      </ScrollView>

      <View style={styles.footer}>
        {isHost ? (
          count >= MIN_PARTICIPANTS ? (
            <DrawnButton
              label={pending ? '…' : `Lancer la partie à ${count}`}
              onPress={start}
              color={playerColor(0).piece}
            />
          ) : (
            <Text style={[Typography.caption, styles.center]}>
              Attends un autre joueur ou ajoute une IA pour lancer la partie.
            </Text>
          )
        ) : (
          <Text style={[Typography.caption, styles.center]} accessibilityLiveRegion="polite">
            En attente du lancement par l’hôte…
          </Text>
        )}
        <DrawnButton label="Quitter la room" size="small" onPress={leave} style={styles.leave} />
      </View>
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
  const details = [
    player.userId === hostId ? 'hôte' : null,
    player.userId !== null && !online ? 'déconnecté' : null,
  ].filter(Boolean);
  const name = participantName(player, userId);
  return (
    <View style={styles.participant}>
      <View style={styles.participantLine}>
        <View style={styles.flex}>
          <PlayerChip
            player={index}
            label={player.aiLevel ? 'IA' : name}
            detail={details.length > 0 ? details.join(' · ') : undefined}
          />
        </View>
        {player.aiLevel && editable && <DrawnButton label="Retirer" size="small" onPress={onRemove} />}
      </View>
      {player.aiLevel &&
        (editable ? (
          <SegmentedPicker
            options={AI_LEVELS}
            labels={AI_LEVEL_LABELS}
            value={player.aiLevel}
            onChange={onLevel}
            color={playerColor(index).piece}
            accessibilityLabel={`Niveau de l’IA ${playerColor(index).name}`}
          />
        ) : (
          <Text style={Typography.caption}>Niveau {AI_LEVEL_LABELS[player.aiLevel].toLowerCase()}</Text>
        ))}
    </View>
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
