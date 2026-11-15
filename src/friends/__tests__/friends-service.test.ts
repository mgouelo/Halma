import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  badgeLabel,
  describeFriendError,
  fetchFriendRequests,
  fetchFriends,
  formatRequestAge,
  FRIEND_ERROR_MESSAGES,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  sortFriends,
  validateFriendPseudo,
  type Friend,
} from '../friends-service';

type Result = { data: unknown; error: unknown };

function fakeClient(result: Result) {
  const client = { rpc: jest.fn(async (..._args: unknown[]) => result) };
  return { client, asSupabase: client as unknown as SupabaseClient };
}

const friend = (pseudo: string, points: number, rank: number | null): Friend => ({
  friendshipId: `f-${pseudo}`,
  pseudo,
  avatar: pseudo,
  points,
  rank,
  userId: `u-${pseudo}`,
});

describe('appels au serveur', () => {
  it('envoie une demande avec le pseudo normalisé (NFC, apostrophe droite, sans espaces)', async () => {
    const { client, asSupabase } = fakeClient({ data: 'sent', error: null });
    await expect(sendFriendRequest(asSupabase, ' Zoé ')).resolves.toBe('sent');
    expect(client.rpc).toHaveBeenCalledWith('send_friend_request', { p_pseudo: 'Zoé' });
    const crossed = fakeClient({ data: 'accepted', error: null });
    await expect(sendFriendRequest(crossed.asSupabase, 'd’Arc')).resolves.toBe('accepted');
    expect(crossed.client.rpc).toHaveBeenCalledWith('send_friend_request', { p_pseudo: "d'Arc" });
  });

  it('accepte, refuse et retire', async () => {
    const { client, asSupabase } = fakeClient({ data: null, error: null });
    await respondFriendRequest(asSupabase, 'r1', true);
    await respondFriendRequest(asSupabase, 'r2', false);
    await removeFriend(asSupabase, 'f1');
    expect(client.rpc.mock.calls).toEqual([
      ['respond_friend_request', { p_request: 'r1', p_accept: true }],
      ['respond_friend_request', { p_request: 'r2', p_accept: false }],
      ['remove_friend', { p_friendship: 'f1' }],
    ]);
  });

  it('lit les amis, triés par points', async () => {
    const { asSupabase } = fakeClient({
      data: [
        { friendship_id: 'a', pseudo: 'Basile', avatar: 'x', points: -15, rank: 40 },
        { friendship_id: 'b', pseudo: 'Zoé', avatar: 'y', points: 120, rank: 3, user_id: 'u-zoe' },
        { friendship_id: 'c', pseudo: 'Chloé', avatar: 'z', points: 0, rank: null, user_id: 'u-chloe' },
      ],
      error: null,
    });
    const friends = await fetchFriends(asSupabase);
    expect(friends.map((f) => f.pseudo)).toEqual(['Zoé', 'Chloé', 'Basile']);
    expect(friends[0]).toEqual({ friendshipId: 'b', pseudo: 'Zoé', avatar: 'y', points: 120, rank: 3, userId: 'u-zoe' });
    // Serveur pas encore migré (pas de user_id) : la ligne reste lisible, sans identifiant.
    expect(friends[2]).toMatchObject({ pseudo: 'Basile', userId: null });
  });

  it('lit les demandes, de la plus récente à la plus ancienne', async () => {
    const { asSupabase } = fakeClient({
      data: [
        { request_id: 'old', pseudo: 'A', avatar: 'a', created_at: '2026-11-10T10:00:00Z' },
        { request_id: 'new', pseudo: 'B', avatar: 'b', created_at: '2026-11-14T10:00:00Z', user_id: 'u-b' },
      ],
      error: null,
    });
    const requests = await fetchFriendRequests(asSupabase);
    expect(requests.map((r) => r.id)).toEqual(['new', 'old']);
    expect(requests.map((r) => r.userId)).toEqual(['u-b', null]);
  });

  it('transmet les erreurs', async () => {
    const { asSupabase } = fakeClient({ data: null, error: { message: 'pseudo_unknown', code: 'P0001' } });
    await expect(sendFriendRequest(asSupabase, 'Personne')).rejects.toMatchObject({ message: 'pseudo_unknown' });
    await expect(fetchFriends(asSupabase)).rejects.toBeTruthy();
  });
});

describe('messages', () => {
  it.each([
    ['pseudo_unknown', 'Aucun joueur ne porte ce pseudo.'],
    ['self_request', 'C’est toi ! Choisis le pseudo d’un autre joueur.'],
    ['already_friends', 'Vous êtes déjà amis.'],
    ['already_requested', 'Demande déjà envoyée : elle attend sa réponse.'],
    ['recently_refused', 'Ce joueur a refusé ta demande. Réessaie dans 24 heures.'],
  ])('traduit %s', (code, message) => {
    expect(describeFriendError({ message: code })).toBe(message);
  });

  it('tous les codes du serveur ont un message', () => {
    for (const code of [
      'pseudo_unknown',
      'self_request',
      'not_eligible',
      'already_friends',
      'already_requested',
      'recently_refused',
      'too_many_sent',
      'request_not_found',
      'friend_not_found',
      'guest_not_allowed',
      'player_not_found',
    ]) {
      expect(FRIEND_ERROR_MESSAGES).toHaveProperty(code);
    }
  });

  it('message générique pour le reste', () => {
    expect(describeFriendError(new TypeError('Failed to fetch'))).toMatch(/Vérifie ta connexion/);
    expect(describeFriendError({ message: 'toString' })).toMatch(/Vérifie ta connexion/);
    expect(describeFriendError(null)).toMatch(/Vérifie ta connexion/);
  });

  it('demande un pseudo avant d’envoyer', () => {
    expect(validateFriendPseudo('   ')).toBe('Écris le pseudo de ton ami.');
    expect(validateFriendPseudo('zoe')).toBeNull();
  });
});

describe('affichage', () => {
  it('trie par points, puis par rang (sans rang en dernier), puis par pseudo', () => {
    const sorted = sortFriends([friend('Basile', 10, null), friend('Anna', 10, 4), friend('Chloé', 10, null), friend('Zoé', 50, 1)]);
    expect(sorted.map((f) => f.pseudo)).toEqual(['Zoé', 'Anna', 'Basile', 'Chloé']);
  });

  it('pastille de la boîte aux lettres', () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(3)).toBe('3');
    expect(badgeLabel(10)).toBe('9+');
  });

  it('âge des demandes', () => {
    const now = Date.parse('2026-11-14T12:00:00Z');
    expect(formatRequestAge('2026-11-14T11:59:40Z', now)).toBe('à l’instant');
    expect(formatRequestAge('2026-11-14T11:55:00Z', now)).toBe('il y a 5 min');
    expect(formatRequestAge('2026-11-14T09:00:00Z', now)).toBe('il y a 3 h');
    expect(formatRequestAge('2026-11-13T10:00:00Z', now)).toBe('hier');
    expect(formatRequestAge('2026-11-10T10:00:00Z', now)).toBe('il y a 4 jours');
  });
});
