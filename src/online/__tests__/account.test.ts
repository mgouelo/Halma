// Suppression de compte (Edge Function `delete-account`) : abandon des parties
// en cours, puis suppression ; et place « Compte supprimé » gérée par l'arbitre.

import { describe, expect, it, jest } from '@jest/globals';

import { deleteAccount, type AccountStore } from '../account';
import { advance, isDeparted, stalePlayers } from '../referee';
import { ai, ALICE, BOB, CAROL, human, MemoryStore, NOW, onlineGame, ROOM_ID } from '../__test-utils__/fixtures';

const options = { now: () => NOW };

function accounts(rooms: string[] = [ROOM_ID]) {
  const deleted: string[] = [];
  const store: AccountStore & { deleted: string[] } = {
    deleted,
    playingRooms: jest.fn(async () => rooms),
    deleteUser: jest.fn(async (id: string) => {
      deleted.push(id);
    }),
  };
  return store;
}

describe('suppression de compte', () => {
  it('refuse sans utilisateur authentifié, sans rien supprimer', async () => {
    const store = accounts();
    await expect(deleteAccount(null, store, new MemoryStore({ participants: [] }), options)).resolves.toMatchObject({
      ok: false,
      code: 'not_authenticated',
    });
    expect(store.deleted).toEqual([]);
  });

  it('abandonne la partie en cours puis supprime le compte : l’autre joueur gagne par forfait', async () => {
    const participants = [human(0, ALICE), human(1, BOB)];
    const games = new MemoryStore({ participants, game: onlineGame(participants) });
    const store = accounts();
    await expect(deleteAccount(ALICE, store, games, options)).resolves.toEqual({ ok: true, resigned: 1 });
    expect(games.game).toMatchObject({ endReason: 'forfeit', forfeited: [0], state: { winner: 1 } });
    expect(store.deleted).toEqual([ALICE]);
  });

  it('un hôte qui part en pleine partie à trois : les deux autres continuent', async () => {
    const participants = [human(0, ALICE), human(1, BOB), human(2, CAROL)];
    const games = new MemoryStore({ participants, game: onlineGame(participants), hostId: ALICE });
    await deleteAccount(ALICE, accounts(), games, options);
    expect(games.game).toMatchObject({ endReason: null, forfeited: [0], state: { status: 'playing' } });
    // Ses pions ont quitté le plateau.
    expect(Object.values(games.game!.state.board)).not.toContain(0);
  });

  it('supprime aussi un joueur qui a déjà abandonné ou dont la partie est finie', async () => {
    const participants = [human(0, ALICE), human(1, BOB)];
    const games = new MemoryStore({ participants, game: { ...onlineGame(participants), forfeited: [0] } });
    const store = accounts();
    await expect(deleteAccount(ALICE, store, games, options)).resolves.toEqual({ ok: true, resigned: 0 });
    expect(store.deleted).toEqual([ALICE]);
  });

  it('ne supprime rien si l’abandon échoue (base indisponible) : on peut réessayer', async () => {
    const participants = [human(0, ALICE), human(1, BOB)];
    const games = new MemoryStore({ participants, game: onlineGame(participants) });
    games.failLoad = new Error('base indisponible');
    const store = accounts();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await deleteAccount(ALICE, store, games, options);
    spy.mockRestore();
    expect(result).toMatchObject({ ok: false, code: 'server_error' });
    expect(store.deleted).toEqual([]);
  });

  it('transforme une erreur de suppression en erreur serveur', async () => {
    const store = accounts([]);
    (store.deleteUser as jest.Mock<(id: string) => Promise<void>>).mockRejectedValueOnce(new Error('auth'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(deleteAccount(ALICE, store, new MemoryStore({ participants: [] }), options)).resolves.toMatchObject({
      ok: false,
      code: 'server_error',
    });
    spy.mockRestore();
  });
});

describe('place d’un compte supprimé', () => {
  // Après suppression, la base garde la place avec user_id null (ni humain ni IA).
  const departed = { ...human(1, BOB), userId: null };

  it('est reconnue comme telle, pas comme une IA', () => {
    expect(isDeparted(departed)).toBe(true);
    expect(isDeparted(ai(1))).toBe(false);
    expect(isDeparted(human(0, ALICE))).toBe(false);
  });

  it('est déclarée forfait au prochain tick, sans attendre le délai de déconnexion', () => {
    const participants = [human(0, ALICE), departed, human(2, CAROL)];
    const game = onlineGame(participants);
    expect(stalePlayers(game, participants, NOW, 120_000)).toEqual([1]);
    const next = advance(game, participants, NOW, { forfeitAfterMs: 120_000 });
    expect(next.forfeited).toEqual([1]);
    expect(next.endReason).toBeNull();
  });

  it('laisse gagner par forfait le dernier humain', () => {
    const participants = [human(0, ALICE), departed];
    const next = advance(onlineGame(participants), participants, NOW, { forfeitAfterMs: 120_000 });
    expect(next).toMatchObject({ endReason: 'forfeit', state: { winner: 0 } });
  });
});
