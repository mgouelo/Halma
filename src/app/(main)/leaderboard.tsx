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
import { useNavBarInset, useScreenEdges } from '@/components/nav-bar/screen-edges';
import { ProfileButton } from '@/components/profile-button';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-view';
import {
  Colors,
  Fonts,
  MaxContentWidth,
  playerColor,
  Radius,
  Shadow,
  Spacing,
  Stroke,
  TouchTarget,
  Typography,
} from '@/constants/theme';
import { useT } from '@/i18n';
import { getSupabase } from '@/lib/supabase';
import {
  boardInfo,
  BOARDS,
  DEFAULT_BOARD,
  describeLeaderboardError,
  entryLabel,
  formatRank,
  formatUnit,
  formatValue,
  groupLeaderboards,
  leaderboardAccess,
  myPositionLabel,
  podiumPlace,
  type Board,
  type BoardView,
  type LeaderboardEntry,
} from '@/stats/leaderboard';
import { playerHref, playerProfileLabel } from '@/navigation/player';
import { fetchLeaderboards } from '@/stats/stats-service';

type Load =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; views: Record<Board, BoardView> };

/**
 * Trois classements (points, victoires, série), choisis par onglets ; lus en un seul appel au serveur.
 * Réservés aux comptes e-mail : un invité (ou un joueur non connecté) voit une
 * invitation à se connecter, et aucune requête de classement n'est envoyée.
 */
export default function LeaderboardScreen() {
  const t = useT();
  const edges = useScreenEdges();
  const navInset = useNavBarInset();
  const { configured, loading, session, isGuest } = useAuth();
  const [board, setBoard] = useState<Board>(DEFAULT_BOARD);
  const access = leaderboardAccess(session && { isGuest });

  let body;
  if (!configured) {
    body = <NotConfiguredCard />;
  } else if (loading) {
    body = <LoadingState label={t('common.loading')} />;
  } else if (access === 'guest') {
    body = (
      <EmptyState
        icon={<MountainIcon size={64} />}
        title={t('leaderboard.joinTitle')}
        message={`${t('error.leaderboard.guest_not_ranked')} ${t('leaderboard.guestExtra')}`}
        action={{ label: t('common.createMyAccount'), onPress: () => router.push('/upgrade'), color: playerColor(1).piece }}
        secondaryAction={{ label: t('common.haveAccount'), onPress: () => router.push('/sign-in') }}
      />
    );
  } else if (access === 'signed_out' || !session) {
    body = (
      <EmptyState
        icon={<MountainIcon size={64} />}
        title={t('leaderboard.joinTitle')}
        message={t('error.leaderboard.guest_not_ranked')}
        action={{ label: t('common.signIn'), onPress: () => router.push('/sign-in'), color: playerColor(1).piece }}
        secondaryAction={{ label: t('common.createAccount'), onPress: () => router.push('/sign-up') }}
      />
    );
  } else {
    body = <Boards key={session.user.id} myId={session.user.id} board={board} onBoard={setBoard} />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Spacing.four + navInset }]}>
        <View style={styles.titleRow}>
          <View style={styles.titles}>
            <Text style={Typography.title} accessibilityRole="header">
              {t('leaderboard.title')}
            </Text>
            <Text style={styles.tagline}>{t('leaderboard.tagline')}</Text>
          </View>
          <ProfileButton />
        </View>
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

