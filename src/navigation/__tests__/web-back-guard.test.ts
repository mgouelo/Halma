import { afterEach, describe, expect, it, jest } from '@jest/globals';

type Listener = (event: { stopImmediatePropagation: () => void }) => void;

/** Charge le module comme sur le web, avec une fausse fenêtre. */
function loadOnWeb() {
  const listeners: Listener[] = [];
  const go = jest.fn();
  (globalThis as { window?: unknown }).window = {
    addEventListener: (type: string, listener: Listener, capture: boolean) => {
      expect(type).toBe('popstate');
      expect(capture).toBe(true);
      listeners.push(listener);
    },
    history: { go },
  };
  let setWebBackGuard!: typeof import('../web-back-guard').setWebBackGuard;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ setWebBackGuard } = require('../web-back-guard'));
  });
  const popState = () => {
    const event = { stopImmediatePropagation: jest.fn() };
    listeners.forEach((listener) => listener(event));
    return event;
  };
  return { setWebBackGuard, popState, go, listeners };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  jest.dontMock('react-native');
});

describe('retour du navigateur pendant une partie locale (web)', () => {
  it('sans garde, le routeur gère le retour normalement', () => {
    const { popState, go, listeners } = loadOnWeb();
    expect(listeners).toHaveLength(1);
    const event = popState();
    expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it('avec une garde : le retour est annulé, caché au routeur, et la garde demande confirmation', () => {
    const { setWebBackGuard, popState, go } = loadOnWeb();
    const guard = jest.fn();
    setWebBackGuard(guard);

    const back = popState();
    expect(back.stopImmediatePropagation).toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith(1);
    expect(guard).toHaveBeenCalledTimes(1);

    // Le « popstate » du retour à l'adresse de la partie est aussi caché au routeur.
    const restore = popState();
    expect(restore.stopImmediatePropagation).toHaveBeenCalled();
    expect(guard).toHaveBeenCalledTimes(1);
  });

  it('une fois la garde retirée (partie finie, départ confirmé), le retour passe', () => {
    const { setWebBackGuard, popState, go } = loadOnWeb();
    const guard = jest.fn();
    const remove = setWebBackGuard(guard);
    remove();
    const event = popState();
    expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
    expect(guard).not.toHaveBeenCalled();
  });

  it('retirer une ancienne garde ne retire pas la nouvelle', () => {
    const { setWebBackGuard, popState } = loadOnWeb();
    const first = jest.fn();
    const second = jest.fn();
    const removeFirst = setWebBackGuard(first);
    setWebBackGuard(second);
    removeFirst();
    popState();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
