import type { SignOutController } from '@/auth/use-sign-out';
import { useT } from '@/i18n';

import { ConfirmDialog } from './confirm-dialog';

/** Confirmation de déconnexion d'un compte invité (la déconnexion est définitive). */
export function SignOutDialog({ controller }: { controller: SignOutController }) {
  const t = useT();
  return (
    <ConfirmDialog
      visible={controller.confirming}
      title={t('profile.signOutTitle')}
      message={t('profile.signOutMessage')}
      cancelLabel={t('profile.stayConnected')}
      extraLabel={t('common.createMyAccount')}
      confirmLabel={t('profile.signOutAnyway')}
      onCancel={controller.cancel}
      onExtra={controller.createAccount}
      onConfirm={controller.confirm}
    />
  );
}
