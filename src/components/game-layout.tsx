import { useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Cell, GameState, Move, PlayerId } from '@/game';
import {
  Colors,
  Fonts,
  MaxContentWidth,
  MaxWideContentWidth,
  Radius,
  Shadow,
  Spacing,
  Stroke,
  Typography,
} from '@/constants/theme';
import { useMeasuredSize } from '@/hooks/use-measured-size';
import { useWideLayout } from '@/hooks/use-wide-layout';

import { Board } from './board/board';
import { computeBoardLayout } from './board/layout';
import { DrawnCard } from './drawn-card';
import { ThinkingDots } from './state-view';

/** Place prise par le cadre de la carte autour du plateau (bords, marge, ombre). */
const CARD_INSET = (Stroke.bold + Spacing.two) * 2 + Shadow.offset;
/** Largeur du panneau latéral en disposition grand écran. */
const SIDE_PANEL_WIDTH = 340;

interface GameLayoutProps {
  /** Ligne du haut : bouton de retour et informations (numéro du coup…). */
  header: ReactNode;
  /** Tour en cours (voir `TurnStatus`). */
  status: ReactNode;
  /** Joueurs de la partie (en ligne). */
  players?: ReactNode;
  /** Message d'erreur ou d'information. */
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
 * Mise en page commune des écrans de partie. Sur téléphone, tout est empilé
 * autour du plateau ; sur grand écran (tablette, ordinateur), les informations
 * passent dans un panneau à gauche et le plateau prend toute la hauteur.
 */
export function GameLayout({
  header,
  status,
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
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      {wide ? (
        <View style={[styles.content, styles.wideContent]}>
          <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
            {header}
            {status}
            {badges}
            {players}
            {notice}
            {footer}
          </ScrollView>
          {boardArea}
        </View>
      ) : (
        <View style={styles.content}>
          {header}
          {players}
          {status}
          {badges}
          {notice}
          {boardArea}
          {footer}
        </View>
      )}
      {overlay}
    </SafeAreaView>
  );
}

/**
 * « Au tour de » suivi du joueur, et une consigne. Le joueur apparaît en fondu à
 * chaque changement de tour ; `thinking` ajoute l'indicateur d'attente (IA).
 * En ligne, `mine` remplace « Au tour de » par une bannière « À toi de jouer ! »
 * dans la couleur du joueur, et `lead` permet d'écrire « En attente de ».
 */
export function TurnStatus({
  turnKey,
  player,
  hint,
  thinking = false,
  lead = 'Au tour de',
  mine,
}: {
  /** Change à chaque tour (numéro du coup), pour animer l'arrivée du joueur. */
  turnKey: string | number;
  /** Joueur dont c'est le tour, ou null (partie finie). */
  player: ReactNode | null;
  hint: string;
  thinking?: boolean;
  /** Texte au-dessus du joueur quand ce n'est pas à toi. */
  lead?: string;
  /** C'est à toi de jouer (en ligne) : couleur `piece` de la bannière. */
  mine?: { color: string };
}) {
  return (
    <View style={styles.turn} accessibilityLiveRegion="polite">
      {player && (
        <>
          {mine ? (
            <Animated.View key={`mine-${turnKey}`} entering={FadeIn.duration(220)}>
              <DrawnCard radius={Radius.round} contentStyle={[styles.mine, { backgroundColor: mine.color }]}>
                <Text style={styles.mineText} accessibilityRole="header">
                  À toi de jouer !
                </Text>
              </DrawnCard>
            </Animated.View>
          ) : (
            <Text style={Typography.caption}>{lead}</Text>
          )}
          <Animated.View key={turnKey} entering={FadeIn.duration(220)}>
            {player}
          </Animated.View>
        </>
      )}
      <View style={styles.hintRow}>
        {thinking && <ThinkingDots />}
        <Text style={[Typography.caption, styles.hint]}>{hint}</Text>
      </View>
    </View>
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
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
  turn: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  hint: {
    textAlign: 'center',
    flexShrink: 1,
  },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardFace: {
    padding: Spacing.two,
  },
  mine: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  mineText: {
    ...Typography.heading,
    fontFamily: Fonts.bold,
    fontSize: 22,
    textAlign: 'center',
  },
});
