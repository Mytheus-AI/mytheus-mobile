import React from 'react';
import { Pressable } from 'react-native';
import { colors, radii } from '@/theme/tokens';
import { Check } from './icons';

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
}

/** Square check toggle for action items. Fills with the accent when checked. */
export default function Checkbox({ checked, onToggle }: CheckboxProps) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{
        width: 22,
        height: 22,
        borderRadius: radii.checkbox,
        borderWidth: 1.8,
        borderColor: checked ? colors.accent : colors.checkboxBorder,
        backgroundColor: checked ? colors.accent : colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <Check size={11} color={colors.white} /> : null}
    </Pressable>
  );
}
