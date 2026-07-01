import React, { useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { colors, shadows } from '@/theme/tokens';
import { Mic } from './icons';
import PulseRing from './PulseRing';

interface RecordButtonProps {
  size?: number;
  onPress?: () => void;
  /** Whether the radar rings are animating. */
  pulsing?: boolean;
}

/**
 * Large circular mic button with a warm static aura, accent radar pulses, and
 * an inner accent ring. Designed to read as the focal point of the session
 * screen against the peach hero.
 */
export default function RecordButton({
  size = 128,
  onPress,
  pulsing = true,
}: RecordButtonProps) {
  const aura = Math.round(size * 1.7);
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 7 }).start();

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Soft constant aura for depth */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: aura,
          height: aura,
          borderRadius: aura,
          backgroundColor: 'rgba(217,119,87,0.08)',
        }}
      />

      <PulseRing size={size} color={colors.accent} rings={2} active={pulsing}>
        <Pressable
          onPress={onPress}
          onPressIn={() => springTo(0.93)}
          onPressOut={() => springTo(1)}
          accessibilityRole="button"
          accessibilityLabel="Start listening"
        >
          <Animated.View
            style={{
              width: size,
              height: size,
              borderRadius: size,
              backgroundColor: colors.dark,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale }],
              ...shadows.darkButton,
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: 7,
                left: 7,
                right: 7,
                bottom: 7,
                borderRadius: size,
                borderWidth: 2,
                borderColor: 'rgba(217,119,87,0.65)',
              }}
            />
            <Mic size={Math.round(size * 0.27)} color={colors.white} />
          </Animated.View>
        </Pressable>
      </PulseRing>
    </View>
  );
}
