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
import { goBack } from '@/navigation/back';
import { countdownSeconds, formatElapsed, searchElapsedMs, shouldAskToKeepWaiting } from '@/rooms/matchmaking';
import { participantAvatar } from '@/rooms/names';
import { useMatchmaking } from '@/rooms/use-matchmaking';

/** « Trouver une partie » : file d'attente, puis compte à rebours avant le départ. */
export default function MatchmakingScreen() {
  const isClient = useIsClient();
  const { configured, loading, session } = useAuth();
  if (!isClient) return <SafeAreaView style={styles.screen} />;
  if (!configured) {
    return (
      <AuthScreen header="back" title="Trouver une partie" subtitle="Jeu en ligne indisponible.">
        <NotConfiguredCard />
      </AuthScreen>
    );
  }
  if (loading) return <LoadingState />;
  if (!session) {
    return (
      <AuthScreen header="back" title="Trouver une partie" subtitle="Connecte-toi pour jouer en ligne.">
        <DrawnButton label="Se connecter" onPress={() => router.push('/sign-in')} color={playerColor(1).piece} />
      </AuthScreen>
    );
  }
  return <Search key={session.user.id} userId={session.user.id} />;
}

function openRoom(roomId: string) {
  router.replace({ pathname: '/room/[id]', params: { id: roomId } });
}

function Search({ userId }: { userId: string }) {
  const { state, players, now, cancel, cancelling } = useMatchmaking(userId, openRoom);
  const [keptWaitingAt, setKeptWaitingAt] = useState<number | null>(null);

  const leave = async () => {
    await cancel();
    goBack('/online');
  };

  let body;
  if (state.kind === 'joining') {
    body = <LoadingState label="Entrée dans la file…" />;
  } else if (state.kind === 'error') {
    body = (
      <DrawnCard contentStyle={styles.card}>
        <Text style={Typography.heading} accessibilityRole="header">
          Recherche impossible
        </Text>
        <Text style={Typography.body}>{state.message}</Text>
        <DrawnButton
          label={state.alreadyInRoom ? 'Voir ma room' : 'Retour'}
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
            Adversaire trouvé !
          </Text>
          <Countdown seconds={seconds} />
          <Text style={[Typography.body, styles.text]} accessibilityLiveRegion="polite">
            {seconds > 0 ? `La partie commence dans ${seconds} s.` : 'Lancement de la partie…'}
          </Text>
          <Text style={[Typography.caption, styles.text]}>
            D’autres joueurs en recherche peuvent encore arriver, jusqu’à 6.
          </Text>
        </DrawnCard>
        <DrawnCard contentStyle={styles.card}>
          <Text style={Typography.heading}>Joueurs · {Math.max(players.length, state.status.players)}/6</Text>
          {players.map((player, index) => (
            <View key={player.id} style={styles.player}>
              <Avatar
                value={participantAvatar(player)}
                seed={player.userId ?? player.id}
                size={40}
                background={playerColor(index).piece}
              />
              <Text style={[Typography.heading, styles.flex]} numberOfLines={1}>
                {player.pseudo ?? 'Joueur'}
                {player.userId === userId ? ' (toi)' : ''}
              </Text>
            </View>
          ))}
        </DrawnCard>
        <DrawnButton
          label={cancelling ? 'Annulation…' : 'Annuler'}
          busy={cancelling}
          onPress={leave}
          accessibilityHint="Quitte la partie avant son départ"
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
            Recherche d’un adversaire…
          </Text>
          <View style={styles.row} accessibilityLabel={`Recherche depuis ${formatElapsed(elapsed)}`} accessible>
            <ThinkingDots />
            <Text style={Typography.caption}>Recherche depuis {formatElapsed(elapsed)}</Text>
          </View>
          <Text style={[Typography.caption, styles.text]}>
            Dès qu’un autre joueur cherche aussi, vous êtes réunis. Pas d’IA : que des humains, de 2 à 6.
          </Text>
        </DrawnCard>
        <DrawnButton label={cancelling ? 'Annulation…' : 'Annuler'} busy={cancelling} onPress={leave} />
        <ConfirmDialog
          visible={shouldAskToKeepWaiting(state.status, now, keptWaitingAt)}
          title="Toujours personne…"
          message="Aucun autre joueur ne cherche de partie pour l’instant. Tu peux continuer d’attendre ou revenir plus tard."
          cancelLabel="Continuer d’attendre"
          confirmLabel="Annuler la recherche"
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
            Trouver une partie
          </Text>
          <Text style={Typography.caption}>Partie en ligne entre joueurs, comptée pour les points.</Text>
        </View>
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const RING = 120;

/** Compte à rebours : le nombre de secondes dans un grand pion pastel au trait noir. */
function Countdown({ seconds }: { seconds: number }) {
  return (
    <View style={styles.ringWrap} accessible accessibilityLabel={`${seconds} secondes avant le départ`}>
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
