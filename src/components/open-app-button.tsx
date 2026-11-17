import { openApp, useScreenHost } from '@/auth/open-app';
import { playerColor } from '@/constants/theme';

import { DrawnButton } from './drawn-button';

/**
 * « Ouvrir l'application Halma » : seulement dans le navigateur d'un téléphone
 * (sur ordinateur et dans l'application elle-même, rien).
 */
export function OpenAppButton() {
  const host = useScreenHost();
  if (host !== 'phone') return null;
  return (
    <DrawnButton
      label="Ouvrir l’application Halma"
      onPress={openApp}
      color={playerColor(2).piece}
      accessibilityHint="Ouvre l’application si elle est installée sur ce téléphone"
    />
  );
}
