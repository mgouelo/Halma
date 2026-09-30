import { describe, expect, it, jest } from '@jest/globals';

import { createDailyLoginTracker } from '../daily-login';

describe('connexion du jour', () => {
  it('n’appelle le serveur qu’une fois par jour de Paris', async () => {
    let now = new Date('2026-10-01T08:00:00Z');
    const record = jest.fn(async () => undefined);
    const tracker = createDailyLoginTracker(record, () => now);
    await expect(tracker.check()).resolves.toBe(true);
    await expect(tracker.check()).resolves.toBe(false);
    now = new Date('2026-10-01T21:59:00Z'); // 23 h 59 à Paris
    await expect(tracker.check()).resolves.toBe(false);
    now = new Date('2026-10-01T22:01:00Z'); // minuit passé à Paris
    await expect(tracker.check()).resolves.toBe(true);
    expect(record).toHaveBeenCalledTimes(2);
  });

  it('n’envoie qu’une demande pour deux appels simultanés', async () => {
    const record = jest.fn(async () => undefined);
    const tracker = createDailyLoginTracker(record, () => new Date('2026-10-01T08:00:00Z'));
    await Promise.all([tracker.check(), tracker.check()]);
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('ne lève jamais hors ligne, et réessaie au prochain appel', async () => {
    const record = jest.fn<() => Promise<unknown>>().mockRejectedValueOnce(new TypeError('Network request failed'));
    record.mockResolvedValue(undefined);
    const tracker = createDailyLoginTracker(record, () => new Date('2026-10-01T08:00:00Z'));
    await expect(tracker.check()).resolves.toBe(false);
    await expect(tracker.check()).resolves.toBe(true);
    expect(record).toHaveBeenCalledTimes(2);
  });
});
