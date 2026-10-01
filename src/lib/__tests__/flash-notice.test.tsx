import { afterEach, describe, expect, it } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { getFlashNotice, setFlashNotice, useFlashNotice } from '../flash-notice';

afterEach(() => setFlashNotice(null));

describe('message à usage unique', () => {
  it('est lu par l’écran suivant, puis fermé', () => {
    const { result } = renderHook(() => useFlashNotice());
    expect(result.current.message).toBeNull();

    act(() => setFlashNotice('L’hôte a fermé la room.'));
    expect(result.current.message).toBe('L’hôte a fermé la room.');

    act(() => result.current.dismiss());
    expect(result.current.message).toBeNull();
    expect(getFlashNotice()).toBeNull();
  });

  it('est déjà là quand l’écran s’affiche après coup', () => {
    setFlashNotice('Cette room a été fermée.');
    const { result } = renderHook(() => useFlashNotice());
    expect(result.current.message).toBe('Cette room a été fermée.');
  });
});
