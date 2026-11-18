import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { normalizePseudoInput } from '@/auth/validation';
import { Notice, NotConfiguredCard } from '@/components/auth-screen';
import { Avatar } from '@/components/avatar';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { DrawnTextInput } from '@/components/drawn-text-input';
import { MailboxButton, MailboxIcon } from '@/components/friends/mailbox-button';
import { FriendsIcon } from '@/components/nav-bar/icons';
import { useNavBarInset, useScreenEdges } from '@/components/nav-bar/screen-edges';
import { ProfileButton } from '@/components/profile-button';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-view';
import {
  Colors,
  Fonts,
  MaxContentWidth,
  playerColor,
  Radius,
  Spacing,
  Stroke,
  TouchTarget,
  Typography,
} from '@/constants/theme';
import {
  describeFriendError,
  formatRequestAge,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  validateFriendPseudo,
  type Friend,
  type FriendRequest,
} from '@/friends/friends-service';
import { useFriends } from '@/friends/use-friends';
import { msg, useT, type Msg } from '@/i18n';
import { getSupabase } from '@/lib/supabase';
import { playerHref, playerProfileLabel } from '@/navigation/player';
import { formatRank, formatScore, formatUnit, formatValue } from '@/stats/leaderboard';

/**
 * Amis : liste triée par points (avec le rang de chacun parmi tous les joueurs
 * classés), ajout par pseudo, demandes reçues dans la « boîte aux lettres ».
 * Réservé aux comptes e-mail : un invité est invité à créer son compte, et
 * aucune requête d'amis n'est envoyée.
 */
export default function FriendsScreen() {
  const t = useT();
  const edges = useScreenEdges();
  const navInset = useNavBarInset();
  const { configured, loading, session, isGuest } = useAuth();
  const userId = session && !isGuest ? session.user.id : null;

  let body;
  if (!configured) {
    body = <NotConfiguredCard />;
  } else if (loading) {
    body = <LoadingState label={t('common.loading')} />;
  } else if (isGuest) {
    body = (
      <EmptyState
        icon={<FriendsIcon size={88} />}
        title={t('friends.guestTitle')}
        message={t('friends.guestText')}
        action={{ label: t('common.createMyAccount'), onPress: () => router.push('/upgrade'), color: playerColor(1).piece }}
      />
    );
  } else if (!userId) {
    body = (
      <EmptyState
        icon={<FriendsIcon size={88} />}
        title={t('friends.signedOutTitle')}
        message={t('friends.signedOutText')}
        action={{ label: t('common.signIn'), onPress: () => router.push('/sign-in'), color: playerColor(1).piece }}
        secondaryAction={{ label: t('common.createAccount'), onPress: () => router.push('/sign-up') }}
      />
    );
  } else {
    body = <FriendsPanel key={userId} userId={userId} />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Spacing.four + navInset }]} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <View style={styles.titles}>
            <Text style={Typography.title} accessibilityRole="header">
              {t('friends.title')}
            </Text>
            <Text style={styles.tagline}>{t('friends.tagline')}</Text>
          </View>
          <ProfileButton />
        </View>
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Partie de la ligne qui ouvre le profil du joueur (avatar, pseudo, détails) ;
 * les boutons de la ligne (croix, Accepter, Refuser) sont à côté, pas dedans,
 * et gardent leur action. Sans identifiant (serveur pas encore à jour), la
 * ligne n'est pas cliquable.
 */
