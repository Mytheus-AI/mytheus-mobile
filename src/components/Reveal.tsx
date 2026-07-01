import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, ViewStyle } from 'react-native';

interface RevealProps {
  children: React.ReactNode;
  /** Milliseconds to wait before revealing; stagger siblings with this. */
  delay?: number;
  style?: ViewStyle;
}

/** Fade + rise entrance for sections; snaps into place under reduced motion. */
export default function Reveal({ children, delay = 0, style }: RevealProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: 520,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rise = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY: rise }] }]}>
      {children}
    </Animated.View>
  );
}
