import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { authStyles, Notice } from '@/components/auth-screen';
import { Avatar } from '@/components/avatar';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { FriendsIcon } from '@/components/nav-bar/icons';
import { StatsCard, StatTile } from '@/components/profile-stats';
import { BestFlameIcon, PodiumIcon, PointsIcon, TrophyIcon } from '@/components/stat-icons';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-view';
import { playerColor, Spacing, Typography } from '@/constants/theme';
import {
  describeFriendError,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from '@/friends/friends-service';
import { msg, useT, type Msg } from '@/i18n';
import { getSupabase } from '@/lib/supabase';
import type { PlayerRelation, PublicProfile } from '@/players/public-profile';
import { usePublicProfile } from '@/players/use-public-profile';
import { formatRank, formatValue, rankSpoken } from '@/stats/leaderboard';

type Reload = (options: { fallback: PlayerRelation }) => Promise<void>;

/**
 * Profil public d'un autre joueur : avatar, pseudo, un bouton d'amitié selon la
 * relation, puis points, rang, victoires et plus longue série. Rien de privé :
 * ni déconnexion, ni suppression de compte, ni changement de pseudo ou
 * d'avatar, ni parties lancées.
 */
export function PublicProfileView({ userId }: { userId: string }) {
  const t = useT();
  const { load, reload } = usePublicProfile(userId);

  if (load.status === 'loading') return <LoadingState label={t('profile.loading')} />;
  if (load.status === 'not_found') {
    return (
      <EmptyState
        icon={<FriendsIcon size={72} />}
        title={t('profile.notFoundTitle')}
        message={t('profile.notFoundText')}
      />
    );
  }
  if (load.status === 'error') {
    return (
      <ErrorState
        title={t('profile.unavailable')}
        message={describeFriendError(t, load.error)}
        onRetry={() => void reload()}
      />
    );
  }
  const { profile } = load;
  return (
    <>
      <DrawnCard contentStyle={[authStyles.card, styles.card]}>
        <Avatar value={profile.avatar} seed={userId} size={144} accessibilityLabel={t('profile.avatarOf', { name: profile.pseudo })} />
        <Text style={[Typography.title, authStyles.center]}>{profile.pseudo}</Text>
        <FriendshipAction profile={profile} reload={reload} />
      </DrawnCard>
      <PublicStats profile={profile} />
    </>
  );
}

function PublicStats({ profile }: { profile: PublicProfile }) {
  const t = useT();
  return (
    <StatsCard
      notes={
        <>
          {profile.rank === null && <Text style={Typography.caption}>{t('stats.publicUnranked')}</Text>}
          <Text style={Typography.caption}>{t('common.onlineOnly')}</Text>
        </>
      }>
      <StatTile value={formatValue(t, profile.points)} label={t('stats.points')} Icon={PointsIcon} />
      <StatTile
        value={formatRank(t, profile.rank)}
        spoken={rankSpoken(t, profile.rank)}
        label={t('stats.rank')}
        Icon={PodiumIcon}
      />
      <StatTile value={formatValue(t, profile.wins)} label={t('stats.wins')} Icon={TrophyIcon} />
      <StatTile value={formatValue(t, profile.bestStreak)} label={t('stats.bestStreak')} Icon={BestFlameIcon} />
    </StatsCard>
  );
}

/** Retour d'une action : un message à traduire, ou l'erreur brute (traduite à l'affichage). */
type Result = { tone: 'info'; text: Msg } | { tone: 'error'; error: unknown };

/**
 * Un seul bouton d'amitié, selon la relation : envoyer une demande, demande
 * envoyée (désactivé), accepter ou refuser une demande reçue, retirer un ami
 * (avec confirmation). Après chaque action, le profil est relu.
 */
function FriendshipAction({ profile, reload }: { profile: PublicProfile; reload: Reload }) {
  const t = useT();
  const [pending, setPending] = useState<'send' | 'accept' | 'refuse' | 'remove' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const { relation, pseudo } = profile;

  const run = async (
    kind: NonNullable<typeof pending>,
    action: () => Promise<{ text: Msg; fallback: PlayerRelation }>,
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
      setResult({ tone: 'error', error });
    }
    // L'état a pu changer de l'autre côté (demande déjà acceptée, ami déjà retiré) : on relit.
    await reload({ fallback });
    setPending(null);
  };

  const send = () =>
    run('send', async () => {
      const outcome = await sendFriendRequest(getSupabase(), pseudo);
      return outcome === 'accepted'
        ? { text: msg('friends.alreadyAsked', { name: pseudo }), fallback: { kind: 'none' } }
        : { text: msg('friends.requestSentTo', { name: pseudo }), fallback: { kind: 'request_sent' } };
    });

  const respond = (requestId: string, accept: boolean) =>
    run(accept ? 'accept' : 'refuse', async () => {
      await respondFriendRequest(getSupabase(), requestId, accept);
      return {
        text: accept ? msg('friends.nowFriends', { name: pseudo }) : msg('friends.refused'),
        fallback: { kind: 'none' },
      };
    });

  const remove = (friendshipId: string) => {
    setConfirmRemove(false);
    void run('remove', async () => {
      await removeFriend(getSupabase(), friendshipId);
      return { text: msg('friends.removed', { name: pseudo }), fallback: { kind: 'none' } };
    });
  };

  let body;
  switch (relation.kind) {
    case 'none':
      body = (
        <DrawnButton
          label={pending === 'send' ? t('common.sending') : t('friends.sendFriendRequest')}
          busy={pending === 'send'}
          onPress={send}
          color={playerColor(1).piece}
        />
      );
      break;
    case 'request_sent':
      body = (
        <>
          <DrawnButton label={t('friends.requestSent')} disabled onPress={() => {}} />
          <Text style={[Typography.caption, authStyles.center]}>{t('friends.awaitingAnswer')}</Text>
        </>
      );
      break;
    case 'request_received':
      body = (
        <>
          <Text style={[Typography.body, authStyles.center]}>{t('friends.sentYouRequest', { name: pseudo })}</Text>
          <View style={styles.actions}>
            <DrawnButton
              label={t('common.accept')}
              color={playerColor(2).piece}
              busy={pending === 'accept'}
              disabled={pending !== null && pending !== 'accept'}
              onPress={() => respond(relation.requestId, true)}
              accessibilityHint={t('friends.becomeFriendHint', { name: pseudo })}
              style={styles.flex}
            />
            <DrawnButton
              label={t('common.refuse')}
              busy={pending === 'refuse'}
              disabled={pending !== null && pending !== 'refuse'}
              onPress={() => respond(relation.requestId, false)}
              accessibilityHint={t('friends.refuseHint', { name: pseudo })}
              style={styles.flex}
            />
          </View>
        </>
      );
      break;
    case 'friends':
      body = (
        <>
          <Text style={[Typography.body, authStyles.center]}>{t('friends.areFriends')}</Text>
          <DrawnButton
            label={pending === 'remove' ? t('friends.removing') : t('friends.removeFromFriends')}
            busy={pending === 'remove'}
            onPress={() => setConfirmRemove(true)}
          />
          <ConfirmDialog
            visible={confirmRemove}
            title={t('friends.removeTitle', { name: pseudo })}
            message={t('friends.removeMessage')}
            cancelLabel={t('common.keep')}
            confirmLabel={t('common.remove')}
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
      {result && (
        <Notice tone={result.tone}>
          {result.tone === 'info' ? t.msg(result.text) : describeFriendError(t, result.error)}
        </Notice>
      )}
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
