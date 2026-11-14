import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import { confirmFromLink, type ConfirmDeps } from '../confirm-link';

function client(session: unknown = { access_token: 't' }) {
  const auth = {
    verifyOtp: jest.fn(async () => ({ data: { session, user: { id: 'u1' } }, error: null })),
    setSession: jest.fn(async () => ({ data: { session, user: { id: 'u1' } }, error: null })),
    refreshSession: jest.fn(async () => ({ data: { session: {}, user: { id: 'u1', is_anonymous: false } }, error: null })),
  };
  return { auth, asSupabase: { auth } as unknown as SupabaseClient };
}

function deps(pending: boolean) {
  const main = client();
  const ephemeral = client();
  const value: ConfirmDeps = {
    client: main.asSupabase,
    ephemeralClient: () => ephemeral.asSupabase,
    readPending: async () => (pending ? { email: 'a@b.fr', kind: 'signup' } : null),
    forgetPending: jest.fn(async () => {}),
  };
  return { main, ephemeral, value };
}

const otp = { kind: 'otp', tokenHash: 'h', type: 'email' } as const;

describe('lien de confirmation', () => {
  it('sur l’appareil de l’inscription : session ouverte ici, attente oubliée', async () => {
    const { main, ephemeral, value } = deps(true);
    await expect(confirmFromLink(otp, value)).resolves.toBe('here');
    expect(main.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'h', type: 'email' });
    expect(ephemeral.auth.verifyOtp).not.toHaveBeenCalled();
    expect(value.forgetPending).toHaveBeenCalled();
  });

  it('sur un autre appareil : validé avec un client jetable, sans toucher à la session de cet appareil', async () => {
    const { main, ephemeral, value } = deps(false);
    await expect(confirmFromLink(otp, value)).resolves.toBe('elsewhere');
    expect(ephemeral.auth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(main.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('flux implicite sur un autre appareil : déjà validé par Supabase, aucun appel', async () => {
    const { main, ephemeral, value } = deps(false);
    const link = { kind: 'session', accessToken: 'a', refreshToken: 'r', type: 'signup' } as const;
    await expect(confirmFromLink(link, value)).resolves.toBe('elsewhere');
    expect(main.auth.setSession).not.toHaveBeenCalled();
    expect(ephemeral.auth.setSession).not.toHaveBeenCalled();
  });

  it('changement d’e-mail sans nouvelle session : le compte est relu', async () => {
    const { value } = deps(true);
    const main = client(null);
    await confirmFromLink({ kind: 'otp', tokenHash: 'h', type: 'email_change' }, { ...value, client: main.asSupabase });
    expect(main.auth.refreshSession).toHaveBeenCalled();
  });

  it('lien expiré : erreur, l’attente est gardée', async () => {
    const { value } = deps(true);
    await expect(
      confirmFromLink({ kind: 'error', code: 'otp_expired', description: null }, value),
    ).rejects.toMatchObject({ code: 'link_invalid' });
    expect(value.forgetPending).not.toHaveBeenCalled();
  });
});
