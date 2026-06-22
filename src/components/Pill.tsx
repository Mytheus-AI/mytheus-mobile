import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radii } from '@/theme/tokens';
import { sans } from '@/theme/typography';

interface PillProps {
  label: string;
  bg: string;
  color: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

/** Small rounded chip used for tags, owners, and status. */
export default function Pill({ label, bg, color, icon, style }: PillProps) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {icon}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radii.chip,
  },
  label: {
    fontFamily: sans('700'),
    fontSize: 11,
    letterSpacing: 0.1,
  },
});

export { colors };
