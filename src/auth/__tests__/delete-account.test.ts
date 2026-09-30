import { describe, expect, it, jest } from '@jest/globals';
import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import { deleteMyAccount } from '../auth-service';
import { AuthFailure, describeAuthError, NETWORK_ERROR } from '../errors';

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

  it('affiche le message du serveur en cas de refus, sans se déconnecter', async () => {
    const response = new Response(JSON.stringify({ ok: false, code: 'server_error', message: 'La suppression a échoué.' }), {
      status: 500,
    });
    const { client, asSupabase } = fakeClient(new FunctionsHttpError(response));
    const error = await deleteMyAccount(asSupabase).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthFailure);
    expect(describeAuthError(error)).toBe('La suppression a échoué.');
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it('signale une coupure réseau', async () => {
    const { asSupabase } = fakeClient(new FunctionsFetchError(new TypeError('Network request failed')));
    const error = await deleteMyAccount(asSupabase).catch((e: unknown) => e);
    expect(describeAuthError(error)).toBe(NETWORK_ERROR);
  });
});
