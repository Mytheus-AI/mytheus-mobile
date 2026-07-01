import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import { serif } from '@/theme/typography';
import BrandMark from './BrandMark';

/** The intro plays once per cold start, not on every remount. */
let hasPlayedThisLaunch = false;
let introStartedAt = 0;

/** How the overlay and the screens beneath it share the clock: screens that
 * mount under the intro can delay their entrance so they rise into view just
 * as the overlay lifts. */
const ENTRANCE_HANDOFF_MS = 1600;

export function introEntranceDelay(): number {
  if (!hasPlayedThisLaunch) return ENTRANCE_HANDOFF_MS;
  return Math.max(0, ENTRANCE_HANDOFF_MS - (Date.now() - introStartedAt));
}

/**
 * Cold-start brand moment layered over the app: the squiggle draws itself
 * on cream, "Mytheus" settles in beneath it, and the overlay lifts away.
 * Never blocks input (pointerEvents="none") and collapses to a quick fade
 * when the user prefers reduced motion.
 */
export default function BrandIntro() {
  const [visible, setVisible] = useState(!hasPlayedThisLaunch);
  const wordmark = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    hasPlayedThisLaunch = true;
    introStartedAt = Date.now();
    let cancelled = false;

    const dismiss = (delay: number) =>
      Animated.timing(overlay, {
        toValue: 0,
        duration: 380,
        delay,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) setVisible(false);
      });

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        wordmark.setValue(1);
        dismiss(600);
        return;
      }
      Animated.timing(wordmark, {
        toValue: 1,
        duration: 520,
        delay: 780,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      dismiss(2050);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const wordmarkRise = wordmark.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { opacity: overlay }]}>
      <BrandMark width={172} animated duration={1350} delay={150} />
      <Animated.Text
        style={[styles.wordmark, { opacity: wordmark, transform: [{ translateY: wordmarkRise }] }]}
      >
        Mytheus
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bgApp,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: serif('600'),
    fontSize: 30,
    letterSpacing: 0.2,
    color: colors.inkDeep,
    marginTop: 18,
  },
});
