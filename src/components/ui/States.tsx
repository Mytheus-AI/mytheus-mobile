import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { radii, useTheme } from '@/theme';
import { useReducedMotion } from '@/lib/motion';
import BrandMark from '@/components/BrandMark';
import { WarningCircle } from '@/components/Icon';
import { Button } from './Button';
import { Card } from './Card';
import { T } from './Text';

/** Nothing here yet: a small drawn line, what this place is for, and the one next step. */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  compact,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.empty, compact && { paddingVertical: 20 }]} accessible accessibilityLabel={[title, body].filter(Boolean).join('. ')}>
      {!compact ? <BrandMark width={56} strokeWidth={7} /> : null}
      <T variant="lead" center>
        {title}
      </T>
      {body ? (
        <T variant="secondary" center style={{ maxWidth: 320 }}>
          {body}
        </T>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="outline" small /> : null}
    </View>
  );
}

/** Something failed. Drawn apart from an empty state, and always with a way to try again. */
export function ErrorState({
  title = 'This could not be loaded',
  body = 'Check your connection and try again.',
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  const p = useTheme();
  return (
    <Card style={{ borderColor: p.highSoft }}>
      <View style={styles.error} accessibilityRole="alert">
        <WarningCircle size={22} color={p.high} />
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="body" weight="600" tone="ink">
            {title}
          </T>
          <T variant="secondary">{body}</T>
          {onRetry ? <Button label="Try again" onPress={onRetry} variant="outline" small style={{ marginTop: 8 }} /> : null}
        </View>
      </View>
    </Card>
  );
}

/** A quiet placeholder the size of the content it stands in for. */
export function Skeleton({ lines = 3, card = true }: { lines?: number; card?: boolean }) {
  const p = useTheme();
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  const bars = (
    <Animated.View style={{ gap: 12, opacity: pulse }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} style={{ gap: 6 }}>
          <View style={{ height: 14, width: `${88 - ((i * 17) % 40)}%`, borderRadius: radii.ctl, backgroundColor: p.bg2 }} />
          <View style={{ height: 11, width: '38%', borderRadius: radii.ctl, backgroundColor: p.bg2 }} />
        </View>
      ))}
    </Animated.View>
  );
  return card ? <Card>{bars}</Card> : bars;
}

/** A small note above a list: part of it could not be loaded. */
export function PartialNotice({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const p = useTheme();
  return (
    <View style={[styles.partial, { backgroundColor: p.mediumSoft }]} accessibilityRole="alert">
      <WarningCircle size={18} color={p.medium} />
      <T variant="secondary" style={{ flex: 1, color: p.medium }}>
        {text}
      </T>
      {onRetry ? <Button label="Retry" small variant="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: 10, paddingVertical: 36, paddingHorizontal: 24 },
  error: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  partial: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.ctl },
});