function Boards({ myId, board, onBoard }: { myId: string; board: Board; onBoard: (board: Board) => void }) {
  const t = useT();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const request = useRef(0);

  const reload = useCallback((quiet: boolean) => {
    const id = ++request.current;
    if (!quiet) setLoad({ status: 'loading' });
    fetchLeaderboards(getSupabase())
      .then((rows) => {
        if (id === request.current) setLoad({ status: 'ready', views: groupLeaderboards(rows) });
      })
      .catch((error: unknown) => {
        // Relecture discrète ratée : on garde ce qui est affiché.
        if (id === request.current) {
          setLoad((prev) =>
            quiet && prev.status === 'ready' ? prev : { status: 'error', error },
          );
        }
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
          {boardInfo(t, board).title}
        </Text>
        <Text style={Typography.caption}>{boardInfo(t, board).description}</Text>
      </View>
      {load.status === 'loading' && <LoadingState label={t('leaderboard.loading')} />}
      {load.status === 'error' && (
        <ErrorState
          title={t('leaderboard.unavailable')}
          message={describeLeaderboardError(t, load.error)}
          onRetry={() => reload(false)}
        />
      )}
      {load.status === 'ready' && <BoardList board={board} view={load.views[board]} myId={myId} />}
    </>
  );
}

function BoardTabs({ value, onChange }: { value: Board; onChange: (board: Board) => void }) {
  const t = useT();
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {BOARDS.map((board) => {
        const selected = board === value;
        return (
          <Pressable
            key={board}
            onPress={() => onChange(board)}
            accessibilityRole="tab"
            accessibilityLabel={boardInfo(t, board).title}
            accessibilityState={{ selected }}
            style={styles.tabWrapper}>
            {/* Onglet choisi : relevé par une ombre franche, trait épais et texte gras. */}
            {selected && <View style={styles.tabShadow} />}
            <View style={[styles.tab, selected && styles.tabSelected]}>
              <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]} numberOfLines={1} adjustsFontSizeToFit>
                {boardInfo(t, board).tab}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function BoardList({ board, view, myId }: { board: Board; view: BoardView; myId: string }) {
  const t = useT();
  // Personne n'a de score : le serveur ne renvoie que la ligne du joueur, sans rang.
  if (view.top.length === 0 && view.me?.rank == null) {
    return (
      <EmptyState
        icon={<MountainIcon size={64} />}
        title={t('leaderboard.emptyTitle')}
        message={t('leaderboard.emptyText')}
      />
    );
  }
  return (
    <View style={styles.list}>
      {view.top.length > 0 && (
        <DrawnCard contentStyle={styles.rows}>
          {view.top.map((entry, index) => (
            <Row key={`${entry.rank}-${entry.pseudo}`} board={board} entry={entry} first={index === 0} myId={myId} />
          ))}
        </DrawnCard>
      )}
      {view.me && (
        <View style={styles.meBlock}>
          <Text style={[Typography.caption, styles.center]} accessibilityElementsHidden importantForAccessibility="no">
            ⋯
          </Text>
          {view.me.rank !== null && (
            <Text style={[Typography.heading, styles.center]} accessibilityRole="header">
              {myPositionLabel(t, view.me.rank)}
            </Text>
          )}
          <DrawnCard contentStyle={styles.rows}>
            <Row board={board} entry={view.me} first myId={myId} />
          </DrawnCard>
          {view.me.rank === null && (
            <Text style={[Typography.caption, styles.center]}>{t('leaderboard.notRankedHere')}</Text>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Une ligne du classement : position (numéro sur chaque ligne, médaille du podium
 * en plus pour les trois premiers), avatar, pseudo, score. Toucher la ligne
 * ouvre le profil du joueur (le sien pour la ligne « C'est toi »).
 */
function Row({ board, entry, first, myId }: { board: Board; entry: LeaderboardEntry; first: boolean; myId: string }) {
  const t = useT();
  const href = playerHref(entry.userId, myId);
  const rowStyle = [styles.row, !first && styles.rowSeparator, entry.isMe && styles.rowMe];
  const content = <RowContent board={board} entry={entry} />;
  // Serveur pas encore à jour (pas d'identifiant) : ligne simple, non cliquable.
  if (!href) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={entryLabel(t, board, entry)}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={playerProfileLabel(t, entry.pseudo)}
      accessibilityValue={{ text: entryLabel(t, board, entry) }}
      style={({ pressed }) => [rowStyle, pressed && styles.rowPressed]}>
      {content}
    </Pressable>
  );
}

function RowContent({ board, entry }: { board: Board; entry: LeaderboardEntry }) {
  const t = useT();
  const place = podiumPlace(entry.rank);
  return (
    <>
      <View style={styles.rank} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {place && <PodiumBadge place={place} size={34} />}
        <Text style={[styles.rankText, place !== null && styles.rankTextPodium]}>{formatRank(t, entry.rank)}</Text>
      </View>
      <Avatar value={entry.avatar} seed={entry.pseudo} size={40} />
      <View style={styles.who}>
        <Text style={[Typography.heading, styles.pseudo]} numberOfLines={1}>
          {entry.pseudo}
        </Text>
        {entry.isMe && <Text style={styles.meTag}>{t('leaderboard.itsYou')}</Text>}
      </View>
      <View style={styles.scoreBox}>
        <Text style={styles.score}>{formatValue(t, entry.score)}</Text>
        <Text style={styles.unit}>{formatUnit(t, board, entry.score)}</Text>
      </View>
    </>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  titles: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  // Phrase d'accroche : texte courant en demi-gras, comme une devise.
  tagline: {
    ...Typography.body,
    fontFamily: Fonts.semibold,
  },
  boardTitles: {
    gap: Spacing.one,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: Spacing.two,
    columnGap: Spacing.one,
  },
  // Même largeur pour les trois onglets, sur une ligne.
  tabWrapper: {
    flex: 1,
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
    fontFamily: Fonts.bold,
  },
  list: {
    gap: Spacing.two,
  },
  // Pas de marge autour des lignes : le fond de la ligne « C'est toi » remplit la carte jusqu'au trait
  // (la carte arrondit les coins et masque ce qui dépasse).
  rows: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    // Zone tactile : toute la ligne, au moins 56 points de haut (plus que les 44 requis).
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowSeparator: {
    borderTopWidth: Stroke.thin,
    borderTopColor: Colors.line,
  },
  // Sa propre ligne : fond teinté, et la mention « C'est toi » (pas seulement une couleur).
  rowMe: {
    backgroundColor: playerColor(0).tint,
  },
  rank: {
    width: 44,
    alignItems: 'center',
  },
  rankText: {
    ...Typography.heading,
    fontSize: 16,
  },
  // Sous la médaille : le numéro, en gras, plus petit pour tenir dans la ligne.
  rankTextPodium: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 15,
  },
  // Ligne touchée : fond pastel pâle, comme un bouton qui s'enfonce.
  rowPressed: {
    backgroundColor: playerColor(3).tint,
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
    fontFamily: Fonts.semibold,
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
