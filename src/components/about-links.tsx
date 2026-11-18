import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useT } from '@/i18n';

const LINKS = [
  { label: 'about.credits', href: '/credits' },
  { label: 'about.privacy', href: '/privacy' },
  { label: 'about.terms', href: '/terms' },
] as const satisfies readonly { label: string; href: Href }[];

/** Liens vers les crédits, la politique de confidentialité et les conditions d'utilisation. */
export function AboutLinks({ exclude }: { exclude?: Href }) {
  const t = useT();
  return (
    <View style={styles.row} accessibilityRole="list">
      {LINKS.filter((link) => link.href !== exclude).map((link) => (
        <Pressable
          key={link.label}
          onPress={() => router.push(link.href)}
          accessibilityRole="link"
          accessibilityLabel={t(link.label)}
          style={styles.link}>
          <Text style={styles.text}>{t(link.label)}</Text>
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
