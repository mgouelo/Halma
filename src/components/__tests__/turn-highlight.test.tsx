// Barre des joueurs (tour mis en évidence) et icônes des statistiques : ce qui est lu et écrit,
// pas seulement la couleur.

import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { PlayersBar, type PlayersBarEntry } from '../players-bar';
import { BestFlameIcon, FlameIcon, StartFlagIcon, TrophyIcon } from '../stat-icons';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('@/hooks/__test-utils__/reanimated'));

const entry = (player: number, current: boolean): PlayersBarEntry => ({
  player,
  label: `Joueur${player}`,
  detail: current ? 'joue' : undefined,
  turn: current ? 'active' : 'waiting',
  accessibilityLabel: `Joueur${player}`,
});

describe('barre des joueurs', () => {
  it('écrit le nom de chaque joueur jusqu’à trois, et « joue » pour celui dont c’est le tour', () => {
    render(<PlayersBar entries={[entry(0, false), entry(1, true)]} />);
    expect(screen.getByText('Joueur0')).toBeTruthy();
    expect(screen.getByText('Joueur1')).toBeTruthy();
    expect(screen.getByText('joue')).toBeTruthy();
  });

  it('à plus de trois joueurs, seul celui dont c’est le tour garde son nom (une seule ligne, hauteur fixe)', () => {
    render(<PlayersBar entries={[0, 1, 2, 3, 4, 5].map((p) => entry(p, p === 2))} />);
    expect(screen.getByText('Joueur2')).toBeTruthy();
    expect(screen.queryByText('Joueur0')).toBeNull();
    expect(screen.queryByText('Joueur5')).toBeNull();
    expect(screen.getAllByLabelText(/^Joueur\d$/)).toHaveLength(6);
  });
});

describe('icônes des statistiques', () => {
  it('sont masquées aux lecteurs d’écran', () => {
    for (const Icon of [TrophyIcon, StartFlagIcon, FlameIcon, BestFlameIcon]) {
      const { toJSON, unmount } = render(<Icon size={30} />);
      const root = toJSON() as { props: Record<string, unknown> };
      expect(root.props.accessibilityElementsHidden).toBe(true);
      expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
      unmount();
    }
  });
});
