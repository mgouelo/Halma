// Mise en évidence du tour et icônes des statistiques : ce qui est lu et écrit,
// pas seulement la couleur.

import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { TurnStatus } from '../game-layout';
import { PlayerChip } from '../player-chip';
import { BestFlameIcon, FlameIcon, StartFlagIcon, TrophyIcon } from '../stat-icons';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('@/hooks/__test-utils__/reanimated'));

describe('TurnStatus', () => {
  it('écrit « À toi de jouer ! » quand c’est ton tour', () => {
    render(<TurnStatus turnKey={1} hint="Touche un de tes pions." mine={{ color: '#F6B8C8' }} player={<PlayerChip player={0} label="Toi" turn="active" />} />);
    expect(screen.getByText('À toi de jouer !')).toBeTruthy();
    expect(screen.queryByText('En attente de')).toBeNull();
  });

  it('écrit « En attente de » suivi du joueur sinon', () => {
    render(<TurnStatus turnKey={1} hint="…" lead="En attente de" player={<PlayerChip player={1} label="Camille" turn="active" />} />);
    expect(screen.getByText('En attente de')).toBeTruthy();
    expect(screen.getByText('Camille')).toBeTruthy();
    expect(screen.queryByText('À toi de jouer !')).toBeNull();
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
