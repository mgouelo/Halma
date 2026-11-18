import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { Colors, Shadow, Spacing, Stroke, TouchTarget, Typography } from '@/constants/theme';
import { useT } from '@/i18n';
import { profileHref } from '@/navigation/nav-bar';

import { Avatar } from './avatar';
import { Silhouette } from './nav-bar/icons';

/** Diamètre de l'avatar (la zone tactile, ombre comprise, dépasse 44 points). */
const SIZE = TouchTarget;

/**
 * Avatar du joueur en haut à droite des écrans de la barre (accueil, amis,
 * classements) : il ouvre le profil, par-dessus. Non connecté : une silhouette
 * dessinée qui ouvre la connexion. Absent des parties et des rooms.
 */
export function ProfileButton() {
  const t = useT();
  const { configured, session, profile } = useAuth();
  const signedIn = Boolean(session);
  return (
    <Pressable
      onPress={() => router.push(profileHref(signedIn))}
      accessibilityRole="button"
      accessibilityLabel={t('nav.profile')}
      accessibilityHint={signedIn ? t('nav.openProfile') : configured ? t('nav.openSignIn') : undefined}
      hitSlop={4}
      style={styles.wrapper}>
      {({ pressed }) => (
        <>
          <View style={styles.shadow} />
          <View style={pressed && styles.pressed}>
            {session ? (
              <Avatar value={profile?.avatar} seed={session.user.id} size={SIZE} style={styles.frame} />
            ) : (
              <Silhouette size={SIZE} />
            )}
          </View>
        </>
      )}
    </Pressable>
  );
}

/**
 * Coin en haut à droite de l'accueil : le pseudo du joueur connecté, puis son
 * avatar (le pseudo ouvre aussi le profil). Centré verticalement sur le titre.
 */
export function ProfileCorner() {
  const t = useT();
  const { session, profile } = useAuth();
  return (
    <View style={styles.corner}>
      {session && (
        <Pressable
          onPress={() => router.push(profileHref(true))}
          accessibilityRole="button"
          accessibilityLabel={t('nav.profileOf', { name: profile?.pseudo ?? t('common.player') })}
          style={styles.pseudoTouch}>
          <Text style={Typography.heading} numberOfLines={1}>
            {profile?.pseudo ?? '…'}
          </Text>
        </Pressable>
      )}
      <ProfileButton />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // Le pseudo cède la place au titre s'il est long.
    flexShrink: 1,
    maxWidth: '60%',
  },
  pseudoTouch: {
    flexShrink: 1,
    minHeight: TouchTarget,
    justifyContent: 'center',
  },
  wrapper: {
    width: SIZE + Shadow.offset / 2,
    height: SIZE + Shadow.offset / 2,
    minWidth: TouchTarget,
    minHeight: TouchTarget,
  },
  shadow: {
    position: 'absolute',
    top: Shadow.offset / 2,
    left: Shadow.offset / 2,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: Colors.ink,
  },
  frame: {
    borderWidth: Stroke.bold,
  },
  pressed: {
    transform: [{ translateX: Shadow.offset / 2 }, { translateY: Shadow.offset / 2 }],
  },
});
