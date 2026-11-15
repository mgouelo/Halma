import { useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Cell, GameState, Move, PlayerId } from '@/game';
import {
  Colors,
  MaxContentWidth,
  MaxWideContentWidth,
  Shadow,
  Spacing,
  Stroke,
} from '@/constants/theme';
import { useMeasuredSize } from '@/hooks/use-measured-size';
import { useWideLayout } from '@/hooks/use-wide-layout';

import { Board } from './board/board';
import { computeBoardLayout } from './board/layout';
import { DrawnCard } from './drawn-card';
import { DrawnButton } from './drawn-button';

/** Place prise par le cadre de la carte autour du plateau (bords, marge, ombre). */
const CARD_INSET = (Stroke.bold + Spacing.two) * 2 + Shadow.offset;
/** Largeur du panneau latéral en disposition grand écran. */
const SIDE_PANEL_WIDTH = 340;

interface GameLayoutProps {
  /** Ligne du haut : informations discrètes (numéro du coup…). */
  header: ReactNode;
  /**
   * Retour à l'accueil. Affiché seulement en grand écran (tablette, ordinateur) :
   * sur téléphone, on quitte par le geste ou le bouton « retour » du système,
   * ou en abandonnant, et le plateau garde toute la place.
   */
  onHome: () => void;
  /** Joueurs de la partie (voir `PlayersBar`). */
  players?: ReactNode;
  /** Message d'erreur ou d'information, par-dessus le bas du plateau : il ne change pas sa taille. */
  notice?: ReactNode;
  /** Badges des mutateurs actifs. */
  badges?: ReactNode;
  /** Actions (nouvelle partie, abandon). */
  footer?: ReactNode;
  /** Écran de fin, par-dessus tout le reste. */
  overlay?: ReactNode;
  /** Teinte discrète du cadre du plateau : couleur `tint` du joueur dont c'est le tour. */
  frameTint?: string;
  board: {
    game: GameState;
    selected?: Cell | null;
    moves?: Move[];
    animating?: { move: Move; player: number; turn: number } | null;
    /** Joueur dont la branche d'arrivée est mise en évidence (voir `goalPlayer`). */
    goal?: PlayerId | null;
    onCellPress?: (cell: Cell) => void;
    onAnimationEnd?: () => void;
  };
}

/**
 * Mise en page commune des écrans de partie. Sur téléphone, les joueurs sont
 * empilés au-dessus du plateau (leur ligne est de hauteur fixe : le plateau ne
 * change jamais de taille) ; sur grand écran (tablette, ordinateur), les informations
 * passent dans un panneau à gauche et le plateau prend toute la hauteur.
 */
export function GameLayout({
  header,
  onHome,
  players,
  notice,
  badges,
  footer,
  overlay,
  frameTint,
  board,
}: GameLayoutProps) {
  const wide = useWideLayout();
  const area = useMeasuredSize();
  const layout = useMemo(
    () => computeBoardLayout(area.width - CARD_INSET, area.height - CARD_INSET),
    [area.width, area.height],
  );

  const boardArea = (
    <View style={styles.boardArea} onLayout={area.onLayout}>
      {layout.width > 0 && (
        <DrawnCard contentStyle={[styles.boardFace, frameTint !== undefined && { backgroundColor: frameTint }]}>
          <Board layout={layout} {...board} />
        </DrawnCard>
      )}
      {notice ? (
        <View style={styles.notice} pointerEvents="box-none">
          {notice}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      {wide ? (
        <View style={[styles.content, styles.wideContent]}>
          <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
            <DrawnButton label="‹ Accueil" size="small" onPress={onHome} style={styles.home} />
            {header}
            {players}
            {badges}
            {footer}
          </ScrollView>
          {boardArea}
        </View>
      ) : (
        <View style={styles.content}>
          {header}
          {players}
          {badges}
          {boardArea}
          {footer}
        </View>
      )}
      {overlay}
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
    // Marges serrées sur téléphone : chaque point gagné agrandit le plateau.
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  wideContent: {
    maxWidth: MaxWideContentWidth,
    flexDirection: 'row',
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  panel: {
    width: SIDE_PANEL_WIDTH,
    flexGrow: 0,
  },
  panelContent: {
    gap: Spacing.four,
  },
  home: {
    alignSelf: 'flex-start',
  },
  notice: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardFace: {
    padding: Spacing.two,
  },
});
