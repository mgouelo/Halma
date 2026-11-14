// Lancement d'une room de matchmaking par l'Edge Function (action « start ») :
// à l'heure prévue, par n'importe quel joueur, une seule fois.

import { describe, expect, it } from '@jest/globals';

import { handleGameRequest } from '../server';
import { ALICE, BOB, CAROL, human, MemoryStore, NOW, ROOM_ID, STRANGER } from '../__test-utils__/fixtures';

const startsAt = new Date(NOW + 5000).toISOString();
const start = { action: 'start', roomId: ROOM_ID };

function store() {
  return new MemoryStore({ participants: [human(0, ALICE), human(1, BOB), human(2, CAROL)], startsAt });
}

describe('lancement d’une room de matchmaking', () => {
  it('refusé avant l’heure prévue (horloge du serveur)', async () => {
    const s = store();
    const response = await handleGameRequest(start, BOB, s, { now: () => NOW + 4999 });
    expect(response).toMatchObject({ ok: false, code: 'start_too_early' });
    expect(s.room.status).toBe('waiting');
  });

  it('à l’heure prévue, n’importe quel joueur la lance (pas d’hôte)', async () => {
    const s = store();
    const response = await handleGameRequest(start, CAROL, s, { now: () => NOW + 5000 });
    expect(response.ok).toBe(true);
    expect(s.room.status).toBe('playing');
    expect(s.game?.state.players).toHaveLength(3);
    expect(s.participants.map((p) => p.playerIndex)).toEqual([0, 1, 2]);
  });

  it('idempotent : les autres joueurs qui demandent aussi le départ reçoivent la même partie', async () => {
    const s = store();
    const first = await handleGameRequest(start, ALICE, s, { now: () => NOW + 6000 });
    const second = await handleGameRequest(start, BOB, s, { now: () => NOW + 6100 });
    expect(first.ok && second.ok).toBe(true);
    expect(second).toEqual(first);
  });

  it('refusé à un joueur qui n’est pas dans la room', async () => {
    const response = await handleGameRequest(start, STRANGER, store(), { now: () => NOW + 6000 });
    expect(response).toMatchObject({ ok: false, code: 'room_not_found' });
  });

  it('une room classique reste lancée par son hôte seulement', async () => {
    const classic = new MemoryStore({ participants: [human(0, ALICE), human(1, BOB)] });
    expect(await handleGameRequest(start, BOB, classic, { now: () => NOW })).toMatchObject({ ok: false, code: 'not_host' });
  });
});
