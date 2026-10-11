import { useEffect, useState, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { Colors, Radius, Spacing, Stroke, Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';
import { fetchMyStats, type PlayerStats } from '@/stats/stats-service';
import { displayedStreak, parisDay } from '@/stats/streak';

import { DrawnCard } from './drawn-card';
import { BestFlameIcon, FlameIcon, StartFlagIcon, TrophyIcon } from './stat-icons';
import { ErrorState, LoadingState } from './state-view';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; stats: PlayerStats };

const ICON_SIZE = 34;

/** Une statistique : icône décorative et valeur, puis son libellé (seul le libellé et la valeur sont lus). */
function Tile({ value, label, Icon }: { value: number; label: string; Icon: ComponentType<{ size: number }> }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label} : ${value}`}>
      <View style={styles.valueRow}>
        <Icon size={ICON_SIZE} />
        <Text style={styles.value}>{value}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

/** Statistiques du joueur connecté, sur son profil. */
export function ProfileStats({ userId }: { userId: string }) {
  const { statsVersion } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    fetchMyStats(getSupabase(), userId)
      .then((stats) => {
        if (active) setLoad({ status: 'ready', stats });
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
  const { stats } = load;
  return (
    <DrawnCard contentStyle={styles.card}>
      <Text style={Typography.heading} accessibilityRole="header">
        Statistiques
      </Text>
      <View style={styles.grid}>
        <Tile value={stats.wins} label="Victoires" Icon={TrophyIcon} />
        <Tile value={stats.gamesStarted} label="Parties lancées" Icon={StartFlagIcon} />
        <Tile value={displayedStreak(stats, parisDay(new Date()))} label="Série actuelle (jours)" Icon={FlameIcon} />
        <Tile value={stats.bestStreak} label="Meilleure série (jours)" Icon={BestFlameIcon} />
      </View>
      <Text style={Typography.caption}>Parties en ligne seulement.</Text>
    </DrawnCard>
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
