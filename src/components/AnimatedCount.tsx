import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

interface AnimatedCountProps {
  /** Target value to count up to. */
  value: number;
  /** Animation duration in ms. */
  duration?: number;
  /** Delay before the count starts, in ms. */
  delay?: number;
  /** Optional prefix/suffix rendered around the number. */
  prefix?: string;
  suffix?: string;
  /** Render `value` as a fixed number of decimals (default 0). */
  decimals?: number;
  /** Custom formatter for the in-progress value; overrides prefix/suffix/decimals. */
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
}

/**
 * Counts a number up from 0 to `value` on mount using an ease-out curve.
 * Drives plain React state (not the native driver) since it animates text,
 * which is cheap for the short, one-shot reveals on the Insights screen.
 */
export default function AnimatedCount({
  value,
  duration = 900,
  delay = 0,
  prefix = '',
  suffix = '',
  decimals = 0,
  format,
  style,
}: AnimatedCountProps) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let start = 0;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min((now - start) / duration, 1);
      setDisplay(value * easeOut(t));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };

    timer.current = setTimeout(() => {
      raf.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, duration, delay]);

  const shown = format
    ? format(display)
    : decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toString();

  return (
    <Text style={style}>
      {format ? shown : `${prefix}${shown}${suffix}`}
    </Text>
  );
}
