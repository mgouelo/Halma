import type { SignOutController } from '@/auth/use-sign-out';

import { ConfirmDialog } from './confirm-dialog';

/** Confirmation de déconnexion d'un compte invité (la déconnexion est définitive). */
export function SignOutDialog({ controller }: { controller: SignOutController }) {
  return (
    <ConfirmDialog
      visible={controller.confirming}
      title="Se déconnecter ?"
      message="Ce compte invité n’existe que sur cet appareil : une fois déconnecté, tu ne pourras plus le retrouver, ni ta progression (statistiques, avatar). Crée d’abord ton compte pour la garder."
      cancelLabel="Rester connecté"
      extraLabel="Créer mon compte"
      confirmLabel="Se déconnecter quand même"
      onCancel={controller.cancel}
      onExtra={controller.createAccount}
      onConfirm={controller.confirm}
    />
  );
}
