// Œil du bouton « afficher / masquer le mot de passe » : même dessin que les
// icônes de la barre de navigation (trait noir épais aux bouts arrondis, ombre
// franche, pastel pour la pupille), pas une icône de bibliothèque.

import Svg, { Circle, Path } from 'react-native-svg';

import { Colors, playerColor, Stroke } from '@/constants/theme';

interface EyeIconProps {
  size: number;
  /** Œil ouvert : le mot de passe est masqué, toucher l'affiche. Œil barré : il est visible, toucher le masque. */
  open: boolean;
}

// Boîte 24 × 24 : contour en amande, pupille centrée, barre oblique pour l'œil barré.
const ALMOND = 'M2.5 12 C5.5 6.5 9 5 12 5 C15 5 18.5 6.5 21.5 12 C18.5 17.5 15 19 12 19 C9 19 5.5 17.5 2.5 12 Z';
const SLASH = 'M4.5 20 L19.5 4';

export function EyeIcon({ size, open }: EyeIconProps) {
  const stroke = (Stroke.regular * 24) / size;
  const shadow = (1.5 * 24) / size;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={ALMOND} transform={`translate(${shadow / 2} ${shadow / 2})`} fill={Colors.ink} />
      <Path d={ALMOND} fill={Colors.paper} stroke={Colors.ink} strokeWidth={stroke} strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={3.2} fill={playerColor(1).piece} stroke={Colors.ink} strokeWidth={stroke * 0.8} />
      {!open && (
        <>
          {/* Liseré blanc sous la barre, pour qu'elle se détache de l'œil. */}
          <Path d={SLASH} stroke={Colors.paper} strokeWidth={stroke * 2.4} strokeLinecap="round" />
          <Path d={SLASH} stroke={Colors.ink} strokeWidth={stroke * 1.2} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}
