import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { AuthScreen, authStyles, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { DrawnTextInput } from '@/components/drawn-text-input';
import { playerColor, Spacing, Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';
import { OnlineError } from '@/online';
import {
  createRoom,
  describeOnlineError,
  fetchActiveRoom,
  isValidRoomCode,
  joinRoom,
  leaveRoom,
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
  // undefined : pas encore lu ; null : aucune room active.
  const [active, setActive] = useState<ActiveRoom | null | undefined>(undefined);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const create = useOnlineAction();
  const join = useOnlineAction();
  const leave = useOnlineAction();

  // Room active, relue à chaque retour sur l'écran (et sur « Réessayer »).
  const loadActive = useCallback(() => {
    let current = true;
    fetchActiveRoom(getSupabase())
      .then((room) => {
        if (!current) return;
        setActive(room);
        setActiveError(null);
      })
      .catch((e: unknown) => {
        if (current) setActiveError(describeOnlineError(e));
      });
    return () => {
      current = false;
    };
  }, []);
  useFocusEffect(loadActive);

  // Refus « déjà dans une room » (autre appareil, course) : on relit la room active pour l'afficher.
  const reload = (e: unknown) => {
    if (e instanceof OnlineError && e.code === 'already_in_room') loadActive();
  };

  const createAndOpen = () =>
    create.run(async () => {
      try {
        openRoom(await createRoom(getSupabase()));
      } catch (e) {
        reload(e);
        throw e;
      }
    });

  const joinAndOpen = () => {
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      setCodeError(`Le code compte ${ROOM_CODE_LENGTH} lettres ou chiffres (par exemple K7QM3X).`);
      return;
    }
    join.run(async () => {
      try {
        openRoom(await joinRoom(getSupabase(), normalized));
        setCode('');
      } catch (e) {
        reload(e);
        throw e;
      }
    });
  };

  const leaveActive = async (room: ActiveRoom) => {
    setConfirmLeave(false);
    const ok = await leave.run(async () => {
      await leaveRoom(getSupabase(), room.id);
    });
    if (ok) setActive(null);
  };

  if (activeError && active === undefined) {
    return <ErrorState title="Room indisponible" message={activeError} onRetry={loadActive} />;
  }
  if (active === undefined) return <LoadingState />;

  // Une seule room à la fois : on la reprend ou on la quitte avant d'en créer ou rejoindre une autre.
  if (active) {
    const playing = active.status === 'playing';
    const isHost = active.hostId === userId;
    return (
      <DrawnCard contentStyle={authStyles.card}>
        <Text style={Typography.heading}>Ta room</Text>
        <View style={styles.roomRow}>
          <View style={styles.flex}>
            <Text style={[Typography.heading, styles.code]}>{active.code}</Text>
            <Text style={Typography.caption}>{playing ? 'Partie en cours' : 'Salle d’attente'}</Text>
          </View>
          <DrawnButton
            label={playing ? 'Reprendre' : 'Ouvrir'}
            size="small"
            color={playerColor(2).piece}
            onPress={() => openRoom(active.id)}
          />
        </View>
        <Text style={Typography.caption}>
          {playing
            ? 'Tu ne peux être que dans une room à la fois. Pour quitter une partie en cours, abandonne-la depuis l’écran de jeu.'
            : 'Tu ne peux être que dans une room à la fois : reprends-la, ou quitte-la pour en créer ou rejoindre une autre.'}
        </Text>
        {leave.error && <Notice>{leave.error}</Notice>}
        {!playing && (
          <DrawnButton
            label={leave.pending ? 'Sortie…' : 'Quitter la room'}
            size="small"
            busy={leave.pending}
            onPress={isHost ? () => setConfirmLeave(true) : () => leaveActive(active)}
            accessibilityHint={isHost ? 'En tant qu’hôte, supprime la room.' : undefined}
          />
        )}
        <ConfirmDialog
          visible={confirmLeave}
          title="Fermer la room ?"
          message="Tu es l’hôte : si tu quittes, la room est supprimée et les autres joueurs sont renvoyés à l’accueil."
          cancelLabel="Garder la room"
          confirmLabel="Fermer la room"
          onCancel={() => setConfirmLeave(false)}
          onConfirm={() => leaveActive(active)}
        />
      </DrawnCard>
    );
  }

  return (
    <>
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
