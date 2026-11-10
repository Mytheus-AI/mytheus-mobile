import React from 'react';
import { View } from 'react-native';
import { radii, useTheme } from '@/theme';
import { T } from './Text';

export type ChipTone = 'neutral' | 'signal' | 'high' | 'medium' | 'low' | 'ok';

/** A small label chip in the frozen tones. Text, never a coloured dot alone. */
export function Chip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  const p = useTheme();
  const look = {
    neutral: { bg: p.bg2, fg: p.ink2 },
    signal: { bg: p.signalSoft, fg: p.signalInk },
    high: { bg: p.highSoft, fg: p.high },
    medium: { bg: p.mediumSoft, fg: p.medium },
    low: { bg: p.lowSoft, fg: p.low },
    ok: { bg: p.okSoft, fg: p.ok },
  }[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: look.bg,
        borderRadius: radii.full,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <T variant="meta" weight="600" style={{ color: look.fg }} maxFontSizeMultiplier={1.5}>
        {label}
      </T>
    </View>
  );
}

/** The frozen priority language: 1 acts now (red), 2 needs attention (amber), 3 informs (blue). */
export function priorityTone(priority: number): ChipTone {
  return priority === 1 ? 'high' : priority === 2 ? 'medium' : 'low';
}

export function priorityLabel(priority: number): string {
  return priority === 1 ? 'Acts now' : priority === 2 ? 'Needs attention' : 'For your information';
}
