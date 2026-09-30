// Thème de l'application : couleurs, typographie, espacements et traits.
// DA : dessin au trait noir sur fond blanc, ombres franches décalées,
// pions en couleurs pastel douces. Toute couleur ou police utilisée dans
// l'interface doit venir d'ici.

import { Platform, type TextStyle } from 'react-native';

export const Colors = {
  /** Fond de l'application et intérieur des formes. */
  paper: '#FFFFFF',
  /** Trait, texte et ombres. */
  ink: '#111111',
  /** Texte secondaire. */
  inkSoft: '#6B6B6B',
  /** Cases vides et séparateurs discrets. */
  line: '#D9D9D9',
  /** Voile derrière une fenêtre (écran de victoire). */
  scrim: 'rgba(255, 255, 255, 0.82)',
} as const;

/**
 * Couleurs pastel des joueurs, dans l'ordre des identifiants du moteur.
 * `piece` pour les pions, `tint` (plus pâle) pour teinter leur branche de départ.
 */
export const PlayerColors = [
  { name: 'Rose', piece: '#F6B8C8', tint: '#FDECF1' },
  { name: 'Bleu', piece: '#A9CBEF', tint: '#EAF3FC' },
  { name: 'Menthe', piece: '#B3E6CF', tint: '#EBF8F2' },
  { name: 'Citron', piece: '#F8E7A1', tint: '#FDF8E4' },
  { name: 'Lavande', piece: '#D2BEEA', tint: '#F3EDFA' },
  { name: 'Pêche', piece: '#FACBA8', tint: '#FEF0E6' },
] as const;

export function playerColor(player: number) {
  return PlayerColors[player % PlayerColors.length];
}

/** Hexadécimal sans « # », comme dans les avatars Humation. */
const hex = (color: string) => color.replace(/^#/, '').toUpperCase();
const pieces = PlayerColors.map((c) => hex(c.piece));

/**
 * Couleurs proposées dans l'éditeur d'avatar (hexadécimal sans « # »). Le trait
 * reste noir (DA) ; la première couleur de chaque liste est celle par défaut.
 */
export const AvatarPalettes = {
  skin: ['FFFFFF', 'FBE3D2', 'F3C9A6', 'DDA67F', 'B07A55', '7A4E33'],
  hair: ['000000', '4A3728', '8A5A33', 'C98E4E', 'E9D3A1', 'B8B8B8', 'FFFFFF', ...pieces.slice(0, 2), pieces[4]],
  clothes: ['FFFFFF', ...pieces, '000000'],
  bottom: ['000000', '3B4A6B', '8A8A8A', 'FFFFFF', ...pieces],
  background: ['F6F5F4', 'FFFFFF', ...PlayerColors.map((c) => hex(c.tint))],
} as const;

const displayFamily = Platform.select({
  ios: 'ui-rounded',
  web: 'ui-rounded, "SF Pro Rounded", "Nunito", "Hiragino Maru Gothic ProN", system-ui, sans-serif',
  default: 'sans-serif',
});

const textFamily = Platform.select({
  ios: 'system-ui',
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  default: 'sans-serif',
});

/** Styles de texte prêts à l'emploi. */
export const Typography = {
  display: { fontFamily: displayFamily, fontSize: 48, fontWeight: '900', color: Colors.ink, letterSpacing: -1 },
  title: { fontFamily: displayFamily, fontSize: 26, fontWeight: '900', color: Colors.ink },
  heading: { fontFamily: displayFamily, fontSize: 18, fontWeight: '800', color: Colors.ink },
  body: { fontFamily: textFamily, fontSize: 16, fontWeight: '400', color: Colors.ink },
  caption: { fontFamily: textFamily, fontSize: 13, fontWeight: '500', color: Colors.inkSoft },
  button: { fontFamily: displayFamily, fontSize: 18, fontWeight: '800', color: Colors.ink },
} as const satisfies Record<string, TextStyle>;

/** Épaisseurs du trait « dessiné ». */
export const Stroke = {
  thin: 1.5,
  regular: 2,
  bold: 3,
} as const;

/** Ombre franche décalée vers le bas à droite, comme un trait de feutre. */
export const Shadow = {
  offset: 4,
} as const;

export const Radius = {
  small: 12,
  medium: 20,
  large: 28,
  round: 999,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 560;

/** Durée d'un saut ou d'un pas lors de l'animation d'un coup (ms). */
export const MoveHopDuration = 170;
