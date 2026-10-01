import { useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, MaxContentWidth, Radius, Spacing, Stroke, TouchTarget, Typography } from '@/constants/theme';

import { BackButton } from './back-button';
import { DrawnCard } from './drawn-card';
import { useScreenEdges } from './nav-bar/screen-edges';

/** Page de texte (crédits, confidentialité, conditions) : titre, retour, défilement. */
export function DocScreen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const edges = useScreenEdges();
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <View style={styles.titles}>
          <Text style={Typography.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle && <Text style={Typography.caption}>{subtitle}</Text>}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Section de page : carte au trait avec un intertitre. */
export function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <DrawnCard contentStyle={styles.section}>
      <Text style={Typography.heading} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </DrawnCard>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={Typography.body}>{children}</Text>;
}

/** Élément de liste à puce. */
export function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bullet}>
      <Text style={Typography.body} accessibilityElementsHidden importantForAccessibility="no">
        •
      </Text>
      <Text style={[Typography.body, styles.flex]}>{children}</Text>
    </View>
  );
}

/** Lien externe (ouvert dans le navigateur), souligné et assez grand pour le doigt. */
export function ExternalLink({ url, label }: { url: string; label?: string }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      accessibilityRole="link"
      accessibilityLabel={label ?? url}
      accessibilityHint="Ouvre le lien dans le navigateur"
      style={styles.link}>
      <Text style={styles.linkText}>{label ?? url}</Text>
    </Pressable>
  );
}

/**
 * Remet en paragraphes un texte coupé à 80 colonnes (fichiers de licence) : les
 * retours à la ligne simples deviennent des espaces, les lignes vides restent.
 * Le contenu ne change pas, seulement la mise en page à l'écran.
 */
export function reflow(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .join('\n\n');
}

/**
 * Texte long replié par défaut (texte d'une licence) : un bouton l'affiche ou
 * le masque, avec l'état « déplié » annoncé aux lecteurs d'écran.
 */
export function Collapsible({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.collapsible}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Masquer' : 'Afficher'} ${label}`}
        accessibilityState={{ expanded: open }}
        style={[styles.toggle, open && styles.toggleOpen]}>
        <Text style={styles.toggleText}>
          {open ? '▾' : '▸'} {open ? 'Masquer' : 'Afficher'} {label}
        </Text>
      </Pressable>
      {open && (
        <View style={styles.licenseBox}>
          <Text style={styles.licenseText} selectable>
            {reflow(children)}
          </Text>
        </View>
      )}
    </View>
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
  titles: {
    gap: Spacing.one,
  },
  section: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  bullet: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  link: {
    minHeight: TouchTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  linkText: {
    ...Typography.body,
    fontFamily: Fonts.semibold,
    textDecorationLine: 'underline',
  },
  collapsible: {
    gap: Spacing.two,
  },
  toggle: {
    minHeight: TouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    borderRadius: Radius.round,
    alignSelf: 'flex-start',
  },
  toggleOpen: {
    borderWidth: Stroke.bold,
  },
  toggleText: {
    ...Typography.caption,
    fontFamily: Fonts.semibold,
    color: Colors.ink,
  },
  licenseBox: {
    padding: Spacing.three,
    borderWidth: Stroke.thin,
    borderColor: Colors.ink,
    borderStyle: 'dashed',
    borderRadius: Radius.small,
  },
  licenseText: {
    ...Typography.caption,
    color: Colors.ink,
    lineHeight: 19,
  },
});
