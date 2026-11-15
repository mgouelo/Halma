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
import { useScreenEdges } from '@/components/nav-bar/screen-edges';
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
import { getSupabase } from '@/lib/supabase';
import { playerHref, playerProfileLabel } from '@/navigation/player';
import { formatRank, formatScore, formatValue } from '@/stats/leaderboard';

/**
 * Amis : liste triée par points (avec le rang de chacun parmi tous les joueurs
 * classés), ajout par pseudo, demandes reçues dans la « boîte aux lettres ».
 * Réservé aux comptes e-mail : un invité est invité à créer son compte, et
 * aucune requête d'amis n'est envoyée.
 */
export default function FriendsScreen() {
  const edges = useScreenEdges();
  const { configured, loading, session, isGuest } = useAuth();
  const userId = session && !isGuest ? session.user.id : null;

  let body;
  if (!configured) {
    body = <NotConfiguredCard />;
  } else if (loading) {
    body = <LoadingState label="Chargement…" />;
  } else if (isGuest) {
    body = (
      <EmptyState
        icon={<FriendsIcon size={88} />}
        title="Tes amis t’attendent"
        message="Les amis sont réservés aux comptes. Crée le tien (tu gardes ta progression d’invité) pour ajouter des amis et comparer vos points."
        action={{ label: 'Créer mon compte', onPress: () => router.push('/upgrade'), color: playerColor(1).piece }}
      />
    );
  } else if (!userId) {
    body = (
      <EmptyState
        icon={<FriendsIcon size={88} />}
        title="Joue avec tes amis"
        message="Connecte-toi pour ajouter des amis et comparer vos points."
        action={{ label: 'Se connecter', onPress: () => router.push('/sign-in'), color: playerColor(1).piece }}
        secondaryAction={{ label: 'Créer un compte', onPress: () => router.push('/sign-up') }}
      />
    );
  } else {
    body = <FriendsPanel key={userId} userId={userId} />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <View style={styles.titles}>
            <Text style={Typography.title} accessibilityRole="header">
              Amis
            </Text>
            <Text style={styles.tagline}>Seul on va vite, entre amis on saute plus loin.</Text>
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
      accessibilityLabel={playerProfileLabel(pseudo)}
      accessibilityValue={{ text: details }}
      style={({ pressed }) => [styles.rowMain, styles.rowTouch, pressed && styles.rowPressed]}>
      {children}
    </Pressable>
  );
}

