import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { Colors, Radius, Spacing, Stroke, Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';
import { fetchMyStats, type PlayerStats } from '@/stats/stats-service';
import { displayedStreak, parisDay } from '@/stats/streak';

import { DrawnCard } from './drawn-card';
import { ErrorState, LoadingState } from './state-view';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; stats: PlayerStats };

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text style={styles.value}>{value}</Text>
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
        <Tile value={stats.wins} label="Victoires" />
        <Tile value={stats.gamesStarted} label="Parties lancées" />
        <Tile value={displayedStreak(stats, parisDay(new Date()))} label="Série actuelle (jours)" />
        <Tile value={stats.bestStreak} label="Meilleure série (jours)" />
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
  value: {
    ...Typography.title,
  },
  label: {
    ...Typography.caption,
  },
});
