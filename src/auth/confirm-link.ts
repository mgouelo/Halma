// Lien de confirmation d'e-mail (inscription, ou invité qui ajoute un e-mail) :
// sur l'appareil qui l'attend, on ouvre la session ; ailleurs, on valide
// seulement, sans toucher à la session de cet appareil.

import type { SupabaseClient } from '@supabase/supabase-js';

import type { AuthLink } from './auth-links';
import { refreshAccount, sessionFromLink } from './auth-service';
import type { PendingConfirmation } from './pending-confirmation';

/** `here` : session ouverte sur cet appareil ; `elsewhere` : compte validé, à reprendre sur l'appareil d'origine. */
export type ConfirmationOutcome = 'here' | 'elsewhere';

export interface ConfirmDeps {
  /** Client de l'application (session enregistrée). */
  client: SupabaseClient;
  /** Client jetable, sans session enregistrée. */
  ephemeralClient: () => SupabaseClient;
  readPending: () => Promise<PendingConfirmation | null>;
  forgetPending: () => Promise<void>;
}

export async function confirmFromLink(link: AuthLink, deps: ConfirmDeps): Promise<ConfirmationOutcome> {
  const pending = await deps.readPending();
  if (pending) {
    const session = await sessionFromLink(deps.client, link);
    // Changement d'e-mail validé sans nouvelle session : on relit le compte.
    if (!session) {
      try {
        await refreshAccount(deps.client);
      } catch {
        // Sans gravité : l'application relit le compte d'elle-même (AuthProvider).
      }
    }
    await deps.forgetPending();
    return 'here';
  }
  // Flux implicite : Supabase a déjà validé l'e-mail avant de rediriger, rien à faire ici.
  if (link.kind === 'session') return 'elsewhere';
  // Client jetable : verifier le jeton avec le client de l'application
  // remplacerait la session de cet appareil (peut-etre un autre compte).
  await sessionFromLink(deps.ephemeralClient(), link);
  return 'elsewhere';
}