function ProfileTouch({
  userId,
  myId,
  pseudo,
  details,
  children,
}: {
  userId: string | null;
  myId: string;
  pseudo: string;
  /** Lu après le libellé « Profil de … » (points, rang, date). */
  details: string;
  children: ReactNode;
}) {
  const t = useT();
  const href = playerHref(userId, myId);
  if (!href) {
    return (
      <View style={styles.rowMain} accessible accessibilityLabel={`${pseudo}, ${details}`}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={playerProfileLabel(t, pseudo)}
      accessibilityValue={{ text: details }}
      style={({ pressed }) => [styles.rowMain, styles.rowTouch, pressed && styles.rowPressed]}>
      {children}
    </Pressable>
  );
}

function FriendsPanel({ userId }: { userId: string }) {
  const t = useT();
  const { load, reload } = useFriends(userId);
  const [view, setView] = useState<'friends' | 'requests'>('friends');
  const [removing, setRemoving] = useState<Friend | null>(null);
  const [removeError, setRemoveError] = useState<{ error: unknown } | null>(null);

  if (load.status === 'loading') return <LoadingState label={t('friends.loading')} />;
  if (load.status === 'error') {
    return (
      <ErrorState
        title={t('friends.unavailable')}
        message={describeFriendError(t, load.error)}
        onRetry={() => reload(false)}
      />
    );
  }
  const { friends, requests } = load;

  const confirmRemove = async () => {
    if (!removing) return;
    const friend = removing;
    setRemoving(null);
    try {
      await removeFriend(getSupabase(), friend.friendshipId);
      setRemoveError(null);
    } catch (error) {
      setRemoveError({ error });
    }
    reload(true);
  };

  if (view === 'requests') {
    return (
      <>
        <View style={styles.toolbar}>
          <DrawnButton label={t('friends.myFriendsBack')} size="small" onPress={() => setView('friends')} />
          <Text style={[Typography.heading, styles.flex]} accessibilityRole="header">
            {t('friends.requests')}
          </Text>
        </View>
        <RequestList requests={requests} myId={userId} onChange={() => reload(true)} />
      </>
    );
  }

  return (
    <>
      <AddFriend onSent={() => reload(true)} />
      <View style={styles.toolbar}>
        <Text style={[Typography.heading, styles.flex]} accessibilityRole="header">
          {friends.length > 0 ? t('friends.myFriendsCount', { count: friends.length }) : t('friends.myFriends')}
        </Text>
        <MailboxButton count={requests.length} onPress={() => setView('requests')} />
      </View>
      {removeError && <Notice>{describeFriendError(t, removeError.error)}</Notice>}
      {friends.length === 0 ? (
        <EmptyState
          icon={<FriendsIcon size={72} />}
          title={t('friends.noneTitle')}
          message={t('friends.noneText')}
        />
      ) : (
        <DrawnCard contentStyle={styles.rows}>
          {friends.map((friend, index) => (
            <FriendRow
              key={friend.friendshipId}
              friend={friend}
              myId={userId}
              first={index === 0}
              onRemove={() => setRemoving(friend)}
            />
          ))}
        </DrawnCard>
      )}
      <ConfirmDialog
        visible={removing !== null}
        title={t('friends.removeTitle', { name: removing?.pseudo ?? '' })}
        message={t('friends.removeMessage')}
        cancelLabel={t('common.keep')}
        confirmLabel={t('common.remove')}
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </>
  );
}

/** Champ « Ajouter un ami » : un pseudo, jamais de liste de joueurs. */
function AddFriend({ onSent }: { onSent: () => void }) {
  const t = useT();
  const [pseudo, setPseudo] = useState('');
  const [fieldError, setFieldError] = useState<Msg | null>(null);
  // Réussite : un message à traduire ; échec : l'erreur brute, traduite à l'affichage.
  const [result, setResult] = useState<{ tone: 'info'; text: Msg } | { tone: 'error'; error: unknown } | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (pending) return;
    const invalid = validateFriendPseudo(pseudo);
    setFieldError(invalid);
    if (invalid) return;
    setPending(true);
    setResult(null);
    try {
      const outcome = await sendFriendRequest(getSupabase(), pseudo);
      const name = pseudo.trim();
      setResult({
        tone: 'info',
        text:
          outcome === 'accepted' ? msg('friends.alreadyAsked', { name }) : msg('friends.requestSentTo', { name }),
      });
      setPseudo('');
      onSent();
    } catch (error) {
      setResult({ tone: 'error', error });
    } finally {
      setPending(false);
    }
  };

  return (
    <DrawnCard contentStyle={styles.card}>
      <DrawnTextInput
        label={t('friends.add')}
        value={pseudo}
        onChangeText={(value) => {
          setPseudo(normalizePseudoInput(value));
          setFieldError(null);
          setResult(null);
        }}
        error={fieldError ? t.msg(fieldError) : null}
        hint={t('friends.addHint')}
        placeholder={t('common.pseudo')}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={30}
        onSubmitEditing={submit}
      />
      {result && (
        <Notice tone={result.tone}>
          {result.tone === 'info' ? t.msg(result.text) : describeFriendError(t, result.error)}
        </Notice>
      )}
      <DrawnButton
        label={pending ? t('common.sending') : t('friends.sendRequest')}
        busy={pending}
        size="small"
        onPress={submit}
        color={playerColor(1).piece}
      />
    </DrawnCard>
  );
}

