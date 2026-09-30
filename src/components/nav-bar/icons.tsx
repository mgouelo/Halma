// Icônes de la barre de navigation, dessinées au trait noir comme le reste de
// l'application : logo (l'étoile de assets/icon-source/icon.svg), montagne du
// classement et silhouette du joueur non connecté. Pions en pastel.

import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Polygon } from 'react-native-svg';

import { Colors, playerColor, Stroke } from '@/constants/theme';

interface IconProps {
  size: number;
}

/** Épaisseur du trait dans une boîte `viewBox` pour qu'il mesure `width` points à l'écran. */
function strokeFor(width: number, viewBox: number, size: number) {
  return (width * viewBox) / size;
}

// Étoile de l'icône de l'application (boîte 1024 × 1024, centre 512).
const STAR_POINTS =
  '512,62.6 653.2,267.5 901.2,287.3 794.4,512 901.2,736.7 653.2,756.5 512,961.4 370.8,756.5 122.8,736.7 229.6,512 122.8,287.3 370.8,267.5';
/** Couleur du pion de chaque branche (0 haut, puis sens horaire), comme sur l'icône. */
const BRANCH_COLORS = [3, 4, 5, 0, 1, 2].map((player) => playerColor(player).piece);
/** Distance du centre au pion d'une branche. */
const PION_DISTANCE = 330;

/**
 * Logo de l'application : l'étoile au trait noir, avec son ombre franche et un
 * pion pastel dans chaque branche (l'icône en a trois, illisibles à cette taille).
 */
export function StarLogo({ size }: IconProps) {
  const stroke = strokeFor(Stroke.bold, 1024, size);
  const shadow = strokeFor(2, 1024, size);
  const pion = size >= 56 ? 62 : 74;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Polygon
        points={STAR_POINTS}
        transform={`translate(${shadow} ${shadow})`}
        fill={Colors.ink}
        stroke={Colors.ink}
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
      <Polygon points={STAR_POINTS} fill={Colors.paper} stroke={Colors.ink} strokeWidth={stroke} strokeLinejoin="round" />
      {BRANCH_COLORS.map((color, branch) => {
        const angle = ((branch * 60 - 90) * Math.PI) / 180;
        const cx = 512 + PION_DISTANCE * Math.cos(angle);
        const cy = 512 + PION_DISTANCE * Math.sin(angle);
        return (
          <G key={branch}>
            <Circle cx={cx + shadow / 2} cy={cy + shadow / 2} r={pion} fill={Colors.ink} />
            <Circle cx={cx} cy={cy} r={pion} fill={color} stroke={Colors.ink} strokeWidth={stroke * 0.8} />
          </G>
        );
      })}
      <Circle cx={512} cy={512} r={pion * 0.7} fill={Colors.paper} stroke={Colors.ink} strokeWidth={stroke * 0.7} />
    </Svg>
  );
}

// Montagne à deux sommets (boîte 48 × 48).
const MOUNTAIN = 'M3 42 L19 14 L27 28 L33 21 L45 42 Z';

/** Montagne du classement : deux sommets au trait noir, un pion pastel posé sur chacun. */
export function MountainIcon({ size }: IconProps) {
  const stroke = strokeFor(Stroke.regular, 48, size);
  const shadow = strokeFor(2, 48, size);
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d={MOUNTAIN} transform={`translate(${shadow} ${shadow})`} fill={Colors.ink} />
      <Path d={MOUNTAIN} fill={Colors.paper} stroke={Colors.ink} strokeWidth={stroke} strokeLinejoin="round" />
      {/* Neige du grand sommet. */}
      <Path
        d="M13.9 23 L16.5 25.6 L19 23 L21.6 25.6 L24.1 23"
        fill="none"
        stroke={Colors.ink}
        strokeWidth={stroke * 0.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path d="M1.5 42 H46.5" stroke={Colors.ink} strokeWidth={stroke} strokeLinecap="round" />
      <Circle cx={33 + shadow / 2} cy={16.8 + shadow / 2} r={3.6} fill={Colors.ink} />
      <Circle cx={33} cy={16.8} r={3.6} fill={playerColor(1).piece} stroke={Colors.ink} strokeWidth={stroke * 0.8} />
      <Circle cx={19 + shadow / 2} cy={9 + shadow / 2} r={4.6} fill={Colors.ink} />
      <Circle cx={19} cy={9} r={4.6} fill={playerColor(0).piece} stroke={Colors.ink} strokeWidth={stroke * 0.8} />
    </Svg>
  );
}

/** Silhouette du joueur non connecté, dans le même cadre rond que `<Avatar />`. */
export function Silhouette({ size }: IconProps) {
  const inner = size - Stroke.regular * 2;
  const stroke = strokeFor(Stroke.regular, 48, inner);
  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={inner} height={inner} viewBox="0 0 48 48">
        <Path d="M7 50 C7 34 41 34 41 50 Z" fill={Colors.paper} stroke={Colors.ink} strokeWidth={stroke} />
        <Circle cx={24} cy={19} r={8.5} fill={Colors.paper} stroke={Colors.ink} strokeWidth={stroke} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
