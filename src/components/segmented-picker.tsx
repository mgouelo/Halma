import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Stroke, TouchTarget, Typography } from '@/constants/theme';

interface SegmentedPickerProps<T extends string> {
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
  /** Couleur du segment choisi. */
  color?: string;
  accessibilityLabel?: string;
}

/** Choix exclusif entre quelques options, au trait noir. */
export function SegmentedPicker<T extends string>({
  options,
  labels,
  value,
  onChange,
  color = Colors.ink,
  accessibilityLabel,
}: SegmentedPickerProps<T>) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option, index) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={labels[option]}
            style={[styles.segment, index > 0 && styles.separator, selected && { backgroundColor: color }]}>
            <Text style={[Typography.caption, styles.label, selected && styles.labelSelected]}>{labels[option]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    borderRadius: Radius.round,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.two,
    backgroundColor: Colors.paper,
  },
  separator: {
    borderLeftWidth: Stroke.regular,
    borderLeftColor: Colors.ink,
  },
  label: {
    color: Colors.ink,
  },
  labelSelected: {
    fontWeight: '800',
  },
});
