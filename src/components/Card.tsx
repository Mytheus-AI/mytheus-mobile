import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radii, shadows } from '@/theme/tokens';
import { sans } from '@/theme/typography';

/** White rounded surface with the standard soft card shadow. */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** A small colored dot + uppercase label used as a section header inside cards. */
export function SectionLabel({ dot, label }: { dot: string; label: string }) {
  return (
    <View style={styles.labelRow}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 16,
    paddingHorizontal: 17,
    ...shadows.card,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 7 },
  label: {
    fontFamily: sans('800'),
    fontSize: 10.5,
    letterSpacing: 1,
    color: colors.mutedLabel,
  },
});
