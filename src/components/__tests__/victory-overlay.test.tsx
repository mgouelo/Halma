import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('@/hooks/__test-utils__/reanimated'));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { VictoryOverlay } = require('../victory-overlay') as typeof import('../victory-overlay');

describe('écran de victoire entre amis', () => {
  it.each([
    [2, 'Menthe'],
    [3, 'Citron'],
    [4, 'Lavande'],
    [5, 'Pêche'],
  ])('annonce le vainqueur %i (%s) avec sa couleur', (winner, name) => {
    render(<VictoryOverlay winner={winner} title="Victoire !" moveCount={23} onReplay={() => {}} onHome={() => {}} />);
    expect(screen.getByText('Victoire !')).toBeTruthy();
    expect(screen.getByText(`${name} a rempli la branche d’en face en 23 coups.`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rejouer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accueil' })).toBeTruthy();
  });
});
