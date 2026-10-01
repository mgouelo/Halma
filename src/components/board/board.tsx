import { useMemo, useRef } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, G, Polygon } from 'react-native-svg';

import { Colors, playerColor, Shadow, Stroke } from '@/constants/theme';
import { ALL_CELLS, cellKey, cornerOf, parseCellKey, type Cell, type GameState, type Move } from '@/game';

import { cellAt, type BoardLayout } from './layout';
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

      {onCellPress && <TouchZone layout={layout} onCellPress={onCellPress} />}
    </View>
  );
}

/** Déplacement maximal (en points) du doigt entre l'appui et le relâchement pour compter comme une touche. */
const TAP_SLOP = 10;

/**
 * Une seule zone tactile pour tout le plateau, posée au-dessus du dessin : la
 * case touchée se retrouve à partir des coordonnées (`cellAt`). Aucun
 * gestionnaire de touche n'est passé aux cercles SVG (sur le web,
 * react-native-svg les transmet tels quels au DOM, d'où l'avertissement React
 * « Unknown event handler property `onResponderTerminate` ») ; le même code
 * marche sur iOS, Android et le web.
 */
function TouchZone({ layout, onCellPress }: { layout: BoardLayout; onCellPress: (cell: Cell) => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, width: layout.width, height: layout.height }}
      accessible
      accessibilityLabel="Plateau de jeu"
      accessibilityHint="Touche un de tes pions, puis une case atteignable."
      onStartShouldSetResponder={() => true}
      onResponderGrant={(event: GestureResponderEvent) => {
        start.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      }}
      onResponderRelease={(event: GestureResponderEvent) => {
        const from = start.current;
        start.current = null;
        const { locationX: x, locationY: y } = event.nativeEvent;
        // Un doigt qui a glissé (défilement de la page) n'est pas une touche.
        if (from && Math.hypot(x - from.x, y - from.y) > TAP_SLOP) return;
        const cell = cellAt(layout, x, y);
        if (cell) onCellPress(cell);
      }}
      onResponderTerminate={() => {
        start.current = null;
      }}
    />
  );
}
