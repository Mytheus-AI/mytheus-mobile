import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '@/theme/tokens';
import { Home, Sparkle, CheckCircle, People, Gallery } from './icons';

type IconComponent = (p: { size?: number; color?: string }) => React.JSX.Element;

const TABS: Record<string, { Icon: IconComponent; label: string }> = {
  index: { Icon: Home, label: 'Home' },
  ask: { Icon: Sparkle, label: 'Ask' },
  actions: { Icon: CheckCircle, label: 'Actions' },
  people: { Icon: People, label: 'People' },
  library: { Icon: Gallery, label: 'Library' },
};

const PILL_WIDTH = 54;
const PILL_HEIGHT = 40;

/** Pops the focused icon in with a small spring. */
function TabIcon({ Icon, focused }: { Icon: IconComponent; focused: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!focused) return;
    scale.setValue(0.82);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 11,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Icon size={22} color={focused ? colors.accent : colors.mutedIcon} />
    </Animated.View>
  );
}

/**
 * Floating bottom tab bar: a rounded card lifted off the screen edge. A soft
 * accent pill slides on a spring behind the active icon.
 */
export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [innerWidth, setInnerWidth] = useState(0);
  const pillX = useRef(new Animated.Value(0)).current;

  const slot = innerWidth / state.routes.length;
  const pillLeftFor = (index: number) => slot * index + (slot - PILL_WIDTH) / 2;

  useEffect(() => {
    if (!innerWidth) return;
    Animated.spring(pillX, {
      toValue: pillLeftFor(state.index),
      useNativeDriver: true,
      speed: 24,
      bounciness: 7,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, innerWidth]);

  return (
    <View style={[styles.region, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View
        style={styles.bar}
        onLayout={(e) => setInnerWidth(e.nativeEvent.layout.width - 16)}
      >
        {innerWidth > 0 && (
          <Animated.View style={[styles.pill, { transform: [{ translateX: pillX }] }]} />
        )}
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { Icon, label } = TABS[route.name] ?? TABS.index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.item}
              hitSlop={6}
            >
              <View style={styles.chip}>
                <TabIcon Icon={Icon} focused={focused} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  region: {
    backgroundColor: colors.bgApp,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 26,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.navBorder,
    shadowColor: '#2A211B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 10,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chip: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: 15,
    backgroundColor: 'rgba(217,119,87,0.12)',
  },
});
