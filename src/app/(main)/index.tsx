import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountBar } from '@/components/account-bar';
import { Board } from '@/components/board/board';
import { computeBoardLayout } from '@/components/board/layout';
import { FlashNoticeBanner } from '@/components/flash-notice-banner';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { useNavBarInset, useScreenEdges } from '@/components/nav-bar/screen-edges';
import { ProfileCorner } from '@/components/profile-button';
import { Colors, MaxContentWidth, MaxWideContentWidth, playerColor, Spacing, Typography } from '@/constants/theme';
import { createGame } from '@/game';
import { useMeasuredSize } from '@/hooks/use-measured-size';
import { useWideLayout } from '@/hooks/use-wide-layout';

/** Sous cette hauteur, le plateau décoratif disparaît : il ne serait plus qu'une tache. */
const MIN_PREVIEW_HEIGHT = 140;

export default function HomeScreen() {
  const area = useMeasuredSize();
  const wide = useWideLayout();
  const edges = useScreenEdges();
  const navInset = useNavBarInset();
  // Plateau décoratif à six joueurs : toutes les couleurs pastel des pions.
  const [preview] = useState(() => createGame(6));
  const layout = useMemo(() => computeBoardLayout(area.width, area.height), [area.width, area.height]);

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={styles.titles}>
          <Text style={Typography.display} accessibilityRole="header">
            Halma
          </Text>
          <Text style={Typography.caption}>Dames chinoises</Text>
        </View>
        {/* En haut à droite : pseudo et avatar du joueur (ouvrent le profil). */}
        <ProfileCorner />
      </View>
      <FlashNoticeBanner />
      <AccountBar />
    </View>
  );
  const board = (
    <View
      style={styles.preview}
      onLayout={area.onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {layout.width > 0 && area.height >= MIN_PREVIEW_HEIGHT && <Board game={preview} layout={layout} />}
    </View>
  );
  const modes = (
    <View style={styles.modes}>
      <DrawnCard contentStyle={styles.card}>
        <Text style={Typography.heading}>En ligne</Text>
        <Text style={Typography.caption}>Crée une room ou rejoins tes amis avec un code, IA en renfort.</Text>
        <DrawnButton label="Jouer en ligne" onPress={() => router.push('/online')} color={playerColor(1).piece} />
      </DrawnCard>
      <DrawnCard contentStyle={styles.card}>
        <Text style={Typography.heading}>Hors ligne</Text>
        <Text style={Typography.caption}>Contre 1 à 5 IA (trois niveaux), ou de 2 à 6 amis sur le même appareil.</Text>
        <View style={styles.buttonRow}>
          <DrawnButton
            label="Contre l’IA"
            onPress={() => router.push('/ai-setup')}
            color={playerColor(0).piece}
            size="small"
            style={styles.flexButton}
          />
          <DrawnButton
            label="Entre amis"
            onPress={() => router.push('/local-setup')}
            size="small"
            style={styles.flexButton}
          />
        </View>
      </DrawnCard>
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, wide && { paddingBottom: navInset }]} edges={edges}>
      {wide ? (
        // Grand écran : plateau à gauche, titre et modes de jeu à droite.
        <View style={[styles.content, styles.wideContent]}>
          {board}
          <View style={styles.wideColumn}>
            {header}
            {modes}
          </View>
        </View>
      ) : (
        // Téléphone : si la hauteur ne suffit pas (navigateur avec sa propre barre, petit écran),
        // l'accueil défile au lieu de passer sous la barre de navigation.
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: navInset }]}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.content, styles.scrollable]}>
            {header}
            {board}
            {modes}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    justifyContent: 'space-between',
    gap: Spacing.four,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Dans le défilement : le contenu remplit la hauteur disponible (le plateau prend le reste) et grandit
  // au besoin, au lieu de se limiter à l'écran.
  scrollable: {
    flex: 0,
    flexGrow: 1,
  },
  wideContent: {
    maxWidth: MaxWideContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.six,
    paddingHorizontal: Spacing.five,
  },
  wideColumn: {
    width: 440,
    gap: Spacing.five,
  },
  header: {
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  titles: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  preview: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modes: {
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flexButton: {
    flex: 1,
  },
});
