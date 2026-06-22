import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '@/theme/tokens';
import { Home, Sparkle, CheckCircle, People, Gallery } from './icons';

type IconComponent = (p: { size?: number; color?: string }) => React.JSX.Element;

const ICONS: Record<string, IconComponent> = {
  index: Home,
  ask: Sparkle,
  actions: CheckCircle,
  people: People,
  library: Gallery,
};

/**
 * Icon-only bottom tab bar matching the Meeting Pod design language.
 * The active tab darkens its icon and shows a small accent dot beneath it.
 */
export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = ICONS[route.name] ?? Home;
        const isBrand = route.name === 'ask';
        const color = focused
          ? isBrand
            ? colors.accent
            : colors.ink
          : colors.mutedIcon;

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
            style={styles.item}
            hitSlop={6}
          >
            <Icon size={22} color={color} />
            <View
              style={[
                styles.dot,
                { backgroundColor: focused ? colors.accent : 'transparent' },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: colors.navBorder,
  },
  item: { alignItems: 'center', justifyContent: 'center', gap: 5, flex: 1 },
  dot: { width: 5, height: 5, borderRadius: 5 },
});
