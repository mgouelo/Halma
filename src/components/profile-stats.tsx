import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { Colors, Radius, Spacing, Stroke, Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';
import { formatRank, formatValue } from '@/stats/leaderboard';
import { fetchMyRating, fetchMyStats, type MyRating, type PlayerStats } from '@/stats/stats-service';
import { displayedStreak, parisDay } from '@/stats/streak';

import { DrawnCard } from './drawn-card';
import { BestFlameIcon, FlameIcon, PodiumIcon, PointsIcon, StartFlagIcon, TrophyIcon } from './stat-icons';
import { ErrorState, LoadingState } from './state-view';

/** Rang lu par le lecteur d'écran : « 3e place », ou « pas encore classé ». */
export function rankSpoken(rank: number | null): string {
  return rank === null ? 'pas encore classé' : `${formatRank(rank)} place`;
}

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
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label} : ${spoken ?? value}`}>
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
  return (
    <DrawnCard contentStyle={styles.card}>
      <Text style={Typography.heading} accessibilityRole="header">
        Statistiques
      </Text>
      <View style={styles.grid}>{children}</View>
      {notes}
    </DrawnCard>
  );
}

/** Statistiques du joueur connecté, sur son profil. */
export function ProfileStats({ userId }: { userId: string }) {
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
        title="Statistiques indisponibles"
        message="Impossible de lire tes statistiques. Vérifie ta connexion."
        onRetry={() => {
          setLoad({ status: 'loading' });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (load.status === 'loading') return <LoadingState label="Chargement des statistiques…" />;
  const { stats, rating } = load;
  const rankNote = isGuest
    ? 'Les invités n’apparaissent pas dans les classements : crée ton compte pour y entrer avec tes points.'
    : rating.rank === null
      ? 'Joue une partie classée (au moins deux joueurs) pour entrer au classement des points.'
      : null;
  return (
    <StatsCard
      notes={
        <>
          {rankNote && <Text style={Typography.caption}>{rankNote}</Text>}
          <Text style={Typography.caption}>Parties en ligne seulement.</Text>
        </>
      }>
      <StatTile value={formatValue(rating.points)} label="Points" Icon={PointsIcon} />
      <StatTile
        value={formatRank(rating.rank)}
        spoken={rankSpoken(rating.rank)}
        label="Rang aux points"
        Icon={PodiumIcon}
      />
      <StatTile value={stats.wins} label="Victoires" Icon={TrophyIcon} />
      <StatTile value={stats.gamesStarted} label="Parties lancées" Icon={StartFlagIcon} />
      <StatTile value={displayedStreak(stats, parisDay(new Date()))} label="Série actuelle (jours)" Icon={FlameIcon} />
      <StatTile value={stats.bestStreak} label="Meilleure série (jours)" Icon={BestFlameIcon} />
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
