import React from 'react';
import { Text } from 'react-native';
import { useTheme, wordmark } from '@/theme';

/** The Mytheus wordmark, set in Fraunces as on the web. */
export function Wordmark({ size = 24 }: { size?: number }) {
  const p = useTheme();
  return (
    <Text accessibilityRole="header" style={{ fontFamily: wordmark(), fontSize: size, color: p.ink, letterSpacing: -0.4 }}>
      Mytheus
    </Text>
  );
}
