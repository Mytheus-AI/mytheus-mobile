import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, sans, TOUCH, useTheme } from '@/theme';
import { T } from './Text';
import type { IconType } from '@/components/Icon';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'signal';

/**
 * Every primary control. Says exactly what happens ("Confirm decision", "Join meeting"); the
 * toast that follows uses the same verb.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  busy,
  disabled,
  small,
  full,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconType;
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
  full?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useTheme();
  const look = {
    primary: { bg: p.pill, pressed: p.pill2, fg: p.pillOn, border: 'transparent' },
    signal: { bg: p.signal, pressed: p.signalInk, fg: '#ffffff', border: 'transparent' },
    outline: { bg: p.surface, pressed: p.surface2, fg: p.ink, border: p.line2 },
    ghost: { bg: 'transparent', pressed: p.bg2, fg: p.ink2, border: 'transparent' },
    danger: { bg: p.highSoft, pressed: p.highSoft, fg: p.high, border: 'transparent' },
  }[variant];
  const off = disabled || busy;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      hitSlop={small ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: small ? 36 : TOUCH,
          paddingHorizontal: small ? 12 : 18,
          backgroundColor: pressed ? look.pressed : look.bg,
          borderColor: look.border,
          opacity: disabled ? 0.45 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      <View style={styles.inner}>
        {busy ? (
          <ActivityIndicator size="small" color={look.fg} />
        ) : Icon ? (
          <Icon size={small ? 16 : 18} color={look.fg} />
        ) : null}
        <T
          variant="body"
          style={{ color: look.fg, fontFamily: sans('600'), fontSize: small ? 14 : 15 }}
          numberOfLines={1}
          maxFontSizeMultiplier={1.6}
        >
          {label}
        </T>
      </View>
    </Pressable>
  );
}

/** A round icon-only control (back, close). Always carries a label for screen readers. */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  tone = 'plain',
  size = TOUCH,
}: {
  icon: IconType;
  label: string;
  onPress: () => void;
  tone?: 'plain' | 'card' | 'dark' | 'danger' | 'active';
  size?: number;
}) {
  const p = useTheme();
  const look = {
    plain: { bg: 'transparent', fg: p.ink2 },
    card: { bg: p.surface, fg: p.ink2 },
    dark: { bg: p.pill, fg: p.pillOn },
    danger: { bg: p.high, fg: '#ffffff' },
    active: { bg: p.signalSoft, fg: p.signalInk },
  }[tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: look.bg,
        borderWidth: tone === 'card' ? StyleSheet.hairlineWidth : 0,
        borderColor: p.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon size={20} color={look.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.ctl,
    borderWidth: 1,
    justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
