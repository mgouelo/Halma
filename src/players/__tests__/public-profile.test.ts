import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchPublicProfile, isPlayerNotFound, parseRelation } from '../public-profile';

function fakeClient(result: { data: unknown; error: unknown }) {
  const client = { rpc: jest.fn(async (..._args: unknown[]) => result) };
  return { client, asSupabase: client as unknown as SupabaseClient };
}

const ROW = {
  pseudo: 'Elio',
  avatar: 'u-elio',
  points: -15,
  rank: 12,
  wins: 3,
  best_streak: 7,
  relation: 'none',
  friendship_id: null,
  request_id: null,
};

describe('profil public', () => {
  it('lit un profil avec l’identifiant du joueur', async () => {
    const { client, asSupabase } = fakeClient({ data: [ROW], error: null });
    await expect(fetchPublicProfile(asSupabase, 'u-elio')).resolves.toEqual({
      pseudo: 'Elio',
      avatar: 'u-elio',
      points: -15,
      rank: 12,
      wins: 3,
      bestStreak: 7,
      relation: { kind: 'none' },
    });
    expect(client.rpc).toHaveBeenCalledWith('get_public_profile', { p_user: 'u-elio' });
  });

  it('pas encore classé : rang null', async () => {
    const { asSupabase } = fakeClient({ data: [{ ...ROW, rank: null, points: 0 }], error: null });
    await expect(fetchPublicProfile(asSupabase, 'u-elio')).resolves.toMatchObject({ rank: null, points: 0 });
  });

  it('transmet les erreurs et reconnaît « joueur introuvable »', async () => {
    const { asSupabase } = fakeClient({ data: null, error: { message: 'player_not_found', code: 'P0001' } });
    const error = await fetchPublicProfile(asSupabase, 'x').catch((e: unknown) => e);
    expect(isPlayerNotFound(error)).toBe(true);
    expect(isPlayerNotFound({ message: 'guest_not_allowed' })).toBe(false);
    expect(isPlayerNotFound(null)).toBe(false);
    // Aucune ligne : joueur introuvable aussi.
    const empty = fakeClient({ data: [], error: null });
    expect(isPlayerNotFound(await fetchPublicProfile(empty.asSupabase, 'x').catch((e: unknown) => e))).toBe(true);
  });

  it.each([
    [{ relation: 'self', friendship_id: null, request_id: null }, { kind: 'self' }],
    [{ relation: 'none', friendship_id: null, request_id: null }, { kind: 'none' }],
    [{ relation: 'request_sent', friendship_id: null, request_id: null }, { kind: 'request_sent' }],
    [{ relation: 'request_received', friendship_id: null, request_id: 'r1' }, { kind: 'request_received', requestId: 'r1' }],
    [{ relation: 'friends', friendship_id: 'f1', request_id: null }, { kind: 'friends', friendshipId: 'f1' }],
    // Valeur inattendue ou identifiant manquant : aucune relation (le bouton « Envoyer » reste sûr).
    [{ relation: 'friends', friendship_id: null, request_id: null }, { kind: 'none' }],
    [{ relation: 'request_received', friendship_id: null, request_id: null }, { kind: 'none' }],
    [{ relation: 'bientôt', friendship_id: null, request_id: null }, { kind: 'none' }],
  ])('relation %j', (row, expected) => {
    expect(parseRelation(row)).toEqual(expected);
  });
});
