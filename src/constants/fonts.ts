// Fichiers de la police Fredoka : seulement les trois graisses utilisées
// (import par graisse, pour ne pas embarquer les cinq du paquet).

import { Fredoka_400Regular } from '@expo-google-fonts/fredoka/400Regular';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka/700Bold';

import { FontFaces } from './theme';

/** À passer à `useFonts` : nom de famille (celui de `FontFaces`) → fichier. */
export const FONT_FILES = {
  [FontFaces.regular]: Fredoka_400Regular,
  [FontFaces.semibold]: Fredoka_600SemiBold,
  [FontFaces.bold]: Fredoka_700Bold,
};
