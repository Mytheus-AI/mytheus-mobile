import React from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { radii, sans, size, useTheme } from '@/theme';
import { T } from './ui/Text';

/** A labelled text input. The label is visible and is the input's accessible name. */
export function Field({ label, multiline, style, ...rest }: TextInputProps & { label: string }) {
  const p = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="label" nativeID={`label-${label}`}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        aria-labelledby={`label-${label}`}
        placeholderTextColor={p.ink4}
        selectionColor={p.signal}
        multiline={multiline}
        {...rest}
        style={[
          {
            minHeight: multiline ? 96 : 48,
            borderRadius: radii.ctl,
            borderWidth: 1,
            borderColor: p.line2,
            backgroundColor: p.surface,
            color: p.ink,
            paddingHorizontal: 14,
            paddingVertical: multiline ? 12 : 10,
            fontFamily: sans('400'),
            fontSize: size.body,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
      />
    </View>
  );
}
