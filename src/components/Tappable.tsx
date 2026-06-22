import React, { useRef } from 'react';
import { Animated, Pressable, ViewStyle } from 'react-native';

interface TappableProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  /** How far the element scales down while pressed. */
  scaleTo?: number;
}

/**
 * Wraps content with a subtle press-in scale + fade, giving cards and list
 * rows a tactile, premium feel. Uses the native driver so it stays smooth.
 */
export default function Tappable({ onPress, children, style, scaleTo = 0.97 }: TappableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animateTo = (s: number, o: number) =>
    Animated.parallel([
      Animated.spring(scale, { toValue: s, useNativeDriver: true, speed: 50, bounciness: 4 }),
      Animated.timing(opacity, { toValue: o, duration: 90, useNativeDriver: true }),
    ]).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(scaleTo, 0.92)}
      onPressOut={() => animateTo(1, 1)}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
