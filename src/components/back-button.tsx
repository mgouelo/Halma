import { usePathname } from 'expo-router';
import { View } from 'react-native';

import { backFallback, goBack } from '@/navigation/back';

import { DrawnButton } from './drawn-button';

/**
 * « ‹ Retour » : seul élément de navigation des écrans sans barre. Revient à
 * l'écran précédent ; sans historique (page rechargée, lien direct), au profil
 * pour les écrans de compte et d'information, à l'accueil sinon.
 */
export function BackButton() {
  const pathname = usePathname();
  return (
    <View style={{ flexDirection: 'row' }}>
      <DrawnButton
        label="‹ Retour"
        size="small"
        onPress={() => goBack(backFallback(pathname))}
        accessibilityHint="Revient à l’écran précédent"
      />
    </View>
  );
}
