import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { NotConfiguredCard } from '@/components/auth-screen';
import { Avatar } from '@/components/avatar';
import { DrawnCard } from '@/components/drawn-card';
import { PodiumBadge } from '@/components/leaderboard/podium-badge';
import { MountainIcon } from '@/components/nav-bar/icons';
import { useScreenEdges } from '@/components/nav-bar/screen-edges';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-view';
import {
  Colors,
  MaxContentWidth,
  playerColor,
  Radius,
  Shadow,
  Spacing,
  Stroke,
  TouchTarget,
  Typography,
} from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';
import {
  BOARD_INFO,
  BOARDS,
  entryLabel,
  formatRank,
  formatUnit,
  groupLeaderboards,
  podiumPlace,
  type Board,
  type BoardView,
  type LeaderboardEntry,
} from '@/stats/leaderboard';
import { fetchLeaderboards } from '@/stats/stats-service';

/** Pourquoi les parties hors ligne ne comptent pas (aussi dans le README). */
const ONLINE_ONLY =
  'Seules les parties en ligne comptent : validées par le serveur, elles ne peuvent pas être truquées, contrairement aux parties hors ligne jouées sur l’appareil.';

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; views: Record<Board, BoardView> };

/** Six classements, choisis par onglets ; lus en un seul appel au serveur. */
export default function LeaderboardScreen() {
  const edges = useScreenEdges();
  const { configured, loading, session } = useAuth();
  const [board, setBoard] = useState<Board>('wins');

  let body;
  if (!configured) {
    body = <NotConfiguredCard />;
  } else if (loading) {
    body = <LoadingState label="Chargement…" />;
  } else if (!session) {
    body = (
      <EmptyState
        icon={<MountainIcon size={64} />}
        title="Connecte-toi pour voir les classements"
        message="Un compte invité suffit. Tes victoires en ligne te feront grimper."
        action={{ label: 'Se connecter', onPress: () => router.push('/sign-in') }}
      />
    );
  } else {
    body = <Boards key={session.user.id} board={board} onBoard={setBoard} />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titles}>
          <Text style={Typography.title} accessibilityRole="header">
            Classements
          </Text>
          <Text style={Typography.caption}>{ONLINE_ONLY}</Text>
        </View>
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

function Boards({ board, onBoard }: { board: Board; onBoard: (board: Board) => void }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const request = useRef(0);

  const reload = useCallback((quiet: boolean) => {
    const id = ++request.current;
    if (!quiet) setLoad({ status: 'loading' });
    fetchLeaderboards(getSupabase())
      .then((rows) => {
        if (id === request.current) setLoad({ status: 'ready', views: groupLeaderboards(rows) });
      })
      .catch(() => {
        // Relecture discrète ratée : on garde ce qui est affiché.
        if (id === request.current) setLoad((prev) => (quiet && prev.status === 'ready' ? prev : { status: 'error' }));
      });
  }, []);

  // À chaque retour sur l'écran : relecture, sans effacer les classements déjà affichés.
  useFocusEffect(
    useCallback(() => {
      reload(true);
    }, [reload]),
  );

  return (
    <>
      <BoardTabs value={board} onChange={onBoard} />
      <View style={styles.boardTitles}>
        <Text style={Typography.heading} accessibilityRole="header">
          {BOARD_INFO[board].title}
        </Text>
        <Text style={Typography.caption}>{BOARD_INFO[board].description}</Text>
      </View>
      {load.status === 'loading' && <LoadingState label="Chargement des classements…" />}
      {load.status === 'error' && (
        <ErrorState
          title="Classements indisponibles"
          message="Impossible de lire les classements. Vérifie ta connexion."
          onRetry={() => reload(false)}
        />
      )}
      {load.status === 'ready' && <BoardList board={board} view={load.views[board]} />}
    </>
  );
}

function BoardTabs({ value, onChange }: { value: Board; onChange: (board: Board) => void }) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {BOARDS.map((board) => {
        const selected = board === value;
        return (
          <Pressable
            key={board}
            onPress={() => onChange(board)}
            accessibilityRole="tab"
            accessibilityLabel={BOARD_INFO[board].title}
            accessibilityState={{ selected }}
            style={styles.tabWrapper}>
            {/* Onglet choisi : relevé par une ombre franche, trait épais et texte gras. */}
            {selected && <View style={styles.tabShadow} />}
            <View style={[styles.tab, selected && styles.tabSelected]}>
              <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{BOARD_INFO[board].tab}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function BoardList({ board, view }: { board: Board; view: BoardView }) {
  // Personne n'a de score : le serveur ne renvoie que la ligne du joueur, sans rang.
  if (view.top.length === 0 && view.me?.rank == null) {
    return (
      <EmptyState
        icon={<MountainIcon size={64} />}
        title="Personne n’est encore classé"
        message="Le sommet est libre : gagne une partie en ligne pour y planter ton pion."
      />
    );
  }
  return (
    <View style={styles.list}>
      {view.top.length > 0 && (
        <DrawnCard contentStyle={styles.rows}>
          {view.top.map((entry, index) => (
            <Row key={`${entry.rank}-${entry.pseudo}`} board={board} entry={entry} first={index === 0} />
          ))}
        </DrawnCard>
      )}
      {view.me && (
        <View style={styles.meBlock}>
          <Text style={[Typography.caption, styles.center]} accessibilityElementsHidden importantForAccessibility="no">
            ⋯
          </Text>
          <DrawnCard contentStyle={styles.rows}>
            <Row board={board} entry={view.me} first />
          </DrawnCard>
          {view.me.rank === null && (
            <Text style={[Typography.caption, styles.center]}>Tu n’es pas encore classé ici.</Text>
          )}
        </View>
      )}
    </View>
  );
}

function Row({ board, entry, first }: { board: Board; entry: LeaderboardEntry; first: boolean }) {
  const place = podiumPlace(entry.rank);
  return (
    <View
      style={[styles.row, !first && styles.rowSeparator, entry.isMe && styles.rowMe]}
      accessible
      accessibilityLabel={entryLabel(board, entry)}>
      <View style={styles.rank}>
        {place ? <PodiumBadge place={place} /> : <Text style={styles.rankText}>{formatRank(entry.rank)}</Text>}
      </View>
      <Avatar value={entry.avatar} seed={entry.pseudo} size={40} />
      <View style={styles.who}>
        <Text style={[Typography.heading, styles.pseudo]} numberOfLines={1}>
          {entry.pseudo}
        </Text>
        {entry.isMe && <Text style={styles.meTag}>C’est toi</Text>}
      </View>
      <View style={styles.scoreBox}>
        <Text style={styles.score}>{entry.score}</Text>
        <Text style={styles.unit}>{formatUnit(board, entry.score)}</Text>
      </View>
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
  boardTitles: {
    gap: Spacing.one,
  },
  // Deux rangées de trois onglets de même largeur.
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.two,
    columnGap: Spacing.one,
  },
  tabWrapper: {
    flexBasis: '31%',
    flexGrow: 1,
    paddingRight: Shadow.offset,
    paddingBottom: Shadow.offset,
  },
  tabShadow: {
    ...StyleSheet.absoluteFill,
    top: Shadow.offset,
    left: Shadow.offset,
    borderRadius: Radius.round,
    backgroundColor: Colors.ink,
  },
  tab: {
    minHeight: TouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.round,
    borderWidth: Stroke.thin,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  tabSelected: {
    borderWidth: Stroke.bold,
    backgroundColor: playerColor(3).piece,
  },
  tabLabel: {
    ...Typography.caption,
    color: Colors.ink,
    fontSize: 14,
  },
  tabLabelSelected: {
    fontWeight: '900',
  },
  list: {
    gap: Spacing.two,
  },
  rows: {
    paddingVertical: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowSeparator: {
    borderTopWidth: Stroke.thin,
    borderTopColor: Colors.line,
  },
  // Sa propre ligne : fond teinté et trait épais à gauche (pas seulement une couleur).
  rowMe: {
    backgroundColor: playerColor(0).tint,
    borderLeftWidth: Stroke.bold * 2,
    borderLeftColor: Colors.ink,
  },
  rank: {
    width: 44,
    alignItems: 'center',
  },
  rankText: {
    ...Typography.heading,
    fontSize: 16,
  },
  who: {
    flex: 1,
    minWidth: 0,
  },
  pseudo: {
    fontSize: 16,
  },
  meTag: {
    ...Typography.caption,
    color: Colors.ink,
    fontWeight: '800',
  },
  scoreBox: {
    alignItems: 'flex-end',
  },
  score: {
    ...Typography.heading,
  },
  unit: {
    ...Typography.caption,
    fontSize: 12,
  },
  meBlock: {
    gap: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
});
