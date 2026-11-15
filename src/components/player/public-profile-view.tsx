import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { authStyles, Notice } from '@/components/auth-screen';
import { Avatar } from '@/components/avatar';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { FriendsIcon } from '@/components/nav-bar/icons';
import { rankSpoken, StatsCard, StatTile } from '@/components/profile-stats';
import { BestFlameIcon, PodiumIcon, PointsIcon, TrophyIcon } from '@/components/stat-icons';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-view';
import { playerColor, Spacing, Typography } from '@/constants/theme';
import {
  describeFriendError,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from '@/friends/friends-service';
import { getSupabase } from '@/lib/supabase';
import type { PlayerRelation, PublicProfile } from '@/players/public-profile';
import { usePublicProfile } from '@/players/use-public-profile';
import { formatRank, formatValue } from '@/stats/leaderboard';

type Reload = (options: { fallback: PlayerRelation }) => Promise<void>;

/**
 * Profil public d'un autre joueur : avatar, pseudo, un bouton d'amitié selon la
 * relation, puis points, rang, victoires et plus longue série. Rien de privé :
 * ni déconnexion, ni suppression de compte, ni changement de pseudo ou
 * d'avatar, ni parties lancées.
 */
export function PublicProfileView({ userId }: { userId: string }) {
  const { load, reload } = usePublicProfile(userId);

  if (load.status === 'loading') return <LoadingState label="Chargement du profil…" />;
  if (load.status === 'not_found') {
    return (
      <EmptyState
        icon={<FriendsIcon size={72} />}
        title="Joueur introuvable"
        message="Ce joueur n’existe pas ou n’a plus de compte."
      />
    );
  }
  if (load.status === 'error') {
    return <ErrorState title="Profil indisponible" message={load.message} onRetry={() => void reload()} />;
  }
  const { profile } = load;
  return (
    <>
      <DrawnCard contentStyle={[authStyles.card, styles.card]}>
        <Avatar value={profile.avatar} seed={userId} size={144} accessibilityLabel={`Avatar de ${profile.pseudo}`} />
        <Text style={[Typography.title, authStyles.center]}>{profile.pseudo}</Text>
        <FriendshipAction profile={profile} reload={reload} />
      </DrawnCard>
      <PublicStats profile={profile} />
    </>
  );
}

function PublicStats({ profile }: { profile: PublicProfile }) {
  return (
    <StatsCard
      notes={
        <>
          {profile.rank === null && (
            <Text style={Typography.caption}>Pas encore classé : aucune partie classée jouée.</Text>
          )}
          <Text style={Typography.caption}>Parties en ligne seulement.</Text>
        </>
      }>
      <StatTile value={formatValue(profile.points)} label="Points" Icon={PointsIcon} />
      <StatTile value={formatRank(profile.rank)} spoken={rankSpoken(profile.rank)} label="Rang aux points" Icon={PodiumIcon} />
      <StatTile value={profile.wins} label="Victoires" Icon={TrophyIcon} />
      <StatTile value={profile.bestStreak} label="Meilleure série (jours)" Icon={BestFlameIcon} />
    </StatsCard>
  );
}

type Result = { tone: 'info' | 'error'; text: string };

/**
 * Un seul bouton d'amitié, selon la relation : envoyer une demande, demande
 * envoyée (désactivé), accepter ou refuser une demande reçue, retirer un ami
 * (avec confirmation). Après chaque action, le profil est relu.
 */
function FriendshipAction({ profile, reload }: { profile: PublicProfile; reload: Reload }) {
  const [pending, setPending] = useState<'send' | 'accept' | 'refuse' | 'remove' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const { relation, pseudo } = profile;

  const run = async (
    kind: NonNullable<typeof pending>,
    action: () => Promise<{ text: string; fallback: PlayerRelation }>,
  ) => {
    if (pending) return;
    setPending(kind);
    setResult(null);
    let fallback: PlayerRelation = relation;
    try {
      const done = await action();
      fallback = done.fallback;
      setResult({ tone: 'info', text: done.text });
    } catch (error) {
      setResult({ tone: 'error', text: describeFriendError(error) });
    }
    // L'état a pu changer de l'autre côté (demande déjà acceptée, ami déjà retiré) : on relit.
    await reload({ fallback });
    setPending(null);
  };

  const send = () =>
    run('send', async () => {
      const outcome = await sendFriendRequest(getSupabase(), pseudo);
      return outcome === 'accepted'
        ? { text: `${pseudo} t’avait déjà demandé en ami : vous êtes maintenant amis !`, fallback: { kind: 'none' } }
        : { text: `Demande envoyée à ${pseudo}.`, fallback: { kind: 'request_sent' } };
    });

  const respond = (requestId: string, accept: boolean) =>
    run(accept ? 'accept' : 'refuse', async () => {
      await respondFriendRequest(getSupabase(), requestId, accept);
      return {
        text: accept ? `Vous êtes maintenant amis, ${pseudo} et toi !` : 'Demande refusée.',
        fallback: { kind: 'none' },
      };
    });

  const remove = (friendshipId: string) => {
    setConfirmRemove(false);
    void run('remove', async () => {
      await removeFriend(getSupabase(), friendshipId);
      return { text: `${pseudo} ne fait plus partie de tes amis.`, fallback: { kind: 'none' } };
    });
  };

  let body;
  switch (relation.kind) {
    case 'none':
      body = (
        <DrawnButton
          label={pending === 'send' ? 'Envoi…' : 'Envoyer une demande d’ami'}
          busy={pending === 'send'}
          onPress={send}
          color={playerColor(1).piece}
        />
      );
      break;
    case 'request_sent':
      body = (
        <>
          <DrawnButton label="Demande envoyée" disabled onPress={() => {}} />
          <Text style={[Typography.caption, authStyles.center]}>En attente de sa réponse.</Text>
        </>
      );
      break;
    case 'request_received':
      body = (
        <>
          <Text style={[Typography.body, authStyles.center]}>{pseudo} t’a envoyé une demande d’ami.</Text>
          <View style={styles.actions}>
            <DrawnButton
              label="Accepter"
              color={playerColor(2).piece}
              busy={pending === 'accept'}
              disabled={pending !== null && pending !== 'accept'}
              onPress={() => respond(relation.requestId, true)}
              accessibilityHint={`Devenir ami avec ${pseudo}`}
              style={styles.flex}
            />
            <DrawnButton
              label="Refuser"
              busy={pending === 'refuse'}
              disabled={pending !== null && pending !== 'refuse'}
              onPress={() => respond(relation.requestId, false)}
              accessibilityHint={`Refuser la demande de ${pseudo}`}
              style={styles.flex}
            />
          </View>
        </>
      );
      break;
    case 'friends':
      body = (
        <>
          <Text style={[Typography.body, authStyles.center]}>Vous êtes amis.</Text>
          <DrawnButton
            label={pending === 'remove' ? 'Retrait…' : 'Retirer des amis'}
            busy={pending === 'remove'}
            onPress={() => setConfirmRemove(true)}
          />
          <ConfirmDialog
            visible={confirmRemove}
            title={`Retirer ${pseudo} de tes amis ?`}
            message="Vous ne serez plus amis. Tu pourras lui renvoyer une demande plus tard."
            cancelLabel="Garder"
            confirmLabel="Retirer"
            onCancel={() => setConfirmRemove(false)}
            onConfirm={() => remove(relation.friendshipId)}
          />
        </>
      );
      break;
    case 'self':
      body = null;
      break;
  }

  return (
    <View style={styles.action}>
      {body}
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
  },
  action: {
    alignSelf: 'stretch',
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
