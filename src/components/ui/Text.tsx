import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { sans, serif, serifItalic, size, useTheme, type Palette } from '@/theme';

export type Variant = 'display' | 'title' | 'lead' | 'body' | 'secondary' | 'meta' | 'label' | 'quote';
export type Tone = 'ink' | 'ink2' | 'ink3' | 'ink4' | 'signal' | 'signalInk' | 'high' | 'medium' | 'low' | 'ok' | 'pillOn';

const VARIANTS: Record<Variant, TextStyle> = {
  // Page titles: the serif, tight.
  display: { fontFamily: serif('500'), fontSize: size.display, lineHeight: 36, letterSpacing: -0.4 },
  // Card and section titles.
  title: { fontFamily: serif('500'), fontSize: size.title, lineHeight: 28, letterSpacing: -0.2 },
  lead: { fontFamily: sans('600'), fontSize: size.lead, lineHeight: 24 },
  body: { fontFamily: sans('400'), fontSize: size.body, lineHeight: 22 },
  secondary: { fontFamily: sans('400'), fontSize: size.secondary, lineHeight: 20 },
  meta: { fontFamily: sans('500'), fontSize: size.meta, lineHeight: 17 },
  // The kicker: sentence case, semibold, never tracked caps.
  label: { fontFamily: sans('600'), fontSize: 13, lineHeight: 18 },
  // The quiet voice: what was said, what your agent keeps.
  quote: { fontFamily: serifItalic(), fontSize: size.lead, lineHeight: 24 },
};

const DEFAULT_TONE: Record<Variant, Tone> = {
  display: 'ink',
  title: 'ink',
  lead: 'ink',
  body: 'ink2',
  secondary: 'ink3',
  meta: 'ink3',
  label: 'ink3',
  quote: 'ink2',
};

function toneColor(p: Palette, tone: Tone): string {
  return p[tone];
}

export interface TProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: '400' | '500' | '600' | '700';
  center?: boolean;
}

/** All text in the app. Scales with the system text size (Dynamic Type / font scale). */
export function T({ variant = 'body', tone, weight, center, style, ...rest }: TProps) {
  const p = useTheme();
  const base = VARIANTS[variant];
  const family = weight && !['display', 'title', 'quote'].includes(variant) ? { fontFamily: sans(weight) } : null;
  const header = variant === 'display' || variant === 'title' ? { accessibilityRole: 'header' as const } : null;
  return (
    <RNText
      {...header}
      {...rest}
      style={[base, family, { color: toneColor(p, tone ?? DEFAULT_TONE[variant]) }, center && { textAlign: 'center' }, style]}
    />
  );
}
