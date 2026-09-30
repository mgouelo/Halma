import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, Radius, Spacing, Stroke, Typography } from '@/constants/theme';

interface DrawnTextInputProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
}

/** Champ de saisie au trait noir, avec libellé, aide et message d'erreur. */
export function DrawnTextInput({ label, error, hint, style, onFocus, onBlur, ...props }: DrawnTextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={Typography.heading}>{label}</Text>
      <TextInput
        {...props}
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
        style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : null, style]}
      />
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
  inputFocused: {
    borderWidth: Stroke.bold,
  },
  inputError: {
    borderStyle: 'dashed',
  },
  error: {
    color: Colors.ink,
    fontWeight: '700',
  },
});
