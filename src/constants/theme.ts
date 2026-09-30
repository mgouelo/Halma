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

/**
 * Police de l'application : Fredoka (SIL Open Font License), ronde et
 * ludique comme les avatars, lisible en petit avec tous les accents.
 * Trois graisses seulement, chacune chargée comme une famille à part
 * (src/constants/fonts.ts) : on change de graisse en changeant de famille,
 * jamais avec `fontWeight` (le web inventerait un faux gras).
 */
export const FontFaces = {
  regular: 'Fredoka_400Regular',
  semibold: 'Fredoka_600SemiBold',
  bold: 'Fredoka_700Bold',
} as const;

/** Polices système de secours, si Fredoka n'a pas pu être chargée (web ; sur mobile, le système s'en charge). */
const FALLBACK = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const family = (face: string) => (Platform.OS === 'web' ? `${face}, ${FALLBACK}` : face);

/** Familles à utiliser dans les styles (`fontFamily`), avec leur secours sur le web. */
export const Fonts = {
  regular: family(FontFaces.regular),
  semibold: family(FontFaces.semibold),
  bold: family(FontFaces.bold),
} as const;

/** Styles de texte prêts à l'emploi. */
export const Typography = {
  display: { fontFamily: Fonts.bold, fontSize: 48, color: Colors.ink, letterSpacing: -0.5 },
  title: { fontFamily: Fonts.bold, fontSize: 26, color: Colors.ink },
  heading: { fontFamily: Fonts.semibold, fontSize: 18, color: Colors.ink },
  body: { fontFamily: Fonts.regular, fontSize: 16, color: Colors.ink },
  caption: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.inkSoft },
  button: { fontFamily: Fonts.semibold, fontSize: 18, color: Colors.ink },
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

/** Taille minimale d'une zone touchable (recommandations iOS et Android : 44 à 48 points). */
export const TouchTarget = 44;

/**
 * Largeur à partir de laquelle l'écran passe en disposition « grand écran »
 * (tablette, ordinateur) : deux colonnes au lieu d'une.
 */
export const WideBreakpoint = 900;

/** Largeur maximale du contenu en disposition grand écran. */
export const MaxWideContentWidth = 1120;

/** Durée d'un saut ou d'un pas lors de l'animation d'un coup (ms). */
export const MoveHopDuration = 170;
