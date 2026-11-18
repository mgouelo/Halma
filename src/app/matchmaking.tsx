import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { AuthScreen, NotConfiguredCard } from '@/components/auth-screen';
import { Avatar } from '@/components/avatar';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { StarLogo } from '@/components/nav-bar/icons';
import { LoadingState, ThinkingDots } from '@/components/state-view';
import { Colors, Fonts, MaxContentWidth, playerColor, Shadow, Spacing, Stroke, Typography } from '@/constants/theme';
import { useIsClient } from '@/hooks/use-is-client';
import { useT } from '@/i18n';
import { goBack } from '@/navigation/back';
import { countdownSeconds, formatElapsed, searchElapsedMs, shouldAskToKeepWaiting } from '@/rooms/matchmaking';
import { participantAvatar } from '@/rooms/names';
import { describeOnlineError } from '@/rooms/room-service';
import { useMatchmaking } from '@/rooms/use-matchmaking';

/** « Trouver une partie » : file d'attente, puis compte à rebours avant le départ. */
export default function MatchmakingScreen() {
  const t = useT();
  const isClient = useIsClient();
  const { configured, loading, session } = useAuth();
  if (!isClient) return <SafeAreaView style={styles.screen} />;
  if (!configured) {
    return (
      <AuthScreen header="back" title={t('online.findGame')} subtitle={t('matchmaking.unavailable')}>
        <NotConfiguredCard />
      </AuthScreen>
    );
  }
  if (loading) return <LoadingState />;
  if (!session) {
    return (
      <AuthScreen header="back" title={t('online.findGame')} subtitle={t('matchmaking.signIn')}>
        <DrawnButton label={t('common.signIn')} onPress={() => router.push('/sign-in')} color={playerColor(1).piece} />
      </AuthScreen>
    );
  }
  return <Search key={session.user.id} userId={session.user.id} />;
}

function openRoom(roomId: string) {
  router.replace({ pathname: '/room/[id]', params: { id: roomId } });
}

function Search({ userId }: { userId: string }) {
  const t = useT();
  const { state, players, now, cancel, cancelling } = useMatchmaking(userId, openRoom);
  const [keptWaitingAt, setKeptWaitingAt] = useState<number | null>(null);

  const leave = async () => {
    await cancel();
    goBack('/online');
  };

  let body;
  if (state.kind === 'joining') {
    body = <LoadingState label={t('matchmaking.joining')} />;
  } else if (state.kind === 'error') {
    body = (
      <DrawnCard contentStyle={styles.card}>
        <Text style={Typography.heading} accessibilityRole="header">
          {t('matchmaking.impossible')}
        </Text>
        <Text style={Typography.body}>{describeOnlineError(t, state.error)}</Text>
        <DrawnButton
          label={state.alreadyInRoom ? t('matchmaking.seeRoom') : t('matchmaking.back')}
          onPress={() => router.replace('/online')}
          color={playerColor(1).piece}
        />
      </DrawnCard>
    );
  } else if (state.status.phase === 'matched') {
    const seconds = countdownSeconds(state.status, now);
    body = (
      <Animated.View entering={FadeIn.duration(200)} style={styles.stack}>
        <DrawnCard contentStyle={[styles.card, styles.center]}>
          <Text style={[Typography.title, styles.text]} accessibilityRole="header">
            {t('matchmaking.found')}
          </Text>
          <Countdown seconds={seconds} />
          <Text style={[Typography.body, styles.text]} accessibilityLiveRegion="polite">
            {seconds > 0 ? t('matchmaking.startsIn', { n: seconds }) : t('matchmaking.starting')}
          </Text>
          <Text style={[Typography.caption, styles.text]}>{t('matchmaking.moreMayJoin')}</Text>
        </DrawnCard>
        <DrawnCard contentStyle={styles.card}>
          <Text style={Typography.heading}>
            {t('matchmaking.players', { count: Math.max(players.length, state.status.players) })}
          </Text>
          {players.map((player, index) => (
            <View key={player.id} style={styles.player}>
              <Avatar
                value={participantAvatar(player)}
                seed={player.userId ?? player.id}
                size={40}
                background={playerColor(index).piece}
              />
              <Text style={[Typography.heading, styles.flex]} numberOfLines={1}>
                {player.pseudo ?? t('common.player')}
                {player.userId === userId ? t('common.youSuffix') : ''}
              </Text>
            </View>
          ))}
        </DrawnCard>
        <DrawnButton
          label={cancelling ? t('common.cancelling') : t('common.cancel')}
          busy={cancelling}
          onPress={leave}
          accessibilityHint={t('matchmaking.leaveHint')}
        />
      </Animated.View>
    );
  } else {
    const elapsed = searchElapsedMs(state.status, now);
    body = (
      <View style={styles.stack}>
        <DrawnCard contentStyle={[styles.card, styles.center]}>
          <StarLogo size={96} />
          <Text style={[Typography.title, styles.text]} accessibilityRole="header">
            {t('matchmaking.searching')}
          </Text>
          <View
            style={styles.row}
            accessibilityLabel={t('matchmaking.searchingFor', { time: formatElapsed(elapsed) })}
            accessible>
            <ThinkingDots />
            <Text style={Typography.caption}>{t('matchmaking.searchingFor', { time: formatElapsed(elapsed) })}</Text>
          </View>
          <Text style={[Typography.caption, styles.text]}>{t('matchmaking.howItWorks')}</Text>
        </DrawnCard>
        <DrawnButton
          label={cancelling ? t('common.cancelling') : t('common.cancel')}
          busy={cancelling}
          onPress={leave}
        />
        <ConfirmDialog
          visible={shouldAskToKeepWaiting(state.status, now, keptWaitingAt)}
          title={t('matchmaking.nobodyTitle')}
          message={t('matchmaking.nobodyMessage')}
          cancelLabel={t('matchmaking.keepWaiting')}
          confirmLabel={t('online.cancelSearch')}
          onCancel={() => setKeptWaitingAt(Date.now())}
          onConfirm={leave}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titles}>
          <Text style={Typography.title} accessibilityRole="header">
            {t('online.findGame')}
          </Text>
          <Text style={Typography.caption}>{t('matchmaking.subtitle')}</Text>
        </View>
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const RING = 120;

/** Compte à rebours : le nombre de secondes dans un grand pion pastel au trait noir. */
function Countdown({ seconds }: { seconds: number }) {
  const t = useT();
  return (
    <View style={styles.ringWrap} accessible accessibilityLabel={t('matchmaking.countdown', { count: seconds })}>
      <View style={styles.ringShadow} />
      <Animated.View key={seconds} entering={ZoomIn.duration(180)} style={styles.ring}>
        <Text style={styles.ringText}>{seconds}</Text>
      </Animated.View>
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
  titles: {
    gap: Spacing.one,
  },
  stack: {
    gap: Spacing.four,
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  center: {
    alignItems: 'center',
  },
  text: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  ringWrap: {
    width: RING + Shadow.offset,
    height: RING + Shadow.offset,
  },
  ringShadow: {
    position: 'absolute',
    top: Shadow.offset,
    left: Shadow.offset,
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: Colors.ink,
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: Stroke.bold,
    borderColor: Colors.ink,
    backgroundColor: playerColor(3).piece,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    fontFamily: Fonts.bold,
    fontSize: 56,
    color: Colors.ink,
  },
});
