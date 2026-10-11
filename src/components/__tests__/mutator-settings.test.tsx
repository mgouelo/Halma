import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DEFAULT_MUTATORS } from '@/mutators/mutators';

import { MutatorBadges, MutatorSettings } from '../mutator-settings';

describe('MutatorSettings', () => {
  it('l’hôte (ou l’écran de réglage) bascule chaque mutateur, état lu et écrit', () => {
    const onChange = jest.fn();
    render(<MutatorSettings value={DEFAULT_MUTATORS} onChange={onChange} />);
    const touch = screen.getByRole('switch', { name: 'Toucher c’est jouer' });
    expect(touch.props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByRole('switch', { name: 'Clairvoyance' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByText('Désactivé')).toBeTruthy();
    expect(screen.getByText('Activé')).toBeTruthy();

    fireEvent.press(touch);
    expect(onChange).toHaveBeenCalledWith('touchMove', true);
    fireEvent.press(screen.getByRole('switch', { name: 'Clairvoyance' }));
    expect(onChange).toHaveBeenCalledWith('clairvoyance', false);
  });

  it('ne réagit pas pendant un envoi', () => {
    const onChange = jest.fn();
    render(<MutatorSettings value={DEFAULT_MUTATORS} onChange={onChange} disabled />);
    fireEvent.press(screen.getByRole('switch', { name: 'Clairvoyance' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('en lecture seule (autres joueurs) : aucun interrupteur, l’état est lu', () => {
    render(<MutatorSettings value={{ touchMove: true, clairvoyance: false }} />);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.getByLabelText(/^Toucher c’est jouer : activé/)).toBeTruthy();
    expect(screen.getByLabelText(/^Clairvoyance : désactivé/)).toBeTruthy();
  });
});

describe('MutatorBadges', () => {
  it('montre les mutateurs actifs, rien s’il n’y en a aucun', () => {
    const { rerender } = render(<MutatorBadges value={{ touchMove: true, clairvoyance: true }} />);
    expect(screen.getByText('Toucher c’est jouer')).toBeTruthy();
    expect(screen.getByText('Clairvoyance')).toBeTruthy();
    rerender(<MutatorBadges value={{ touchMove: false, clairvoyance: false }} />);
    expect(screen.queryByText('Clairvoyance')).toBeNull();
  });
});
