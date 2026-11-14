import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { Colors, Shadow, Stroke, TouchTarget } from '@/constants/theme';
import { PROFILE_BUTTON_LABEL, profileHref } from '@/navigation/nav-bar';

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
  const { configured, session, profile } = useAuth();
  const signedIn = Boolean(session);
  return (
    <Pressable
      onPress={() => router.push(profileHref(signedIn))}
      accessibilityRole="button"
      accessibilityLabel={PROFILE_BUTTON_LABEL}
      accessibilityHint={signedIn ? 'Ouvre ton profil' : configured ? 'Ouvre la connexion' : undefined}
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

const styles = StyleSheet.create({
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
