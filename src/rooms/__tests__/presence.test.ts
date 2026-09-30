import { describe, expect, it } from '@jest/globals';

import { applyMove, createGame, getAllLegalMoves } from '@/game';
import { newOnlineGame, type Participant, type StoredGame } from '@/online';

import { AI_TURN_DELAY_MS, AI_TURN_FALLBACK_MS, isOnline, planTicks, secondsBeforeForfeit } from '../presence';

const NOW = Date.parse('2026-10-01T12:00:00Z');
const ago = (s: number) => new Date(NOW - s * 1000).toISOString();

function person(seat: number, userId: string, seenSecondsAgo = 1): Participant {
  return { id: `p${seat}`, seat, userId, aiLevel: null, playerIndex: seat, lastSeenAt: ago(seenSecondsAgo) };
}
function bot(seat: number): Participant {
  return { id: `p${seat}`, seat, userId: null, aiLevel: 'easy', playerIndex: seat, lastSeenAt: ago(9999) };
}
function stored(participants: Participant[], afterFirstMove = false): StoredGame {
  let state = createGame(participants.length as 2 | 3);
  if (afterFirstMove) state = applyMove(state, getAllLegalMoves(state, 0)[0]);
  return { ...newOnlineGame(state), id: 'g', roomId: 'r', version: 1 };
}

describe('présence', () => {
  it('distingue connecté, déconnecté, et compte à rebours avant forfait', () => {
    expect(isOnline(person(0, 'a', 5), NOW)).toBe(true);
    expect(isOnline(person(0, 'a', 60), NOW)).toBe(false);
    expect(isOnline(bot(1), NOW)).toBe(true);
    expect(secondsBeforeForfeit(person(0, 'a', 5), NOW)).toBeNull();
    expect(secondsBeforeForfeit(person(0, 'a', 60), NOW)).toBe(60);
    expect(secondsBeforeForfeit(person(0, 'a', 600), NOW)).toBe(0);
  });
});

describe('planTicks', () => {
  it('le premier humain connecté demande vite le coup de l’IA ; les autres en secours', () => {
    const players = [person(0, 'alice'), bot(1), person(2, 'bob')];
    const game = stored(players, true); // au tour de l'IA
    expect(planTicks(game, players, 'alice', NOW).aiDelay).toBe(AI_TURN_DELAY_MS);
    expect(planTicks(game, players, 'bob', NOW).aiDelay).toBe(AI_TURN_FALLBACK_MS);
  });

  it('si le premier humain est déconnecté, le suivant prend le relais', () => {
    const players = [person(0, 'alice', 60), bot(1), person(2, 'bob')];
    expect(planTicks(stored(players, true), players, 'bob', NOW).aiDelay).toBe(AI_TURN_DELAY_MS);
  });

  it('rien à demander pendant le tour d’un humain connecté', () => {
    const players = [person(0, 'alice'), bot(1)];
    expect(planTicks(stored(players), players, 'alice', NOW)).toEqual({ aiDelay: null, checkForfeits: false });
  });

  it('demande un forfait quand un autre joueur a disparu depuis plus de 2 minutes', () => {
    const players = [person(0, 'alice'), person(1, 'bob', 200)];
    expect(planTicks(stored(players), players, 'alice', NOW).checkForfeits).toBe(true);
    expect(planTicks(stored(players), players, 'bob', NOW).checkForfeits).toBe(false);
    const game = { ...stored(players), forfeited: [1] };
    expect(planTicks(game, players, 'alice', NOW).checkForfeits).toBe(false);
  });
});

describe('compte supprimé en pleine partie', () => {
  it('demande au serveur de le déclarer forfait', () => {
    const participants = [person(0, 'alice'), { ...person(1, 'bob'), userId: null }];
    expect(planTicks(stored(participants), participants, 'alice', NOW).checkForfeits).toBe(true);
  });
});
