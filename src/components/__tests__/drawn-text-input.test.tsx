import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { TouchTarget } from '@/constants/theme';

import { DrawnTextInput, HIDE_PASSWORD_LABEL, SHOW_PASSWORD_LABEL } from '../drawn-text-input';

function renderPassword(props: Partial<React.ComponentProps<typeof DrawnTextInput>> = {}) {
  return render(
    <DrawnTextInput
      label="Mot de passe"
      value="secret123"
      onChangeText={() => {}}
      revealable
      autoComplete="current-password"
      textContentType="password"
      {...props}
    />,
  );
}

const field = () => screen.getByLabelText('Mot de passe');

describe('champ de mot de passe avec œil', () => {
  it('masque le mot de passe par défaut et propose de l’afficher', () => {
    renderPassword();
    expect(field().props.secureTextEntry).toBe(true);
    expect(screen.getByRole('button', { name: SHOW_PASSWORD_LABEL })).toBeTruthy();
  });

  it('affiche puis masque le mot de passe, avec un libellé qui suit l’état', () => {
    renderPassword();
    fireEvent.press(screen.getByRole('button', { name: SHOW_PASSWORD_LABEL }));
    expect(field().props.secureTextEntry).toBe(false);
    expect(screen.queryByRole('button', { name: SHOW_PASSWORD_LABEL })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: HIDE_PASSWORD_LABEL }));
    expect(field().props.secureTextEntry).toBe(true);
    expect(screen.getByRole('button', { name: SHOW_PASSWORD_LABEL })).toBeTruthy();
  });

  it('ne valide pas le formulaire, ne change pas la valeur et ne fait pas perdre le focus', () => {
    const onSubmitEditing = jest.fn();
    const onChangeText = jest.fn();
    const onBlur = jest.fn();
    renderPassword({ onSubmitEditing, onChangeText, onBlur });
    fireEvent(field(), 'focus');
    fireEvent.press(screen.getByRole('button', { name: SHOW_PASSWORD_LABEL }));
    expect(onSubmitEditing).not.toHaveBeenCalled();
    expect(onChangeText).not.toHaveBeenCalled();
    expect(onBlur).not.toHaveBeenCalled();
    expect(field().props.value).toBe('secret123');
  });

  it('garde les attributs de saisie automatique des gestionnaires de mots de passe', () => {
    renderPassword({ autoComplete: 'new-password', textContentType: 'newPassword' });
    expect(field().props.autoComplete).toBe('new-password');
    expect(field().props.textContentType).toBe('newPassword');
    fireEvent.press(screen.getByRole('button', { name: SHOW_PASSWORD_LABEL }));
    expect(field().props.autoComplete).toBe('new-password');
    expect(field().props.textContentType).toBe('newPassword');
  });

  it('a une zone touchable d’au moins 44 points', () => {
    renderPassword();
    const style = StyleSheet.flatten(screen.getByRole('button', { name: SHOW_PASSWORD_LABEL }).props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(TouchTarget).toBeGreaterThanOrEqual(44);
  });

  it('reste un champ ordinaire sans l’option : pas de bouton, `secureTextEntry` respecté', () => {
    render(<DrawnTextInput label="Pseudo" value="a" onChangeText={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Pseudo').props.secureTextEntry).toBeFalsy();
    render(<DrawnTextInput label="Code" value="a" onChangeText={() => {}} secureTextEntry />);
    expect(screen.getByLabelText('Code').props.secureTextEntry).toBe(true);
  });
});
