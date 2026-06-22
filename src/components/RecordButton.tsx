import React from 'react';
import { Pressable, View } from 'react-native';
import { colors, shadows } from '@/theme/tokens';
import { Mic } from './icons';
import PulseRing from './PulseRing';

interface RecordButtonProps {
  size?: number;
  onPress?: () => void;
  /** Whether the radar rings are animating. */
  pulsing?: boolean;
}

/** Large circular mic button with an inner accent ring and radar pulses. */
export default function RecordButton({
  size = 128,
  onPress,
  pulsing = true,
}: RecordButtonProps) {
  return (
    <PulseRing size={size} color={colors.dark} rings={2} active={pulsing}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Start listening"
        style={{
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: colors.dark,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.darkButton,
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 7,
            left: 7,
            right: 7,
            bottom: 7,
            borderRadius: size,
            borderWidth: 2,
            borderColor: 'rgba(217,119,87,0.65)',
          }}
        />
        <Mic size={Math.round(size * 0.27)} color={colors.white} />
      </Pressable>
    </PulseRing>
  );
}