function FriendRow({
  friend,
  myId,
  first,
  onRemove,
}: {
  friend: Friend;
  myId: string;
  first: boolean;
  onRemove: () => void;
}) {
  const t = useT();
  const rank = formatRank(t, friend.rank);
  const spokenRank = friend.rank === null ? t('friends.noRank') : t('friends.rankSpoken', { rank });
  return (
    <View style={[styles.row, !first && styles.rowSeparator]}>
      <ProfileTouch
        userId={friend.userId}
        myId={myId}
        pseudo={friend.pseudo}
        details={`${formatScore(t, 'points', friend.points)}, ${spokenRank}`}>
        <Avatar value={friend.avatar} seed={friend.avatar} size={44} />
        <View style={styles.flex}>
          <Text style={[Typography.heading, styles.pseudo]} numberOfLines={1}>
            {friend.pseudo}
          </Text>
          <Text style={Typography.caption}>{t('friends.rank', { rank })}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.score}>{formatValue(t, friend.points)}</Text>
          <Text style={styles.unit}>{formatUnit(t, 'points', friend.points)}</Text>
        </View>
      </ProfileTouch>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={t('friends.removeLabel', { name: friend.pseudo })}
        hitSlop={Spacing.one}
        style={styles.remove}>
        <Text style={styles.removeText} accessibilityElementsHidden importantForAccessibility="no">
          ×
        </Text>
      </Pressable>
    </View>
  );
}

function RequestList({
  requests,
  myId,
  onChange,
}: {
  requests: FriendRequest[];
  myId: string;
  onChange: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ error: unknown } | null>(null);

  const respond = async (request: FriendRequest, accept: boolean) => {
    setBusy(request.id);
    setError(null);
    try {
      await respondFriendRequest(getSupabase(), request.id, accept);
    } catch (e) {
      setError({ error: e });
    } finally {
      setBusy(null);
      onChange();
    }
  };

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<MailboxIcon size={72} />}
        title={t('friends.noRequestsTitle')}
        message={t('friends.noRequestsText')}
      />
    );
  }
  return (
    <>
      {error && <Notice>{describeFriendError(t, error.error)}</Notice>}
      <DrawnCard contentStyle={styles.rows}>
        {requests.map((request, index) => (
          <View key={request.id} style={[styles.request, index > 0 && styles.rowSeparator]}>
            <ProfileTouch
              userId={request.userId}
              myId={myId}
              pseudo={request.pseudo}
              details={t('friends.requestSpoken', { age: formatRequestAge(t, request.createdAt) })}>
              <Avatar value={request.avatar} seed={request.avatar} size={44} />
              <View style={styles.flex}>
                <Text style={[Typography.heading, styles.pseudo]} numberOfLines={1}>
                  {request.pseudo}
                </Text>
                <Text style={Typography.caption}>{formatRequestAge(t, request.createdAt)}</Text>
              </View>
            </ProfileTouch>
            <View style={styles.requestActions}>
              <DrawnButton
                label={t('common.accept')}
                size="small"
                color={playerColor(2).piece}
                busy={busy === request.id}
                disabled={busy !== null && busy !== request.id}
                onPress={() => respond(request, true)}
                accessibilityHint={t('friends.becomeFriendHint', { name: request.pseudo })}
                style={styles.flex}
              />
              <DrawnButton
                label={t('common.refuse')}
                size="small"
                disabled={busy !== null}
                onPress={() => respond(request, false)}
                accessibilityHint={t('friends.refuseHint', { name: request.pseudo })}
                style={styles.flex}
              />
            </View>
          </View>
        ))}
      </DrawnCard>
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
  tagline: {
    ...Typography.body,
    fontFamily: Fonts.semibold,
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  rows: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 64,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    paddingVertical: Spacing.two,
  },
  rowSeparator: {
    borderTopWidth: Stroke.thin,
    borderTopColor: Colors.line,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  // Partie cliquable d'une ligne : au moins 44 points de haut, coins arrondis quand on la touche.
  rowTouch: {
    minHeight: TouchTarget,
    borderRadius: Radius.small,
  },
  rowPressed: {
    backgroundColor: playerColor(3).tint,
  },
  pseudo: {
    fontSize: 16,
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
  remove: {
    width: TouchTarget,
    height: TouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontFamily: Fonts.bold,
    fontSize: 26,
    color: Colors.ink,
  },
  request: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  requestActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
