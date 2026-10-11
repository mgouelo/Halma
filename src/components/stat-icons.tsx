// Icônes des statistiques du profil, dessinées comme MountainIcon et EyeIcon :
// trait noir épais aux bouts arrondis, ombre franche, touche de pastel.
// Décoratives : le libellé de chaque statistique est lu, pas le dessin.

import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';

import { Colors, playerColor, Stroke } from '@/constants/theme';

interface IconProps {
  size: number;
}

/** Épaisseur du trait dans la boîte 48 × 48 pour qu'il mesure `width` points à l'écran. */
function strokeFor(width: number, size: number) {
  return (width * 48) / size;
}

/** Boîte 48 × 48 masquée aux lecteurs d'écran. */
function IconFrame({ size, children }: IconProps & { children: ReactNode }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {children}
      </Svg>
    </View>
  );
}

/** Un même tracé deux fois : ombre noire décalée, puis la forme remplie au trait noir. */
function Shape({ d, fill, stroke, shadow }: { d: string; fill: string; stroke: number; shadow: number }) {
  return (
    <>
      <Path d={d} transform={`translate(${shadow} ${shadow})`} fill={Colors.ink} />
      <Path d={d} fill={fill} stroke={Colors.ink} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" />
    </>
  );
}

const CUP = 'M13 7 H35 V17 C35 25.5 30 30 24 30 C18 30 13 25.5 13 17 Z';
const STEM = 'M21 30 H27 V36 H21 Z';
const BASE = 'M14 36.5 H34 V42 H14 Z';

/** Coupe des victoires. */
export function TrophyIcon({ size }: IconProps) {
  const stroke = strokeFor(Stroke.regular, size);
  const shadow = strokeFor(2, size);
  return (
    <IconFrame size={size}>
      {/* Anses. */}
      <Path d="M13 11 C6 11 6 22 15 23" fill="none" stroke={Colors.ink} strokeWidth={stroke} strokeLinecap="round" />
      <Path d="M35 11 C42 11 42 22 33 23" fill="none" stroke={Colors.ink} strokeWidth={stroke} strokeLinecap="round" />
      <Shape d={STEM} fill={Colors.paper} stroke={stroke} shadow={shadow} />
      <Shape d={BASE} fill={Colors.paper} stroke={stroke} shadow={shadow} />
      <Shape d={CUP} fill={playerColor(3).piece} stroke={stroke} shadow={shadow} />
      {/* Reflet. */}
      <Path d="M18.5 12 V17.5" stroke={Colors.ink} strokeWidth={stroke * 0.8} strokeLinecap="round" />
    </IconFrame>
  );
}

const FLAG = 'M13 8 C19 5 24 11 36 8 V24 C24 27 19 21 13 24 Z';

/** Drapeau de départ des parties lancées, planté à côté d'un pion. */
export function StartFlagIcon({ size }: IconProps) {
  const stroke = strokeFor(Stroke.regular, size);
  const shadow = strokeFor(2, size);
  return (
    <IconFrame size={size}>
      <Shape d={FLAG} fill={playerColor(2).piece} stroke={stroke} shadow={shadow} />
      {/* Damier du drapeau de départ. */}
      <Rect x={19} y={10} width={5} height={5} fill={Colors.ink} />
      <Rect x={24} y={15} width={5} height={5} fill={Colors.ink} />
      <Rect x={29} y={10} width={4.5} height={5} fill={Colors.ink} />
      <Path d="M13 6 V42" stroke={Colors.ink} strokeWidth={stroke * 1.2} strokeLinecap="round" />
      <Path d="M6 42 H42" stroke={Colors.ink} strokeWidth={stroke} strokeLinecap="round" />
      <Circle cx={31 + shadow / 2} cy={35 + shadow / 2} r={5.5} fill={Colors.ink} />
      <Circle cx={31} cy={35} r={5.5} fill={playerColor(1).piece} stroke={Colors.ink} strokeWidth={stroke * 0.8} />
    </IconFrame>
  );
}

const FLAME =
  'M24 4 C28 12 38 18 38 29 C38 37 31.5 43 24 43 C16.5 43 10 37 10 29 C10 22 14 18 17 14 C17 19 19 22 22 23 C20 16 21 9 24 4 Z';
const FLAME_CORE = 'M24 27 C27 30.5 30 32.5 30 36.5 C30 39.8 27.3 42 24 42 C20.7 42 18 39.8 18 36.5 C18 32.5 21 30.5 24 27 Z';

function Flame({ stroke, shadow }: { stroke: number; shadow: number }) {
  return (
    <>
      <Shape d={FLAME} fill={playerColor(5).piece} stroke={stroke} shadow={shadow} />
      <Path d={FLAME_CORE} fill={playerColor(3).piece} stroke={Colors.ink} strokeWidth={stroke * 0.8} strokeLinejoin="round" />
    </>
  );
}

/** Flamme de la série de jours de connexion en cours. */
export function FlameIcon({ size }: IconProps) {
  return (
    <IconFrame size={size}>
      <Flame stroke={strokeFor(Stroke.regular, size)} shadow={strokeFor(2, size)} />
    </IconFrame>
  );
}

/** Étoile à cinq branches centrée en (cx, cy), au format SVG « x,y x,y … ». */
function starPoints(cx: number, cy: number, outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const angle = ((i * 36 - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
}

const STAR = starPoints(37, 11, 9, 4.2);

/** Flamme surmontée d'une étoile : la meilleure série de jours. */
export function BestFlameIcon({ size }: IconProps) {
  const stroke = strokeFor(Stroke.regular, size);
  const shadow = strokeFor(2, size);
  return (
    <IconFrame size={size}>
      {/* La flamme, un peu plus petite, laisse la place à l'étoile en haut à droite. */}
      <G transform="translate(1 6) scale(0.86)">
        <Flame stroke={stroke / 0.86} shadow={shadow / 0.86} />
      </G>
      <Polygon points={STAR} transform={`translate(${shadow} ${shadow})`} fill={Colors.ink} />
      <Polygon points={STAR} fill={playerColor(3).piece} stroke={Colors.ink} strokeWidth={stroke} strokeLinejoin="round" />
    </IconFrame>
  );
}
