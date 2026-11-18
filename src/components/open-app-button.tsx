import { openApp, useScreenHost } from '@/auth/open-app';
import { playerColor } from '@/constants/theme';
import { useT } from '@/i18n';

import { DrawnButton } from './drawn-button';

/**
 * « Ouvrir l'application Halma » : seulement dans le navigateur d'un téléphone
 * (sur ordinateur et dans l'application elle-même, rien).
 */
export function OpenAppButton() {
  const t = useT();
  const host = useScreenHost();
  if (host !== 'phone') return null;
  return (
    <DrawnButton
      label={t('openApp.button')}
      onPress={openApp}
      color={playerColor(2).piece}
      accessibilityHint={t('openApp.hint')}
    />
  );
}
