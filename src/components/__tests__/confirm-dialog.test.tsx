import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Modal } from 'react-native';

import { ConfirmDialog } from '../confirm-dialog';

function renderDialog(visible = true) {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  render(
    <ConfirmDialog
      visible={visible}
      title="Quitter la partie ?"
      message="La partie en cours sera perdue."
      cancelLabel="Continuer la partie"
      confirmLabel="Quitter"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />,
  );
  return { onCancel, onConfirm };
}

describe('fenêtre de confirmation', () => {
  it('affiche le titre, le message et deux boutons clairement libellés', () => {
    renderDialog();
    expect(screen.getByRole('header', { name: 'Quitter la partie ?' })).toBeTruthy();
    expect(screen.getByText('La partie en cours sera perdue.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer la partie' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quitter' })).toBeTruthy();
  });

  it('chaque bouton appelle son action', () => {
    const { onCancel, onConfirm } = renderDialog();
    fireEvent.press(screen.getByRole('button', { name: 'Continuer la partie' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Quitter' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Échap (web) et le bouton retour d’Android ferment sans rien faire', () => {
    const { onCancel, onConfirm } = renderDialog();
    screen.UNSAFE_getByType(Modal).props.onRequestClose();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('isole le reste de l’écran pour les lecteurs d’écran', () => {
    renderDialog();
    const dialog = screen.getByLabelText('Quitter la partie ?');
    expect(dialog.props.accessibilityViewIsModal).toBe(true);
    expect(dialog.props.role).toBe('alertdialog');
  });

  it('n’affiche rien quand elle est fermée', () => {
    renderDialog(false);
    expect(screen.queryByText('Quitter la partie ?')).toBeNull();
  });

  it('propose un troisième choix facultatif', () => {
    const onExtra = jest.fn();
    render(
      <ConfirmDialog
        visible
        title="Se déconnecter ?"
        message="Message."
        cancelLabel="Annuler"
        extraLabel="Créer mon compte"
        confirmLabel="Se déconnecter"
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        onExtra={onExtra}
      />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(onExtra).toHaveBeenCalledTimes(1);
  });

  it('n’affiche pas de troisième bouton sans libellé', () => {
    renderDialog();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
