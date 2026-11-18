import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, MaxContentWidth, Radius, Spacing, Stroke, Typography } from '@/constants/theme';
import { useT } from '@/i18n';

import { BackButton } from './back-button';
import { DrawnButton } from './drawn-button';
import { DrawnCard } from './drawn-card';
import { PageHead } from './page-head';
import { useNavBarInset, useScreenEdges } from './nav-bar/screen-edges';

interface AuthScreenProps {
  title: string;
  subtitle: string;
  /**
   * Bouton en haut à gauche : « ‹ Accueil » (par défaut), « ‹ Retour » vers
   * l'écran précédent (écrans sans barre de navigation), ou aucun (profil :
   * l'accueil est dans la barre).
   */
  header?: 'home' | 'back' | 'none';
  children: ReactNode;
}

/** Cadre commun des écrans de compte (connexion, inscription, profil, jouer en ligne…). */
export function AuthScreen({ title, subtitle, header = 'home', children }: AuthScreenProps) {
  const t = useT();
  const edges = useScreenEdges();
  const navInset = useNavBarInset();
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <PageHead title={title} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Spacing.four + navInset }]}
          keyboardShouldPersistTaps="handled">
          {header === 'back' && <BackButton />}
          {header === 'home' && (
            <View style={styles.header}>
              <DrawnButton label={t('common.home')} size="small" onPress={() => router.dismissTo('/')} />
            </View>
          )}
          <View style={styles.titles}>
            <Text style={Typography.title} accessibilityRole="header">
              {title}
            </Text>
            <Text style={Typography.caption}>{subtitle}</Text>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Bandeau d'erreur ou d'information au trait. */
export function Notice({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' }) {
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={[styles.notice, tone === 'error' && styles.noticeError]}
      accessibilityLiveRegion="polite">
      <Text style={Typography.body}>{children}</Text>
    </Animated.View>
  );
}

/** Carte affichée quand Supabase n'est pas configuré. */
export function NotConfiguredCard() {
  const t = useT();
  return (
    <DrawnCard contentStyle={styles.card}>
      <Text style={Typography.heading}>{t('notConfigured.title')}</Text>
      <Text style={Typography.body}>{t('notConfigured.text')}</Text>
      <Text style={Typography.caption}>{t('notConfigured.dev')}</Text>
    </DrawnCard>
  );
}

export const authStyles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  links: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  center: {
    textAlign: 'center',
  },
  inlineLink: {
    fontFamily: Fonts.semibold,
    textDecorationLine: 'underline',
  },
  link: {
    ...Typography.body,
    fontFamily: Fonts.semibold,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
  flex: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
  },
  titles: {
    gap: Spacing.one,
  },
  card: authStyles.card,
  notice: {
    padding: Spacing.three,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    borderRadius: Radius.small,
  },
  noticeError: {
    borderStyle: 'dashed',
  },
});
