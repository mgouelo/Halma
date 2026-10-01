import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { createGame } from '@/game';

import { Board } from '../board';
import { computeBoardLayout } from '../layout';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('@/hooks/__test-utils__/reanimated'));

const layout = computeBoardLayout(400);

function touch(zone: ReturnType<typeof screen.getByLabelText>, x: number, y: number, releaseAt = { x, y }) {
  fireEvent(zone, 'responderGrant', { nativeEvent: { locationX: x, locationY: y } });
  fireEvent(zone, 'responderRelease', { nativeEvent: { locationX: releaseAt.x, locationY: releaseAt.y } });
}

describe('plateau : une seule zone tactile', () => {
  it('transmet la case touchée', () => {
    const onCellPress = jest.fn();
    render(<Board game={createGame(2)} layout={layout} onCellPress={onCellPress} />);
    const zone = screen.getByLabelText('Plateau de jeu');
    const { x, y } = layout.toPoint({ q: 4, r: -5 });
    touch(zone, x + 3, y - 2);
    expect(onCellPress).toHaveBeenCalledTimes(1);
    expect(onCellPress).toHaveBeenCalledWith({ q: 4, r: -5 });
  });

  it('ignore une touche hors des cases et un doigt qui a glissé', () => {
    const onCellPress = jest.fn();
    render(<Board game={createGame(2)} layout={layout} onCellPress={onCellPress} />);
    const zone = screen.getByLabelText('Plateau de jeu');
    touch(zone, 2, 2);
    const { x, y } = layout.toPoint({ q: 0, r: 0 });
    touch(zone, x, y, { x, y: y + 60 });
    expect(onCellPress).not.toHaveBeenCalled();
  });

  it('n’affiche pas de zone tactile quand le plateau est en lecture seule (accueil)', () => {
    render(<Board game={createGame(2)} layout={layout} />);
    expect(screen.queryByLabelText('Plateau de jeu')).toBeNull();
  });
});
