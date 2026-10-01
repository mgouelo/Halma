import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { router } from 'expo-router';

import { backFallback, goBack } from '../back';

jest.mock('expo-router', () => ({ router: { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const mockRouter = router as unknown as {
  canGoBack: jest.Mock<() => boolean>;
  back: jest.Mock;
  replace: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('retour des écrans sans barre', () => {
  it('revient à l’écran précédent quand il y a un historique', () => {
    mockRouter.canGoBack.mockReturnValue(true);
    goBack('/profile');
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('utilise l’écran de secours sans historique (page rechargée, lien direct)', () => {
    mockRouter.canGoBack.mockReturnValue(false);
    goBack('/profile');
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/profile');
    goBack();
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/');
  });

  it.each(['/avatar', '/sign-in', '/sign-up', '/upgrade', '/credits', '/privacy', '/terms', '/terms/'])(
    'le secours de %s est le profil',
    (path) => {
      expect(backFallback(path)).toBe('/profile');
    },
  );

  it.each(['/', '/online', '/leaderboard', '/inconnu'])('le secours de %s est l’accueil', (path) => {
    expect(backFallback(path)).toBe('/');
  });
});
