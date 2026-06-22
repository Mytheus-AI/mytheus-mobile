import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, ViewStyle } from 'react-native';

interface PulseRingProps {
  size: number;
  color: string;
  /** Number of staggered rings expanding outward. */
  rings?: number;
  duration?: number;
  active?: boolean;
  children?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Concentric rings that scale up and fade out from behind a centered child.
 * Recreates the "ringPulse" radar effect under the big record button.
 */
function Ring({
  size,
  color,
  delay,
  duration,
  active,
}: {
  size: number;
  color: string;
  delay: number;
  duration: number;
  active: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    if (active) {
      loop = Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      );
      loop.start();
    }
    return () => loop?.stop();
  }, [active, progress, delay, duration]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

export default function PulseRing({
  size,
  color,
  rings = 2,
  duration = 2400,
  active = true,
  children,
  style,
}: PulseRingProps) {
  return (
    <View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      {Array.from({ length: rings }).map((_, i) => (
        <Ring
          key={i}
          size={size}
          color={color}
          delay={(duration / rings) * i}
          duration={duration}
          active={active}
        />
      ))}
      {children}
    </View>
  );
}
