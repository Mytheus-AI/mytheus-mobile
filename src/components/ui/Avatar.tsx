import React from 'react';
import { View } from 'react-native';
import { radii, sans, useTheme } from '@/theme';
import { T } from './Text';

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

const TINTS = ['tintPeach', 'tintOchre', 'tintSage', 'tintSky'] as const;

function tintIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % TINTS.length;
}

/** Initials on a tint, stable per person. Decorative: the name is always said next to it. */
export function Avatar({ name, seed, size = 36 }: { name: string; seed?: string; size?: number }) {
  const p = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radii.full,
        backgroundColor: p[TINTS[tintIndex(seed ?? name)]],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T variant="meta" style={{ fontFamily: sans('700'), fontSize: size * 0.36, color: p.ink }} maxFontSizeMultiplier={1}>
        {initialsOf(name)}
      </T>
    </View>
  );
}
