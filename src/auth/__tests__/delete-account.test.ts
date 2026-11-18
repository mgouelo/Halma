import { describe, expect, it, jest } from '@jest/globals';
import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import { deleteMyAccount } from '../auth-service';
import { translator } from '@/i18n';

import { AuthFailure, describeAuthError } from '../errors';

const t = translator('fr');
const NETWORK_ERROR = 'Impossible de joindre le serveur. Vérifie ta connexion.';

function fakeClient(error: unknown = null) {
  const client = {
    functions: { invoke: jest.fn(async () => ({ data: { ok: true }, error })) },
    auth: { signOut: jest.fn(async () => ({ error: null })) },
  };
  return { client, asSupabase: client as unknown as SupabaseClient };
}

describe('deleteMyAccount', () => {
  it('appelle l’Edge Function sans envoyer d’identifiant, puis oublie la session locale', async () => {
    const { client, asSupabase } = fakeClient();
    await deleteMyAccount(asSupabase);
    expect(client.functions.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('traduit le code du refus du serveur (pas son message), sans se déconnecter', async () => {
    const response = new Response(JSON.stringify({ ok: false, code: 'server_error', message: 'La suppression a échoué.' }), {
      status: 500,
    });
    const { client, asSupabase } = fakeClient(new FunctionsHttpError(response));
    const error = await deleteMyAccount(asSupabase).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthFailure);
    expect(describeAuthError(t, error)).toBe('La suppression a échoué. Réessaie dans un moment.');
    expect(describeAuthError(translator('es'), error)).toBe('No se ha podido eliminar la cuenta. Inténtalo de nuevo en un rato.');
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it('signale une coupure réseau', async () => {
    const { asSupabase } = fakeClient(new FunctionsFetchError(new TypeError('Network request failed')));
    const error = await deleteMyAccount(asSupabase).catch((e: unknown) => e);
    expect(describeAuthError(t, error)).toBe(NETWORK_ERROR);
  });
});
