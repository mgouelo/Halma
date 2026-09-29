import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Stroke, Typography } from '@/constants/theme';

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
}

/** Sélecteur de nombre avec boutons − et +. */
export function Stepper({ value, min, max, onChange, accessibilityLabel }: StepperProps) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) =>
        onChange(event.nativeEvent.actionName === 'increment' ? Math.min(max, value + 1) : Math.max(min, value - 1))
      }>
      <StepButton label="−" disabled={value <= min} onPress={() => onChange(value - 1)} />
      <Text style={[Typography.title, styles.value]}>{value}</Text>
      <StepButton label="+" disabled={value >= max} onPress={() => onChange(value + 1)} />
    </View>
  );
}

function StepButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label === '+' ? 'Plus' : 'Moins'}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={Typography.title}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: Radius.round,
    borderWidth: Stroke.bold,
    borderColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paper,
  },
  disabled: {
    opacity: 0.3,
  },
  pressed: {
    backgroundColor: Colors.line,
  },
  value: {
    minWidth: 28,
    textAlign: 'center',
  },
});
