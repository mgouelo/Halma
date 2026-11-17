import { afterEach, describe, expect, it } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { msg } from '@/i18n';

import { getFlashNotice, setFlashNotice, useFlashNotice } from '../flash-notice';

const hostClosed = msg('online.hostClosed');
const roomClosed = msg('online.roomClosed');

afterEach(() => setFlashNotice(null));

describe('message à usage unique', () => {
  it('est lu par l’écran suivant, puis fermé', () => {
    const { result } = renderHook(() => useFlashNotice());
    expect(result.current.message).toBeNull();

    act(() => setFlashNotice(hostClosed));
    expect(result.current.message).toBe(hostClosed);

    act(() => result.current.dismiss());
    expect(result.current.message).toBeNull();
    expect(getFlashNotice()).toBeNull();
  });

  it('est déjà là quand l’écran s’affiche après coup', () => {
    setFlashNotice(roomClosed);
    const { result } = renderHook(() => useFlashNotice());
    expect(result.current.message).toBe(roomClosed);
  });
});
