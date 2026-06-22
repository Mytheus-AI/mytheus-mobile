import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View, ViewStyle } from 'react-native';

interface WaveformProps {
  active: boolean;
  heights: number[];
  color: string;
  barWidth?: number;
  gap?: number;
  /** Per-bar opacity scaling based on height, like the source design. */
  fadeByHeight?: boolean;
  style?: ViewStyle;
}

/**
 * A row of vertical bars that pulse on the Y axis (the "podWave" animation).
 * When `active` is false the bars freeze at a low resting scale.
 */
function Bar({
  height,
  color,
  width,
  delay,
  duration,
  active,
  opacity,
}: {
  height: number;
  color: string;
  width: number;
  delay: number;
  duration: number;
  active: boolean;
  opacity: number;
}) {
  const scale = useRef(new Animated.Value(0.22)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    if (active) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1,
            duration: duration / 2,
            delay,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.22,
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    } else {
      Animated.timing(scale, {
        toValue: 0.3,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
    return () => loop?.stop();
  }, [active, scale, delay, duration]);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: width,
        backgroundColor: color,
        opacity,
        transform: [{ scaleY: scale }],
      }}
    />
  );
}

export default function Waveform({
  active,
  heights,
  color,
  barWidth = 3,
  gap = 3,
  fadeByHeight = true,
  style,
}: WaveformProps) {
  const bars = useMemo(
    () =>
      heights.map((h, i) => ({
        h,
        delay: (i % 7) * 90,
        duration: 700 + (i % 5) * 120,
        opacity: fadeByHeight ? 0.32 + (h / 30) * 0.46 : 1,
      })),
    [heights, fadeByHeight],
  );

  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap, overflow: 'hidden' },
        style,
      ]}
    >
      {bars.map((b, i) => (
        <Bar
          key={i}
          height={b.h}
          color={color}
          width={barWidth}
          delay={b.delay}
          duration={b.duration}
          active={active}
          opacity={b.opacity}
        />
      ))}
    </View>
  );
}

export const LIVE_WAVE_HEIGHTS = [
  10, 18, 26, 14, 30, 20, 12, 24, 16, 28, 22, 9, 17, 25, 13, 29, 19, 11, 23, 15,
  27, 21, 8, 16, 24, 12, 28, 18, 10, 22, 14, 26, 20, 13, 30, 17, 11, 23, 15, 9,
];

export const MINI_WAVE_HEIGHTS = [6, 11, 14, 9, 13, 8];
