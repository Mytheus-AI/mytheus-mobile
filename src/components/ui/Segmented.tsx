import React from 'react';
import { Pressable, View } from 'react-native';
import { radii, sans, useTheme } from '@/theme';
import { T } from './Text';

export interface Segment<K extends string> {
  key: K;
  label: string;
  count?: number;
}

/** Tabs inside a screen (My work, Inbox filters). A track with the active segment as a white card. */
export function Segmented<K extends string>({
  segments,
  value,
  onChange,
  label,
}: {
  segments: readonly Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  const p = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', backgroundColor: p.bg2, borderRadius: radii.ctl, padding: 3, gap: 3 }}
    >
      {segments.map((s) => {
        const active = s.key === value;
        const count = s.count && s.count > 0 ? (s.count > 99 ? '99+' : String(s.count)) : null;
        return (
          <Pressable
            key={s.key}
            onPress={() => onChange(s.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={count ? `${s.label}, ${count} open` : s.label}
            style={{
              flex: 1,
              minHeight: 38,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
              borderRadius: radii.ctl - 3,
              backgroundColor: active ? p.surface : 'transparent',
              paddingHorizontal: 6,
            }}
          >
            <T
              variant="secondary"
              numberOfLines={1}
              maxFontSizeMultiplier={1.4}
              style={{ fontFamily: sans(active ? '600' : '500'), color: active ? p.ink : p.ink3 }}
            >
              {s.label}
            </T>
            {count ? (
              <T variant="meta" weight="600" maxFontSizeMultiplier={1.3} style={{ color: active ? p.signalInk : p.ink3 }}>
                {count}
              </T>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
