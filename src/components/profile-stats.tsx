import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { Colors, Radius, Spacing, Stroke, Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';
import { useT } from '@/i18n';
import { formatRank, formatValue, rankSpoken } from '@/stats/leaderboard';
import { fetchMyRating, fetchMyStats, type MyRating, type PlayerStats } from '@/stats/stats-service';
import { displayedStreak, parisDay } from '@/stats/streak';

import { DrawnCard } from './drawn-card';
import { BestFlameIcon, FlameIcon, PodiumIcon, PointsIcon, StartFlagIcon, TrophyIcon } from './stat-icons';
import { ErrorState, LoadingState } from './state-view';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; stats: PlayerStats; rating: MyRating };

const ICON_SIZE = 34;

/**
 * Une statistique : icône décorative et valeur, puis son libellé (seul le
 * libellé et la valeur sont lus). Partagée par le profil et le profil public
 * d'un autre joueur.
 */
export function StatTile({
  value,
  label,
  Icon,
  spoken,
}: {
  value: number | string;
  label: string;
  Icon: ComponentType<{ size: number }>;
  /** Valeur lue par le lecteur d'écran, si elle diffère de l'affichage. */
  spoken?: string;
}) {
  const t = useT();
  return (
    <View style={styles.tile} accessible accessibilityLabel={t('stats.tileSpoken', { label, value: spoken ?? value })}>
      <View style={styles.valueRow}>
        <Icon size={ICON_SIZE} />
        <Text style={styles.value}>{value}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

/** Carte « Statistiques » : titre, grille de cases, puis des notes éventuelles. */
export function StatsCard({ children, notes }: { children: ReactNode; notes?: ReactNode }) {
  const t = useT();
  return (
    <DrawnCard contentStyle={styles.card}>
      <Text style={Typography.heading} accessibilityRole="header">
        {t('stats.title')}
      </Text>
      <View style={styles.grid}>{children}</View>
      {notes}
    </DrawnCard>
  );
}

/** Statistiques du joueur connecté, sur son profil. */
export function ProfileStats({ userId }: { userId: string }) {
  const t = useT();
  const { statsVersion, isGuest } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([fetchMyStats(getSupabase(), userId), fetchMyRating(getSupabase())])
      .then(([stats, rating]) => {
        if (active) setLoad({ status: 'ready', stats, rating });
      })
      .catch(() => {
        if (active) setLoad({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [userId, statsVersion, attempt]);

  if (load.status === 'error') {
    return (
      <ErrorState
        title={t('stats.unavailable')}
        message={t('stats.readFailed')}
        onRetry={() => {
          setLoad({ status: 'loading' });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (load.status === 'loading') return <LoadingState label={t('stats.loading')} />;
  const { stats, rating } = load;
  const rankNote = isGuest ? t('stats.guestNote') : rating.rank === null ? t('stats.unrankedNote') : null;
  return (
    <StatsCard
      notes={
        <>
          {rankNote && <Text style={Typography.caption}>{rankNote}</Text>}
          <Text style={Typography.caption}>{t('common.onlineOnly')}</Text>
        </>
      }>
      <StatTile value={formatValue(t, rating.points)} label={t('stats.points')} Icon={PointsIcon} />
      <StatTile
        value={formatRank(t, rating.rank)}
        spoken={rankSpoken(t, rating.rank)}
        label={t('stats.rank')}
        Icon={PodiumIcon}
      />
      <StatTile value={formatValue(t, stats.wins)} label={t('stats.wins')} Icon={TrophyIcon} />
      <StatTile value={formatValue(t, stats.gamesStarted)} label={t('stats.gamesStarted')} Icon={StartFlagIcon} />
      <StatTile
        value={formatValue(t, displayedStreak(stats, parisDay(new Date())))}
        label={t('stats.currentStreak')}
        Icon={FlameIcon}
      />
      <StatTile value={formatValue(t, stats.bestStreak)} label={t('stats.bestStreak')} Icon={BestFlameIcon} />
    </StatsCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: Spacing.three,
    gap: Spacing.half,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    borderRadius: Radius.medium,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  value: {
    ...Typography.title,
  },
  label: {
    ...Typography.caption,
  },
});
