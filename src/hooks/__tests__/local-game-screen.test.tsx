// Écran de partie locale, avec le vrai routeur : confirmation avant de quitter
// ou de recommencer une partie en cours, et partie supprimée quand on quitte.

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen, act } from 'expo-router/testing-library';
import { Text } from 'react-native';

// Plateau réduit à deux boutons : sélectionner un pion jouable, puis jouer son premier coup.
jest.mock('@/components/board/board', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Board: require('../__test-utils__/fake-board').FakeBoard,
}));

// Le plateau n'est dessiné qu'une fois sa zone mesurée.
jest.mock('@/hooks/use-measured-size', () => ({
  useMeasuredSize: () => ({ width: 400, height: 400, onLayout: () => {} }),
}));

// Pas de compte : la partie locale n'en a pas besoin.
jest.mock('@/auth/auth-context', () => ({ useAuth: () => ({ session: null, profile: null }) }));

jest.mock('@/components/victory-overlay', () => ({ VictoryOverlay: () => null }));

// expo-router/testing-library remplace déjà Reanimated, par un module vide ici
// (sa maquette officielle ne se charge pas sans module natif) : on complète ce
// module, déjà en cache, avec le remplaçant minimal des tests.
// eslint-disable-next-line @typescript-eslint/no-require-imports
Object.assign(require('react-native-reanimated'), require('../__test-utils__/reanimated'), { __esModule: true });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const GameScreen = require('@/app/game').default;

function Home() {
  return <Text>Accueil de test</Text>;
}

function start(url = '/game') {
  const router = renderRouter({ index: Home, game: GameScreen }, { initialUrl: '/' });
  goTo(url);
  return router;
}

function goTo(url: string) {
  act(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-router').router.push(url);
  });
}

function playOneMove() {
  fireEvent.press(screen.getByText('Choisir un pion'));
  fireEvent.press(screen.getByText('Jouer le coup'));
}

afterEach(() => {
  jest.clearAllTimers();
});

describe('partie locale : quitter et recommencer', () => {
  it('quitte sans rien demander avant le premier coup', () => {
    const router = start();
    expect(router.getPathname()).toBe('/game');
    expect(screen.getByText('Coup 1')).toBeTruthy();
    fireEvent.press(screen.getByText('‹ Accueil'));
    expect(screen.queryByText('Quitter la partie ?')).toBeNull();
    expect(router.getPathname()).toBe('/');
  });

  it('demande confirmation pour quitter une partie en cours, et « Continuer la partie » ne change rien', () => {
    const router = start();
    playOneMove();
    expect(screen.getByText('Coup 2')).toBeTruthy();

    fireEvent.press(screen.getByText('‹ Accueil'));
    expect(screen.getByText('Quitter la partie ?')).toBeTruthy();
    expect(router.getPathname()).toBe('/game');
    fireEvent.press(screen.getByText('Continuer la partie'));
    expect(screen.queryByText('Quitter la partie ?')).toBeNull();
    expect(screen.getByText('Coup 2')).toBeTruthy();
    expect(router.getPathname()).toBe('/game');
  });

  it('le retour en arrière (geste, bouton Android, navigateur) passe aussi par la confirmation', () => {
    const router = start();
    playOneMove();
    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('expo-router').router.back();
    });
    expect(screen.getByText('Quitter la partie ?')).toBeTruthy();
    expect(screen.getByText('Coup 2')).toBeTruthy();
    expect(router.getPathname()).toBe('/game');
  });

  it('« Quitter » supprime la partie : en revenant, elle repart de zéro', () => {
    const router = start();
    playOneMove();
    fireEvent.press(screen.getByText('‹ Accueil'));
    fireEvent.press(screen.getByText('Quitter'));
    expect(router.getPathname()).toBe('/');
    // L'écran de jeu est démonté : il ne reste rien de la partie.
    expect(screen.queryByText('Coup 2')).toBeNull();
    expect(screen.queryByText('Nouvelle partie')).toBeNull();

    goTo('/game');
    expect(screen.getByText('Coup 1')).toBeTruthy();
    expect(screen.queryByText('Coup 2')).toBeNull();
  });

  it('« Nouvelle partie » : directe avant le premier coup, confirmée ensuite', () => {
    start('/game?players=4');
    fireEvent.press(screen.getByText('Nouvelle partie'));
    expect(screen.queryByText('Nouvelle partie ?')).toBeNull();

    playOneMove();
    fireEvent.press(screen.getByText('Nouvelle partie'));
    expect(screen.getByText('Nouvelle partie ?')).toBeTruthy();
    fireEvent.press(screen.getByText('Continuer la partie'));
    expect(screen.getByText('Coup 2')).toBeTruthy();

    fireEvent.press(screen.getByText('Nouvelle partie'));
    fireEvent.press(screen.getByText('Recommencer'));
    expect(screen.getByText('Coup 1')).toBeTruthy();
    expect(screen.queryByText('Nouvelle partie ?')).toBeNull();
  });

  it('partie à 4 joueurs : le tour passe au joueur suivant, dans l’ordre du moteur', () => {
    start('/game?players=4');
    expect(screen.getByText('Rose')).toBeTruthy();
    playOneMove();
    expect(screen.getByText('Bleu')).toBeTruthy();
  });
});
