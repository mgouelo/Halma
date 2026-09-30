// Faux plateau pour les tests d'écran : deux boutons, « Choisir un pion »
// (premier pion jouable du joueur courant) et « Jouer le coup » (premier coup
// du pion choisi). L'animation se termine aussitôt.

import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { getLegalMoves, type Cell, type GameState, type Move } from '@/game';

interface FakeBoardProps {
  game: GameState;
  moves?: Move[];
  animating?: unknown;
  onCellPress?: (cell: Cell) => void;
  onAnimationEnd?: () => void;
}

export function FakeBoard({ game, moves = [], animating, onCellPress, onAnimationEnd }: FakeBoardProps) {
  useEffect(() => {
    if (animating) onAnimationEnd?.();
  }, [animating, onAnimationEnd]);
  const playable = Object.entries(game.board)
    .filter(([, player]) => player === game.currentPlayer)
    .map(([key]) => {
      const [q, r] = key.split(',').map(Number);
      return { q, r };
    })
    .find((cell) => getLegalMoves(game, cell).length > 0);
  const target = moves[0]?.path[moves[0].path.length - 1];
  return (
    <View>
      <Pressable accessibilityRole="button" onPress={() => playable && onCellPress?.(playable)}>
        <Text>Choisir un pion</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => target && onCellPress?.(target)}>
        <Text>Jouer le coup</Text>
      </Pressable>
    </View>
  );
}