function FriendsPanel({ userId }: { userId: string }) {
  const { load, reload } = useFriends(userId);
  const [view, setView] = useState<'friends' | 'requests'>('friends');
  const [removing, setRemoving] = useState<Friend | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  if (load.status === 'loading') return <LoadingState label="Chargement de tes amis…" />;
  if (load.status === 'error') {
    return <ErrorState title="Amis indisponibles" message={load.message} onRetry={() => reload(false)} />;
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
      setRemoveError(describeFriendError(error));
    }
    reload(true);
  };

  if (view === 'requests') {
    return (
      <>
        <View style={styles.toolbar}>
          <DrawnButton label="‹ Mes amis" size="small" onPress={() => setView('friends')} />
          <Text style={[Typography.heading, styles.flex]} accessibilityRole="header">
            Demandes reçues
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
          Mes amis{friends.length > 0 ? ` (${friends.length})` : ''}
        </Text>
        <MailboxButton count={requests.length} onPress={() => setView('requests')} />
      </View>
      {removeError && <Notice>{removeError}</Notice>}
      {friends.length === 0 ? (
        <EmptyState
          icon={<FriendsIcon size={72} />}
          title="Pas encore d’amis"
          message="Ajoute un ami avec son pseudo, juste au-dessus. Tes amis apparaîtront ici, triés par points."
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
        title={`Retirer ${removing?.pseudo ?? ''} de tes amis ?`}
        message="Vous ne serez plus amis. Tu pourras lui renvoyer une demande plus tard."
        cancelLabel="Garder"
        confirmLabel="Retirer"
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </>
  );
}

/** Champ « Ajouter un ami » : un pseudo, jamais de liste de joueurs. */
function AddFriend({ onSent }: { onSent: () => void }) {
  const [pseudo, setPseudo] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
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
          outcome === 'accepted'
            ? `${name} t’avait déjà demandé en ami : vous êtes maintenant amis !`
            : `Demande envoyée à ${name}.`,
      });
      setPseudo('');
      onSent();
    } catch (error) {
      setResult({ tone: 'error', text: describeFriendError(error) });
    } finally {
      setPending(false);
    }
  };

  return (
    <DrawnCard contentStyle={styles.card}>
      <DrawnTextInput
        label="Ajouter un ami"
        value={pseudo}
        onChangeText={(value) => {
          setPseudo(normalizePseudoInput(value));
          setFieldError(null);
          setResult(null);
        }}
        error={fieldError}
        hint="Son pseudo exact, accents et majuscules sans importance."
        placeholder="Pseudo"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={30}
        onSubmitEditing={submit}
      />
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      <DrawnButton
        label={pending ? 'Envoi…' : 'Envoyer la demande'}
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
  const rank = friend.rank === null ? '—' : formatRank(friend.rank);
  const spokenRank = friend.rank === null ? 'pas encore de rang' : `${formatRank(friend.rank)} au classement`;
  return (
    <View style={[styles.row, !first && styles.rowSeparator]}>
      <ProfileTouch
        userId={friend.userId}
        myId={myId}
        pseudo={friend.pseudo}
        details={`${formatScore('points', friend.points)}, ${spokenRank}`}>
        <Avatar value={friend.avatar} seed={friend.avatar} size={44} />
        <View style={styles.flex}>
          <Text style={[Typography.heading, styles.pseudo]} numberOfLines={1}>
            {friend.pseudo}
          </Text>
          <Text style={Typography.caption}>Rang {rank}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.score}>{formatValue(friend.points)}</Text>
          <Text style={styles.unit}>{Math.abs(friend.points) > 1 ? 'points' : 'point'}</Text>
        </View>
      </ProfileTouch>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Retirer ${friend.pseudo} de tes amis`}
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
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respond = async (request: FriendRequest, accept: boolean) => {
    setBusy(request.id);
    setError(null);
    try {
      await respondFriendRequest(getSupabase(), request.id, accept);
    } catch (e) {
      setError(describeFriendError(e));
    } finally {
      setBusy(null);
      onChange();
    }
  };

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<MailboxIcon size={72} />}
        title="Aucune demande"
        message="Les demandes d’ami que tu reçois arrivent ici, dès qu’elles sont envoyées."
      />
    );
  }
  return (
    <>
      {error && <Notice>{error}</Notice>}
      <DrawnCard contentStyle={styles.rows}>
        {requests.map((request, index) => (
          <View key={request.id} style={[styles.request, index > 0 && styles.rowSeparator]}>
            <ProfileTouch
              userId={request.userId}
              myId={myId}
              pseudo={request.pseudo}
              details={`demande d’ami ${formatRequestAge(request.createdAt)}`}>
              <Avatar value={request.avatar} seed={request.avatar} size={44} />
              <View style={styles.flex}>
                <Text style={[Typography.heading, styles.pseudo]} numberOfLines={1}>
                  {request.pseudo}
                </Text>
                <Text style={Typography.caption}>{formatRequestAge(request.createdAt)}</Text>
              </View>
            </ProfileTouch>
            <View style={styles.requestActions}>
              <DrawnButton
                label="Accepter"
                size="small"
                color={playerColor(2).piece}
                busy={busy === request.id}
                disabled={busy !== null && busy !== request.id}
                onPress={() => respond(request, true)}
                accessibilityHint={`Devenir ami avec ${request.pseudo}`}
                style={styles.flex}
              />
              <DrawnButton
                label="Refuser"
                size="small"
                disabled={busy !== null}
                onPress={() => respond(request, false)}
                accessibilityHint={`Refuser la demande de ${request.pseudo}`}
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
