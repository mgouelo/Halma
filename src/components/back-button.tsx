import { usePathname } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { backFallback, goBack } from '@/navigation/back';

import { DrawnButton } from './drawn-button';

/**
 * « ‹ Retour » : seul élément de navigation des écrans sans barre. Revient à
 * l'écran précédent ; sans historique (page rechargée, lien direct), au profil
 * pour les écrans de compte et d'information, à l'accueil sinon.
 */
export function BackButton() {
  const t = useT();
  const pathname = usePathname();
  return (
    <View style={{ flexDirection: 'row' }}>
      <DrawnButton
        label={t('common.back')}
        size="small"
        onPress={() => goBack(backFallback(pathname))}
        accessibilityHint={t('common.backHint')}
      />
    </View>
  );
}
