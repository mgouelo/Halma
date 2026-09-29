import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Polygon } from 'react-native-svg';

import { Colors, playerColor, Shadow, Stroke } from '@/constants/theme';
import { ALL_CELLS, cellKey, cornerOf, parseCellKey, type Cell, type GameState, type Move } from '@/game';

import type { BoardLayout } from './layout';
import { MovingPiece } from './moving-piece';

interface BoardProps {
  game: GameState;
  layout: BoardLayout;
  selected?: Cell | null;
  /** Coups possibles du pion sélectionné : leurs destinations sont mises en évidence. */
  moves?: Move[];
  /** Coup à animer ; son pion est caché sur le plateau pendant l'animation. */
  animating?: { move: Move; player: number; turn: number } | null;
  onCellPress?: (cell: Cell) => void;
  onAnimationEnd?: () => void;
}

/** Plateau en étoile dessiné en SVG. Affichage seulement : aucune règle ici. */
export function Board({ game, layout, selected, moves = [], animating, onCellPress, onAnimationEnd }: BoardProps) {
  const { width, height, spacing, toPoint, starPoints } = layout;
  const holeRadius = spacing * 0.17;
  const pieceRadius = spacing * 0.36;

  const homeTint = useMemo(() => {
    const byCorner = new Map<number, string>();
    for (const player of game.players) byCorner.set(player.home, playerColor(player.id).tint);
    return byCorner;
  }, [game.players]);

  const selectedKey = selected ? cellKey(selected) : null;
  const hiddenKey = animating ? cellKey(animating.move.path[animating.move.path.length - 1]) : null;
  const targets = moves.map((move) => move.path[move.path.length - 1]);

  const animationPoints = useMemo(
    () => (animating ? [animating.move.from, ...animating.move.path].map(toPoint) : []),
    [animating, toPoint],
  );

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Polygon
          points={starPoints}
          fill={Colors.ink}
          stroke={Colors.ink}
          strokeWidth={Stroke.bold}
          strokeLinejoin="round"
          translate={Shadow.offset}
        />
        <Polygon
          points={starPoints}
          fill={Colors.paper}
          stroke={Colors.ink}
          strokeWidth={Stroke.bold}
          strokeLinejoin="round"
        />

        {ALL_CELLS.map((cell) => {
          const { x, y } = toPoint(cell);
          const corner = cornerOf(cell);
          const tint = corner === null ? undefined : homeTint.get(corner);
          return (
            <G key={cellKey(cell)}>
              {tint && <Circle cx={x} cy={y} r={spacing * 0.48} fill={tint} />}
              <Circle cx={x} cy={y} r={holeRadius} fill={Colors.paper} stroke={Colors.ink} strokeWidth={Stroke.thin} />
            </G>
          );
        })}

        {Object.entries(game.board).map(([key, player]) => {
          if (key === hiddenKey) return null;
          const { x, y } = toPoint(parseCellKey(key));
          const isSelected = key === selectedKey;
          const lift = isSelected ? -Shadow.offset / 2 : 0;
          return (
            <G key={key}>
              <Circle cx={x + (isSelected ? Shadow.offset / 2 : 1.5)} cy={y + (isSelected ? Shadow.offset / 2 : 1.5)} r={pieceRadius} fill={Colors.ink} />
              <Circle
                cx={x + lift}
                cy={y + lift}
                r={pieceRadius}
                fill={playerColor(player).piece}
                stroke={Colors.ink}
                strokeWidth={isSelected ? Stroke.bold : Stroke.regular}
              />
            </G>
          );
        })}

        {targets.map((cell) => {
          const { x, y } = toPoint(cell);
          return (
            <G key={`target-${cellKey(cell)}`}>
              <Circle
                cx={x}
                cy={y}
                r={pieceRadius}
                fill={playerColor(game.currentPlayer).tint}
                stroke={Colors.ink}
                strokeWidth={Stroke.regular}
                strokeDasharray={`${spacing * 0.12} ${spacing * 0.1}`}
              />
              <Circle cx={x} cy={y} r={holeRadius} fill={playerColor(game.currentPlayer).piece} stroke={Colors.ink} strokeWidth={Stroke.thin} />
            </G>
          );
        })}

        {onCellPress &&
          ALL_CELLS.map((cell) => {
            const { x, y } = toPoint(cell);
            return (
              <Circle
                key={`hit-${cellKey(cell)}`}
                cx={x}
                cy={y}
                r={spacing / 2}
                fill={Colors.ink}
                fillOpacity={0.001}
                onPress={() => onCellPress(cell)}
              />
            );
          })}
      </Svg>

      {animating && onAnimationEnd && (
        <MovingPiece
          key={animating.turn}
          points={animationPoints}
          radius={pieceRadius}
          color={playerColor(animating.player).piece}
          onDone={onAnimationEnd}
        />
      )}
    </View>
  );
}
