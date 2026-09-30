import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { AuthScreen, authStyles, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { DrawnTextInput } from '@/components/drawn-text-input';
import { playerColor, Spacing, Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';
import {
  createRoom,
  describeOnlineError,
  fetchActiveRooms,
  isValidRoomCode,
  joinRoom,
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
  type ActiveRoom,
} from '@/rooms/room-service';
import { useOnlineAction } from '@/rooms/use-online-action';
import { ErrorState, LoadingState } from '@/components/state-view';

function openRoom(id: string) {
  router.push({ pathname: '/room/[id]', params: { id } });
}

export default function OnlineScreen() {
  const { configured, loading, session } = useAuth();

  return (
    <AuthScreen title="Jouer en ligne" subtitle="De 2 à 6 participants, amis et IA, chacun sur son appareil.">
      {!configured ? (
        <NotConfiguredCard />
      ) : loading ? (
        <LoadingState />
      ) : !session ? (
        <DrawnCard contentStyle={authStyles.card}>
          <Text style={Typography.heading}>Connecte-toi d’abord</Text>
          <Text style={Typography.body}>
            Les autres joueurs voient ton pseudo dans la room. Tu peux aussi jouer en invité, sans e-mail.
          </Text>
          <DrawnButton label="Se connecter" onPress={() => router.push('/sign-in')} color={playerColor(1).piece} />
        </DrawnCard>
      ) : (
        <OnlineMenu userId={session.user.id} />
      )}
    </AuthScreen>
  );
}

function OnlineMenu({ userId }: { userId: string }) {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<ActiveRoom[] | null>(null);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const create = useOnlineAction();
  const join = useOnlineAction();

  // Parties en cours, relues à chaque retour sur l'écran (et sur « Réessayer »).
  const loadRooms = useCallback(() => {
    let active = true;
    fetchActiveRooms(getSupabase(), userId)
      .then((list) => {
        if (!active) return;
        setRooms(list);
        setRoomsError(null);
      })
      .catch((e: unknown) => {
        if (active) setRoomsError(describeOnlineError(e));
      });
    return () => {
      active = false;
    };
  }, [userId]);
  useFocusEffect(loadRooms);

  const createAndOpen = () =>
    create.run(async () => {
      openRoom(await createRoom(getSupabase()));
    });

  const joinAndOpen = () => {
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      setCodeError(`Le code compte ${ROOM_CODE_LENGTH} lettres ou chiffres (par exemple K7QM3X).`);
      return;
    }
    join.run(async () => {
      openRoom(await joinRoom(getSupabase(), normalized));
      setCode('');
    });
  };

  return (
    <>
      {roomsError && !rooms && (
        <ErrorState title="Parties en cours indisponibles" message={roomsError} onRetry={loadRooms} />
      )}
      {rooms && rooms.length > 0 && (
        <DrawnCard contentStyle={authStyles.card}>
          <Text style={Typography.heading}>Tes parties en cours</Text>
          {rooms.map((room) => (
            <View key={room.id} style={styles.roomRow}>
              <View style={styles.flex}>
                <Text style={[Typography.heading, styles.code]}>{room.code}</Text>
                <Text style={Typography.caption}>
                  {room.status === 'playing' ? 'Partie en cours' : 'Salle d’attente'}
                </Text>
              </View>
              <DrawnButton
                label={room.status === 'playing' ? 'Reprendre' : 'Ouvrir'}
                size="small"
                color={playerColor(2).piece}
                onPress={() => openRoom(room.id)}
              />
            </View>
          ))}
        </DrawnCard>
      )}

      <DrawnCard contentStyle={authStyles.card}>
        <Text style={Typography.heading}>Créer une room</Text>
        <Text style={Typography.caption}>
          Tu reçois un code court à partager. Tu pourras ajouter des IA avant de lancer la partie.
        </Text>
        {create.error && <Notice>{create.error}</Notice>}
        <DrawnButton
          label={create.pending ? 'Création…' : 'Créer une room'}
          busy={create.pending}
          onPress={createAndOpen}
          color={playerColor(0).piece}
        />
      </DrawnCard>

      <DrawnCard contentStyle={authStyles.card}>
        <DrawnTextInput
          label="Rejoindre avec un code"
          value={code}
          onChangeText={(value) => {
            setCode(value.toUpperCase());
            setCodeError(null);
          }}
          error={codeError}
          placeholder="K7QM3X"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={ROOM_CODE_LENGTH + 2}
          onSubmitEditing={joinAndOpen}
          style={styles.code}
        />
        {join.error && <Notice>{join.error}</Notice>}
        <DrawnButton label={join.pending ? 'Connexion…' : 'Rejoindre'} onPress={joinAndOpen} busy={join.pending} />
      </DrawnCard>
    </>
  );
}

const styles = StyleSheet.create({
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  code: {
    letterSpacing: 3,
  },
});
