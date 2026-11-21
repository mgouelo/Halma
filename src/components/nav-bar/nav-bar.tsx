import { router, usePathname } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Colors,
  Fonts,
  playerColor,
  Radius,
  Shadow,
  Spacing,
  Stroke,
  TouchTarget,
  Typography,
} from '@/constants/theme';
import { useT } from '@/i18n';
import { activeTab, navAction, navHref, navLabel, type NavTab } from '@/navigation/nav-bar';

import { FriendsIcon, MountainIcon, StarLogo } from './icons';

/** Largeur maximale de la barre sur grand écran (elle reste centrée en bas). */
const MAX_BAR_WIDTH = 440;
const SIDE_ICON = 32;
const CENTER_SIZE = 64;

function go(pathname: string, tab: NavTab) {
  const action = navAction(pathname, navHref(tab));
  if (action.type === 'none') return;
  router[action.type](action.href);
}

/** Masque la barre quand le clavier est ouvert sur Android (elle remonterait au-dessus). */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

interface ItemProps {
  tab: NavTab;
  active: boolean;
  onPress: () => void;
  children: ReactNode;
}

function SideItem({ tab, active, onPress, children }: ItemProps) {
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={navLabel(t, tab)}
      accessibilityState={{ selected: active }}
      style={styles.item}>
      {({ pressed }) => (
        <>
          {/* Entrée active : l'icône est entourée d'un trait (pas seulement de couleur). */}
          <View style={[styles.sideIcon, active && styles.sideIconActive, pressed && styles.pressed]}>{children}</View>
          <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
            {navLabel(t, tab)}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function CenterItem({ active, onPress }: Omit<ItemProps, 'tab' | 'children'>) {
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={navLabel(t, 'home')}
      accessibilityState={{ selected: active }}
      style={styles.item}>
      {({ pressed }) => (
        <>
          <View style={styles.centerWrap}>
            <View style={styles.centerShadow} />
            <View style={[styles.centerFace, active && styles.centerFaceActive, pressed && styles.centerPressed]}>
              <StarLogo size={CENTER_SIZE - 14} />
            </View>
          </View>
          <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
            {navLabel(t, 'home')}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * Barre de navigation du bas : amis, accueil (logo, au centre), classements.
 * Affichée par le layout du groupe (main) : absente des écrans qui lancent une
 * partie, des parties, des rooms, du profil et des écrans de connexion, qui
 * sont empilés par-dessus. Le profil s'ouvre par l'avatar en haut à droite
 * (`ProfileButton`).
 */
export function NavBar({ onHeight }: { onHeight?: (height: number) => void }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  // Barre masquée : plus de place à réserver sous les écrans.
  useEffect(() => {
    if (keyboardOpen) onHeight?.(0);
  }, [keyboardOpen, onHeight]);
  if (keyboardOpen) return null;

  const current = activeTab(pathname);
  return (
    <View
      style={[styles.outer, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}
      onLayout={(event) => onHeight?.(event.nativeEvent.layout.height)}>
      <View style={styles.bar} accessibilityRole="tablist">
        <View style={styles.barShadow} />
        <View style={styles.barFace}>
          <SideItem tab="friends" active={current === 'friends'} onPress={() => go(pathname, 'friends')}>
            <FriendsIcon size={SIDE_ICON} />
          </SideItem>
          <CenterItem active={current === 'home'} onPress={() => go(pathname, 'home')} />
          <SideItem tab="leaderboard" active={current === 'leaderboard'} onPress={() => go(pathname, 'leaderboard')}>
            <MountainIcon size={SIDE_ICON} />
          </SideItem>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Par-dessus le contenu, sans fond : les écrans défilent sous la barre. Les touches à côté de la
  // barre passent à travers (`box-none`).
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
  },
  bar: {
    width: '100%',
    maxWidth: MAX_BAR_WIDTH,
    alignSelf: 'center',
    paddingRight: Shadow.offset,
    paddingBottom: Shadow.offset,
  },
  barShadow: {
    ...StyleSheet.absoluteFill,
    top: Shadow.offset,
    left: Shadow.offset,
    borderRadius: Radius.large,
    backgroundColor: Colors.ink,
  },
  barFace: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: Stroke.bold,
    borderColor: Colors.ink,
    borderRadius: Radius.large,
    backgroundColor: Colors.paper,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  item: {
    flex: 1,
    minHeight: TouchTarget,
    minWidth: TouchTarget,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
  sideIcon: {
    width: 56,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.round,
    borderWidth: Stroke.regular,
    borderColor: Colors.paper,
  },
  sideIconActive: {
    borderColor: Colors.ink,
    backgroundColor: playerColor(3).tint,
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
  centerWrap: {
    // Le logo dépasse au-dessus de la barre.
    marginTop: -Spacing.five,
    width: CENTER_SIZE + Shadow.offset,
    height: CENTER_SIZE + Shadow.offset,
  },
  centerShadow: {
    position: 'absolute',
    top: Shadow.offset,
    left: Shadow.offset,
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    backgroundColor: Colors.ink,
  },
  centerFace: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    borderWidth: Stroke.bold,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerFaceActive: {
    backgroundColor: playerColor(3).tint,
  },
  centerPressed: {
    transform: [{ translateX: Shadow.offset / 2 }, { translateY: Shadow.offset / 2 }],
  },
  label: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.ink,
  },
  // Entrée active : texte gras et souligné, lisible sans la couleur.
  labelActive: {
    fontFamily: Fonts.bold,
    textDecorationLine: 'underline',
  },
});
