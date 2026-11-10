import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, sans, useTheme } from '@/theme';
import { useReducedMotion } from '@/lib/motion';
import { T } from './Text';

export interface ToastInput {
  /** Uses the button's verb: "Decision confirmed", "Task done". */
  text: string;
  tone?: 'ok' | 'error';
  undo?: () => void;
  durationMs?: number;
}

interface ToastState extends ToastInput {
  id: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => undefined);

/** One toast system for the whole app, with Undo where an action can be taken back. */
export function useToast(): (t: ToastInput) => void {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const seq = useRef(0);
  const show = useCallback((t: ToastInput) => {
    seq.current += 1;
    setToast({ ...t, id: seq.current });
    AccessibilityInfo.announceForAccessibility(t.undo ? `${t.text}. Undo available.` : t.text);
  }, []);
  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDone={() => setToast(null)} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (!reduced) Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const timer = setTimeout(onDone, toast.durationMs ?? (toast.undo ? 5000 : 3200));
    return () => clearTimeout(timer);
  }, [anim, onDone, reduced, toast.durationMs, toast.undo]);

  const rise = anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + 72, opacity: anim, transform: [{ translateY: rise }] }]}
    >
      <View
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: toast.tone === 'error' ? p.high : p.pill }]}
      >
        <T variant="body" style={{ flex: 1, color: toast.tone === 'error' ? '#ffffff' : p.pillOn, fontFamily: sans('500') }}>
          {toast.text}
        </T>
        {toast.undo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo"
            hitSlop={8}
            onPress={() => {
              toast.undo?.();
              onDone();
            }}
            style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 }}
          >
            <T variant="body" style={{ color: p.signalLine, fontFamily: sans('700') }}>
              Undo
            </T>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.ctl,
    maxWidth: 520,
    width: '100%',
  },
});
