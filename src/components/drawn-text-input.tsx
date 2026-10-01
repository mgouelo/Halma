import { useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputProps,
  type TextInputSelectionChangeEventData,
} from 'react-native';

import { Colors, Fonts, Radius, Spacing, Stroke, TouchTarget, Typography } from '@/constants/theme';

import { EyeIcon } from './eye-icon';

interface DrawnTextInputProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  /**
   * Champ de mot de passe : masqué par défaut, avec à droite un bouton (œil)
   * pour l'afficher ou le masquer. Remplace `secureTextEntry`.
   */
  revealable?: boolean;
}

/** Libellés du bouton selon l'état du champ (l'action proposée, pas l'état actuel). */
export const SHOW_PASSWORD_LABEL = 'Afficher le mot de passe';
export const HIDE_PASSWORD_LABEL = 'Masquer le mot de passe';

/** Champ de saisie au trait noir, avec libellé, aide et message d'erreur. */
export function DrawnTextInput({
  label,
  error,
  hint,
  revealable = false,
  secureTextEntry,
  style,
  onFocus,
  onBlur,
  onSelectionChange,
  ...props
}: DrawnTextInputProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const input = useRef<TextInput>(null);
  const selection = useRef<{ start: number; end: number } | null>(null);

  const toggle = () => {
    const wasFocused = input.current?.isFocused() ?? false;
    const caret = selection.current;
    setHidden((value) => !value);
    // Changer de mode peut faire perdre le focus et la position du curseur (iOS, Android) : on les rétablit.
    if (wasFocused) {
      requestAnimationFrame(() => {
        input.current?.focus();
        if (caret) input.current?.setSelection?.(caret.start, caret.end);
      });
    }
  };

  const field = (
    <TextInput
      // Un mot de passe (affiché ou non) ne doit être ni corrigé, ni mis en majuscule, ni envoyé au correcteur.
      {...(revealable ? { autoCapitalize: 'none', autoCorrect: false, spellCheck: false } : null)}
      {...props}
      ref={input}
      secureTextEntry={revealable ? hidden : secureTextEntry}
      accessibilityLabel={label}
      accessibilityHint={error ?? hint}
      placeholderTextColor={Colors.inkSoft}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onSelectionChange={(event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        selection.current = event.nativeEvent.selection;
        onSelectionChange?.(event);
      }}
      style={[
        styles.input,
        focused && styles.inputFocused,
        error ? styles.inputError : null,
        revealable && styles.inputRevealable,
        style,
      ]}
    />
  );

  return (
    <View style={styles.field}>
      <Text style={Typography.heading}>{label}</Text>
      {revealable ? (
        <View>
          {field}
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel={hidden ? SHOW_PASSWORD_LABEL : HIDE_PASSWORD_LABEL}
            // Web : un clic sur le bouton ne doit pas retirer le focus du champ (ni déplacer le curseur).
            {...(Platform.OS === 'web' ? { onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault() } : null)}
            style={styles.toggle}>
            <EyeIcon size={26} open={hidden} />
          </Pressable>
        </View>
      ) : (
        field
      )}
      {error ? (
        <Text style={[Typography.caption, styles.error]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={Typography.caption}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  input: {
    ...Typography.body,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    borderRadius: Radius.small,
    backgroundColor: Colors.paper,
  },
  inputRevealable: {
    // Le texte ne passe pas sous le bouton.
    paddingRight: TouchTarget + Spacing.one,
  },
  inputFocused: {
    borderWidth: Stroke.bold,
  },
  inputError: {
    borderStyle: 'dashed',
  },
  toggle: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    minWidth: TouchTarget,
    minHeight: TouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: Colors.ink,
    fontFamily: Fonts.semibold,
  },
});
