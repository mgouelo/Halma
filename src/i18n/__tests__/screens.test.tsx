// Écrans clés rendus dans les quatre langues : accueil, partie locale, écran de
// victoire, sélecteur de langue (changement appliqué tout de suite).

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { applyLanguage, LANGUAGE_STORAGE_KEY, resetLanguageForTests } from '../language';
import type { Language } from '../types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('@/hooks/__test-utils__/reanimated'));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), back: jest.fn() },
  usePathname: () => '/',
  useLocalSearchParams: () => ({}),
}));
// Pas de compte : accueil d'un joueur hors ligne, sans serveur configuré.
jest.mock('@/auth/auth-context', () => ({
  useAuth: () => ({ configured: false, loading: false, session: null, profile: null, isGuest: false }),
}));
jest.mock('@/components/board/board', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Board: require('@/hooks/__test-utils__/fake-board').FakeBoard,
}));
jest.mock('@/hooks/use-measured-size', () => ({
  useMeasuredSize: () => ({ width: 360, height: 400, onLayout: () => {} }),
}));
jest.mock('@/hooks/use-is-client', () => ({ useIsClient: () => true }));
// La garde de sortie a besoin du vrai routeur (testée dans local-game-screen.test.tsx).
jest.mock('@/hooks/use-leave-guard', () => ({
  useLeaveGuard: () => ({ kind: null, cancel: () => {}, confirm: () => {}, requestRestart: () => {} }),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const HomeScreen = require('@/app/(main)/index').default as () => React.JSX.Element;
const GameScreen = require('@/app/game').default as () => React.JSX.Element;
const { VictoryOverlay } = require('@/components/victory-overlay') as typeof import('@/components/victory-overlay');
const { LanguagePicker } = require('@/components/language-picker') as typeof import('@/components/language-picker');
/* eslint-enable @typescript-eslint/no-require-imports */

afterEach(async () => {
  resetLanguageForTests('fr');
  await AsyncStorage.clear();
});

function inLanguage(language: Language) {
  act(() => applyLanguage(language));
}

describe('accueil', () => {
  it.each([
    ['fr', 'Dames chinoises', 'Jouer en ligne', 'Contre l’IA', 'Entre amis'],
    ['en', 'Chinese checkers', 'Play online', 'Against the AI', 'With friends'],
    ['de', 'Sternhalma', 'Online spielen', 'Gegen die KI', 'Mit Freunden'],
    ['es', 'Damas chinas', 'Jugar en línea', 'Contra la IA', 'Con amigos'],
  ] as [Language, string, string, string, string][])('en %s', (language, tagline, online, vsAi, friends) => {
    inLanguage(language);
    render(<HomeScreen />);
    expect(screen.getByText(tagline)).toBeTruthy();
    expect(screen.getByRole('button', { name: online })).toBeTruthy();
    expect(screen.getByRole('button', { name: vsAi })).toBeTruthy();
    expect(screen.getByRole('button', { name: friends })).toBeTruthy();
  });

  it('change de langue sans redémarrer : l’écran affiché suit tout de suite', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Hors ligne')).toBeTruthy();
    inLanguage('de');
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.queryByText('Hors ligne')).toBeNull();
    inLanguage('es');
    expect(screen.getByText('Sin conexión')).toBeTruthy();
  });
});

describe('partie locale', () => {
  it.each([
    ['en', 'Move 1', 'New game', 'Pink', 'Blue'],
    ['de', 'Zug 1', 'Neue Partie', 'Rosa', 'Blau'],
    ['es', 'Jugada 1', 'Nueva partida', 'Rosa', 'Azul'],
  ] as [Language, string, string, string, string][])('en %s : numéro du coup, bouton et couleurs des joueurs', (language, move, newGame, first, second) => {
    inLanguage(language);
    render(<GameScreen />);
    expect(screen.getByText(move)).toBeTruthy();
    expect(screen.getByRole('button', { name: newGame })).toBeTruthy();
    expect(screen.getByText(first)).toBeTruthy();
    expect(screen.getByText(second)).toBeTruthy();
  });

  it('en pleine partie, un changement de langue garde la partie et traduit l’écran', () => {
    render(<GameScreen />);
    fireEvent.press(screen.getByText('Choisir un pion'));
    fireEvent.press(screen.getByText('Jouer le coup'));
    expect(screen.getByText('Coup 2')).toBeTruthy();
    inLanguage('en');
    expect(screen.getByText('Move 2')).toBeTruthy();
  });
});

describe('écran de victoire', () => {
  it.each([
    ['en', 'Victory!', 'Mint filled the opposite point of the star in 23 moves.', 'Play again', 'Home'],
    ['de', 'Sieg!', 'Mint hat die gegenüberliegende Zacke in 23 Zügen gefüllt.', 'Nochmal spielen', 'Start'],
    ['es', '¡Victoria!', 'Menta ha llenado la punta de enfrente en 23 jugadas.', 'Volver a jugar', 'Inicio'],
  ] as [Language, string, string, string, string][])('en %s', (language, title, sentence, replay, home) => {
    inLanguage(language);
    render(<VictoryOverlay winner={2} title={title} moveCount={23} onReplay={() => {}} onHome={() => {}} />);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(sentence)).toBeTruthy();
    expect(screen.getByRole('button', { name: replay })).toBeTruthy();
    expect(screen.getByRole('button', { name: home })).toBeTruthy();
  });

  it('accorde le pluriel : un seul coup', () => {
    inLanguage('en');
    render(<VictoryOverlay winner={0} title="Victory!" winnerDetail="AI · Hard" moveCount={1} onHome={() => {}} />);
    expect(screen.getByText('Pink (AI · Hard) filled the opposite point of the star in 1 move.')).toBeTruthy();
  });
});

describe('sélecteur de langue', () => {
  it('chaque langue est écrite dans sa propre langue, la langue active est cochée', () => {
    render(<LanguagePicker />);
    for (const name of ['Français', 'English', 'Deutsch', 'Español']) {
      expect(screen.getByRole('radio', { name })).toBeTruthy();
    }
    expect(screen.getByRole('radio', { name: 'Français' }).props.accessibilityState).toMatchObject({ selected: true });
  });

  it('toucher une langue la choisit, l’enregistre et traduit tout de suite', async () => {
    render(
      <>
        <LanguagePicker />
        <Probe />
      </>,
    );
    expect(screen.getByText('Langue')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByRole('radio', { name: 'English' }));
    });
    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByText('Move 1')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'English' }).props.accessibilityState).toMatchObject({ selected: true });
    await expect(AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).resolves.toBe('en');
  });
});

/** Un autre composant de l'écran : il suit la langue lui aussi. */
function Probe() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useT } = require('@/i18n') as typeof import('@/i18n');
  const t = useT();
  return <Text>{t('game.move', { n: 1 })}</Text>;
}
