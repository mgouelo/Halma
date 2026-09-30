import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';

import { Colors, Fonts, playerColor, Stroke } from '@/constants/theme';

/** Marches du podium, de gauche à droite : 2e, 1er, 3e (boîte 42 × 36). */
const STEPS = [
  { place: 2, x: 1, width: 13, height: 15 },
  { place: 1, x: 14, width: 14, height: 22 },
  { place: 3, x: 28, width: 13, height: 10 },
] as const;
const GROUND = 34;
/** Joueur (couleur pastel) de chaque place : citron, bleu, pêche. */
const PLACE_PLAYER = { 1: 3, 2: 1, 3: 5 } as const;

/**
 * Podium dessiné pour les trois premiers : la marche du joueur est teintée,
 * porte son numéro et un pion. La place se lit donc à la forme (hauteur et
 * position de la marche) et au chiffre, pas seulement à la couleur.
 */
export function PodiumBadge({ place, size = 42 }: { place: 1 | 2 | 3; size?: number }) {
  const step = STEPS.find((s) => s.place === place)!;
  const top = GROUND - step.height;
  const cx = step.x + step.width / 2;
  const color = playerColor(PLACE_PLAYER[place]);
  return (
    <Svg width={size} height={(size * 36) / 42} viewBox="0 0 42 36">
      {STEPS.map((s) => (
        <Rect
          key={s.place}
          x={s.x}
          y={GROUND - s.height}
          width={s.width}
          height={s.height}
          fill={s.place === place ? color.tint : Colors.paper}
          stroke={Colors.ink}
          strokeWidth={s.place === place ? Stroke.bold * 0.8 : Stroke.thin}
        />
      ))}
      <SvgText
        x={cx}
        y={top + Math.min(step.height - 2, 12)}
        fontSize={9}
        fontFamily={Fonts.bold}
        fill={Colors.ink}
        textAnchor="middle">
        {place}
      </SvgText>
      <Circle cx={cx + 0.8} cy={top - 4.2} r={3.6} fill={Colors.ink} />
      <Circle cx={cx} cy={top - 5} r={3.6} fill={color.piece} stroke={Colors.ink} strokeWidth={Stroke.thin} />
    </Svg>
  );
}
