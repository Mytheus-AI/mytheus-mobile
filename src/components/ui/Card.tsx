import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { cardShadow, radii, useTheme } from '@/theme';
import { CaretRight } from '@/components/Icon';

/** A white card on the stage (`rounded-card`, warm shadow, hairline in dark mode). */
export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const p = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: p.surface,
          borderRadius: radii.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: p.line,
          padding: padded ? 16 : 0,
          overflow: 'hidden',
        },
        cardShadow(p),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A row in a card list: hairline between rows, a chevron when it opens something. */
export function Row({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  first,
  chevron = !!onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  first?: boolean;
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useTheme();
  const body = (
    <View style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.line }, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {chevron ? <CaretRight size={16} color={p.ink4} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => pressed && { backgroundColor: p.surface2 }}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
});
