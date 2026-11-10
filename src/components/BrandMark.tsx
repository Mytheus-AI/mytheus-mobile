import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';
import { SQUIGGLE_PATH, SQUIGGLE_LENGTH } from './squiggle-path';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface BrandMarkProps {
  /** Rendered width; height is always width / 2 (viewBox is 200x100). */
  width?: number;
  color?: string;
  /** Stroke width in viewBox units (the logo's native weight is 6). */
  strokeWidth?: number;
  /** Draw the squiggle on with a stroke-dashoffset sweep. */
  animated?: boolean;
  duration?: number;
  delay?: number;
  onDrawn?: () => void;
}

/**
 * The Mytheus squiggle: a tangle that unspools into a clean line. Static by
 * default; with `animated` it draws itself from the knot outward, which is
 * the brand gesture (messy conversation -> clear notes).
 */
export default function BrandMark({
  width = 64,
  color,
  strokeWidth = 6,
  animated = false,
  duration = 1400,
  delay = 0,
  onDrawn,
}: BrandMarkProps) {
  const p = useTheme();
  const progress = useRef(new Animated.Value(animated ? 0 : 1)).current;

  useEffect(() => {
    if (!animated) return;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false, // SVG props animate on the JS thread
    });
    anim.start(({ finished }) => {
      if (finished) onDrawn?.();
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SQUIGGLE_LENGTH, 0],
  });

  return (
    <Svg width={width} height={width / 2} viewBox="0 0 200 100" accessible={false}>
      <AnimatedPath
        d={SQUIGGLE_PATH}
        fill="none"
        stroke={color ?? p.signalLine}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${SQUIGGLE_LENGTH}`}
        strokeDashoffset={dashOffset}
      />
    </Svg>
  );
}
