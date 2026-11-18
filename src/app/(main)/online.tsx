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
import { msg, useT, type Msg } from '@/i18n';
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
import { fetchMatchmakingStatus, leaveMatchmaking, type MatchmakingStatus } from '@/rooms/matchmaking';
import { useOnlineAction } from '@/rooms/use-online-action';
import { ErrorState, LoadingState } from '@/components/state-view';

function openRoom(id: string) {
  router.push({ pathname: '/room/[id]', params: { id } });
}

export default function OnlineScreen() {
  const t = useT();
  const { configured, loading, session } = useAuth();

  return (
    <AuthScreen title={t('common.playOnline')} subtitle={t('online.subtitle')}>
      {!configured ? (
        <NotConfiguredCard />
      ) : loading ? (
        <LoadingState />
      ) : !session ? (
        <DrawnCard contentStyle={authStyles.card}>
          <Text style={Typography.heading}>{t('online.signInFirst')}</Text>
          <Text style={Typography.body}>{t('online.signInText')}</Text>
          <DrawnButton label={t('common.signIn')} onPress={() => router.push('/sign-in')} color={playerColor(1).piece} />
        </DrawnCard>
      ) : (
        <OnlineMenu userId={session.user.id} />
      )}
    </AuthScreen>
  );
}

function OnlineMenu({ userId }: { userId: string }) {
  const t = useT();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<Msg | null>(null);
  // undefined : pas encore lu ; null : aucune room active.
  const [active, setActive] = useState<ActiveRoom | null | undefined>(undefined);
  // Erreur brute de lecture (traduite à l'affichage), enveloppée : null veut dire « pas d'erreur ».
  const [activeError, setActiveError] = useState<{ error: unknown } | null>(null);
  // Recherche en cours (file ou compte à rebours) : on la reprend ou on l'annule.
  const [search, setSearch] = useState<MatchmakingStatus | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const create = useOnlineAction();
  const join = useOnlineAction();
  const leave = useOnlineAction();
  const cancelSearch = useOnlineAction();

  // Room active, relue à chaque retour sur l'écran (et sur « Réessayer »).
  const loadActive = useCallback(() => {
    let current = true;
    Promise.all([fetchActiveRoom(getSupabase()), fetchMatchmakingStatus(getSupabase())])
      .then(([room, status]) => {
        if (!current) return;
        setSearch(status.phase === 'searching' || status.phase === 'matched' ? status : null);
        setActive(room);
        setActiveError(null);
      })
      .catch((e: unknown) => {
        if (current) setActiveError({ error: e });
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
      setCodeError(msg('online.codeFormat', { n: ROOM_CODE_LENGTH }));
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
    return (
      <ErrorState
        title={t('online.roomUnavailable')}
        message={describeOnlineError(t, activeError.error)}
        onRetry={loadActive}
      />
    );
  }
  if (active === undefined) return <LoadingState />;

  // Recherche en cours (en file, ou compte à rebours avant le départ).
  if (search) {
    return (
      <DrawnCard contentStyle={authStyles.card}>
        <Text style={Typography.heading}>{t('online.searching')}</Text>
        <Text style={Typography.caption}>
          {search.phase === 'matched' ? t('online.matchedWaiting') : t('online.searchingText')}
        </Text>
        {cancelSearch.error && <Notice>{cancelSearch.error}</Notice>}
        <DrawnButton label={t('online.resume')} color={playerColor(2).piece} onPress={() => router.push('/matchmaking')} />
        <DrawnButton
          label={cancelSearch.pending ? t('common.cancelling') : t('online.cancelSearch')}
          size="small"
          busy={cancelSearch.pending}
          onPress={async () => {
            if (await cancelSearch.run(() => leaveMatchmaking(getSupabase()))) {
              setSearch(null);
              loadActive();
            }
          }}
        />
      </DrawnCard>
    );
  }

  // Une seule room à la fois : on la reprend ou on la quitte avant d'en créer ou rejoindre une autre.
  if (active) {
    const playing = active.status === 'playing';
    const isHost = active.hostId === userId;
    return (
      <DrawnCard contentStyle={authStyles.card}>
        <Text style={Typography.heading}>{t('online.yourRoom')}</Text>
        <View style={styles.roomRow}>
          <View style={styles.flex}>
            <Text style={[Typography.heading, styles.code]}>{active.code}</Text>
            <Text style={Typography.caption}>{playing ? t('online.gameInProgress') : t('online.waitingRoom')}</Text>
          </View>
          <DrawnButton
            label={playing ? t('online.resume') : t('online.open')}
            size="small"
            color={playerColor(2).piece}
            onPress={() => openRoom(active.id)}
          />
        </View>
        <Text style={Typography.caption}>
          {playing ? t('online.oneRoomPlaying') : t('online.oneRoomWaiting')}
        </Text>
        {leave.error && <Notice>{leave.error}</Notice>}
        {!playing && (
          <DrawnButton
            label={leave.pending ? t('online.leaving') : t('online.leaveRoom')}
            size="small"
            busy={leave.pending}
            onPress={isHost ? () => setConfirmLeave(true) : () => leaveActive(active)}
            accessibilityHint={isHost ? t('online.hostDeletesHint') : undefined}
          />
        )}
        <ConfirmDialog
          visible={confirmLeave}
          title={t('online.closeRoomTitle')}
          message={t('online.closeRoomMessage')}
          cancelLabel={t('online.keepRoom')}
          confirmLabel={t('online.closeRoom')}
          onCancel={() => setConfirmLeave(false)}
          onConfirm={() => leaveActive(active)}
        />
      </DrawnCard>
    );
  }

  return (
    <>
      <DrawnCard contentStyle={authStyles.card}>
        <Text style={Typography.heading}>{t('online.findGame')}</Text>
        <Text style={Typography.caption}>{t('online.findGameText')}</Text>
        <DrawnButton label={t('online.findGame')} onPress={() => router.push('/matchmaking')} color={playerColor(3).piece} />
      </DrawnCard>

      <DrawnCard contentStyle={authStyles.card}>
        <Text style={Typography.heading}>{t('online.createRoom')}</Text>
        <Text style={Typography.caption}>{t('online.createRoomText')}</Text>
        {create.error && <Notice>{create.error}</Notice>}
        <DrawnButton
          label={create.pending ? t('online.creating') : t('online.createRoom')}
          busy={create.pending}
          onPress={createAndOpen}
          color={playerColor(0).piece}
        />
      </DrawnCard>

      <DrawnCard contentStyle={authStyles.card}>
        <DrawnTextInput
          label={t('online.joinWithCode')}
          value={code}
          onChangeText={(value) => {
            setCode(value.toUpperCase());
            setCodeError(null);
          }}
          error={codeError ? t.msg(codeError) : null}
          placeholder="K7QM3X"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={ROOM_CODE_LENGTH + 2}
          onSubmitEditing={joinAndOpen}
          style={styles.code}
        />
        {join.error && <Notice>{join.error}</Notice>}
        <DrawnButton
          label={join.pending ? t('online.joining') : t('online.join')}
          onPress={joinAndOpen}
          busy={join.pending}
        />
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
