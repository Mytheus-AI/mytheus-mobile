import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTheme } from '@/theme';

/** Three blinking dots that indicate a partial transcript line is streaming. */
function Dot({ delay }: { delay: number }) {
  const p = useTheme();
  const opacity = useRef(new Animated.Value(0.18)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.18,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, delay]);

  return (
    <Animated.View
      style={{
        width: 5,
        height: 5,
        borderRadius: 5,
        backgroundColor: p.signal,
        opacity,
      }}
    />
  );
}

export default function StreamingDots({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View
      style={{ flexDirection: 'row', gap: 3, alignItems: 'center', marginLeft: 5 }}
      accessibilityLabel="Writing"
    >
      <Dot delay={0} />
      <Dot delay={200} />
      <Dot delay={400} />
    </View>
  );
}
