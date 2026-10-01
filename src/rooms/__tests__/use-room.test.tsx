// Abonnement Realtime de la salle d'attente : la suppression de la room par
// l'hôte passe la room en « introuvable » sans erreur, en gardant le dernier état connu.

import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { useRoom } from '../use-room';

type Handler = (payload: { eventType: string; new?: unknown }) => void;
const handlers: { table: string; handler: Handler }[] = [];
let subscribeCallback: ((state: string) => void) | null = null;

const mockChannel = {
  on: (_type: string, filter: { table: string }, handler: Handler) => {
    handlers.push({ table: filter.table, handler });
    return mockChannel;
  },
  subscribe: (callback: (state: string) => void) => {
    subscribeCallback = callback;
    return mockChannel;
  },
};
const mockClient = { channel: () => mockChannel, removeChannel: jest.fn() };

const snapshot = {
  room: { id: 'r1', code: 'K7QM3X', hostId: 'host', status: 'waiting', createdAt: '' },
  players: [{ id: 'p1', userId: 'host' }],
  game: null,
};
let mockFetched: unknown = snapshot;

jest.mock('@/lib/supabase', () => ({ getSupabase: () => mockClient }));
jest.mock('../room-service', () => ({
  describeOnlineError: () => 'erreur',
  fetchRoom: async () => mockFetched,
  heartbeat: async () => {},
  roomFromRow: (row: unknown) => row,
}));

describe('useRoom', () => {
  it('passe en « introuvable » quand la room est supprimée, sans erreur', async () => {
    const { result } = renderHook(() => useRoom('r1'));
    await act(async () => {});
    expect(result.current.status).toBe('ready');

    // Suppression reçue par Realtime sur la table rooms.
    await act(async () => {
      handlers.find((h) => h.table === 'rooms')?.handler({ eventType: 'DELETE' });
    });
    expect(result.current.status).toBe('missing');
    expect(result.current.error).toBeNull();
    expect(result.current.snapshot).toEqual(snapshot);
  });

  it('relit la room quand un participant part, et la voit introuvable si elle a disparu', async () => {
    mockFetched = snapshot;
    const { result } = renderHook(() => useRoom('r1'));
    await act(async () => {});
    expect(result.current.status).toBe('ready');

    mockFetched = null;
    await act(async () => {
      handlers.filter((h) => h.table === 'room_players').at(-1)?.handler({ eventType: 'DELETE' });
    });
    expect(result.current.status).toBe('missing');
    expect(result.current.error).toBeNull();
    expect(subscribeCallback).not.toBeNull();
  });
});
