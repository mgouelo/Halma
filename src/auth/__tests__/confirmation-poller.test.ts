import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createConfirmationPoller } from '../confirmation-poller';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

/** Laisse s'exécuter les promesses en attente. */
const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

describe('détection de la validation', () => {
  it('relit le compte à intervalle régulier jusqu’à la validation, puis s’arrête', async () => {
    const answers = [false, false, true];
    const check = jest.fn(async () => answers.shift() ?? true);
    const onConfirmed = jest.fn();
    const poller = createConfirmationPoller({ check, onConfirmed, intervalMs: 5000 });
    poller.start();
    expect(check).not.toHaveBeenCalled();

    for (let i = 0; i < 3; i += 1) {
      jest.advanceTimersByTime(5000);
      await flush();
    }
    expect(check).toHaveBeenCalledTimes(3);
    expect(onConfirmed).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60_000);
    await flush();
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('vérifie tout de suite au retour au premier plan', async () => {
    const check = jest.fn(async () => true);
    const onConfirmed = jest.fn();
    const poller = createConfirmationPoller({ check, onConfirmed, intervalMs: 15_000 });
    poller.start();
    poller.poke();
    await flush();
    expect(check).toHaveBeenCalledTimes(1);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('ignore une erreur (réseau) et réessaie plus tard', async () => {
    const check = jest
      .fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValue(true);
    const onConfirmed = jest.fn();
    createConfirmationPoller({ check, onConfirmed, intervalMs: 1000 }).start();
    jest.advanceTimersByTime(1000);
    await flush();
    expect(onConfirmed).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await flush();
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('ne lance pas deux vérifications à la fois', async () => {
    let resolve: (value: boolean) => void = () => {};
    const check = jest.fn(() => new Promise<boolean>((r) => (resolve = r)));
    const poller = createConfirmationPoller({ check, onConfirmed: jest.fn(), intervalMs: 1000 });
    poller.start();
    poller.poke();
    poller.poke();
    jest.advanceTimersByTime(5000);
    expect(check).toHaveBeenCalledTimes(1);
    resolve(false);
    await flush();
  });

  it('arrêté (écran quitté), il ne vérifie plus et n’annonce rien', async () => {
    const check = jest.fn(async () => true);
    const onConfirmed = jest.fn();
    const poller = createConfirmationPoller({ check, onConfirmed, intervalMs: 1000 });
    poller.start();
    poller.stop();
    poller.poke();
    jest.advanceTimersByTime(10_000);
    await flush();
    expect(check).not.toHaveBeenCalled();
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});
