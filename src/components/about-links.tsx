import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing, TouchTarget, Typography } from '@/constants/theme';

const LINKS: { label: string; href: Href }[] = [
  { label: 'Crédits et licences', href: '/credits' },
  { label: 'Confidentialité', href: '/privacy' },
  { label: 'Conditions d’utilisation', href: '/terms' },
];

/** Liens vers les crédits, la politique de confidentialité et les conditions d'utilisation. */
export function AboutLinks({ exclude }: { exclude?: Href }) {
  return (
    <View style={styles.row} accessibilityRole="list">
      {LINKS.filter((link) => link.href !== exclude).map((link) => (
        <Pressable
          key={link.label}
          onPress={() => router.push(link.href)}
          accessibilityRole="link"
          accessibilityLabel={link.label}
          style={styles.link}>
          <Text style={styles.text}>{link.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: Spacing.three,
  },
  link: {
    minHeight: TouchTarget,
    justifyContent: 'center',
  },
  text: {
    ...Typography.caption,
    fontFamily: Fonts.semibold,
    color: Colors.ink,
    textDecorationLine: 'underline',
  },
});
