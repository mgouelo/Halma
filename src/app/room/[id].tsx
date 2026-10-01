import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { AuthScreen, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { Lobby } from '@/components/online/lobby';
import { OnlineGameView } from '@/components/online/online-game-view';
import { ErrorState, LoadingState } from '@/components/state-view';
import { Colors } from '@/constants/theme';
import { setFlashNotice } from '@/lib/flash-notice';
import { roomClosedNotice } from '@/rooms/room-service';
import { useIsClient } from '@/hooks/use-is-client';
import { useNow, useRoom } from '@/rooms/use-room';

/** Room en ligne : salle d'attente, puis partie une fois lancée par l'hôte. */
export default function RoomScreen() {
  // L'identifiant vient de l'URL, inconnue lors de l'export statique web.
  const isClient = useIsClient();
  return isClient ? <RoomGate /> : <SafeAreaView style={styles.screen} />;
}

function RoomGate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { configured, loading, session } = useAuth();

  if (!configured) {
    return (
      <AuthScreen title="Jouer en ligne" subtitle="Room indisponible.">
        <NotConfiguredCard />
      </AuthScreen>
    );
  }
  if (loading) return <Message text="Chargement…" />;
  if (!session) {
    return (
      <AuthScreen title="Jouer en ligne" subtitle="Connecte-toi pour rejoindre la room.">
        <DrawnButton label="Se connecter" onPress={() => router.push('/sign-in')} />
      </AuthScreen>
    );
  }
  return <RoomView key={id} roomId={id} userId={session.user.id} />;
}

function RoomView({ roomId, userId }: { roomId: string; userId: string }) {
  const { snapshot, status, error, refresh, applyGame } = useRoom(roomId);
  const now = useNow();
  const leaving = useRef(false);

  // La room qu'on regardait disparaît (l'hôte l'a fermée) : retour à l'accueil avec un message.
  const closed = status === 'missing' && snapshot !== null;
  useEffect(() => {
    if (!closed || !snapshot || leaving.current) return;
    setFlashNotice(roomClosedNotice(snapshot, userId));
    router.dismissTo('/');
  }, [closed, snapshot, userId]);

  if (status === 'loading') return <Message text="Connexion à la room…" />;
  if (closed) return <Message text="Retour à l’accueil…" />;
  if (status === 'missing') {
    return (
      <AuthScreen title="Room introuvable" subtitle="Elle a été fermée, ou tu n’en fais plus partie.">
        <DrawnButton label="Jouer en ligne" onPress={() => router.dismissTo('/online')} />
      </AuthScreen>
    );
  }
  if (!snapshot) {
    return (
      <AuthScreen title="Room" subtitle="La room n’a pas pu être chargée.">
        <ErrorState message={error ?? 'Une erreur est survenue.'} onRetry={refresh} />
      </AuthScreen>
    );
  }
  const { game } = snapshot;
  if (game) return <OnlineGameView snapshot={{ ...snapshot, game }} userId={userId} now={now} onGame={applyGame} />;
  return <Lobby snapshot={snapshot} userId={userId} now={now} onGame={applyGame} refresh={refresh} leavingRef={leaving} />;
}

function Message({ text }: { text: string }) {
  return (
    <SafeAreaView style={styles.screen}>
      <LoadingState label={text} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
});
