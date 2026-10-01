import { describe, expect, it } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';

import { useRetainedWhileHidden } from '../use-retained-while-hidden';

const restart = { title: 'Nouvelle partie ?', cancelLabel: 'Continuer la partie' };
const leave = { title: 'Quitter la partie ?', cancelLabel: 'Continuer la partie' };

type Props = { visible: boolean; value: typeof restart };

function setup(visible: boolean, value: typeof restart) {
  return renderHook<typeof restart, Props>((props) => useRetainedWhileHidden(props.visible, props.value), {
    initialProps: { visible, value },
  });
}

describe('contenu gardé pendant la fermeture d’une fenêtre', () => {
  it('renvoie la valeur courante tant que la fenêtre est visible', () => {
    const { result, rerender } = setup(true, restart);
    expect(result.current).toEqual(restart);
    rerender({ visible: true, value: leave });
    expect(result.current).toEqual(leave);
  });

  it('garde la dernière valeur affichée quand la fenêtre se ferme et que l’appelant change les textes', () => {
    // Bug corrigé : « Nouvelle partie ? » se fermait avec les textes de « Quitter la partie ? ».
    const { result, rerender } = setup(true, restart);
    rerender({ visible: false, value: leave });
    expect(result.current).toEqual(restart);
  });

  it('reprend les nouveaux textes à la réouverture', () => {
    const { result, rerender } = setup(true, restart);
    rerender({ visible: false, value: leave });
    rerender({ visible: true, value: leave });
    expect(result.current).toEqual(leave);
  });
});
