import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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

/**
 * Floating bottom tab bar: a rounded card lifted off the screen edge. The
 * active tab is marked by a soft squircle "chip" behind an accent-tinted icon,
 * keeping the bar clean and icon-only.
 */
export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.region, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { Icon, label } = TABS[route.name] ?? TABS.index;
          const tint = focused ? colors.accent : colors.mutedIcon;

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
              <View style={[styles.chip, focused && styles.chipActive]}>
                <Icon size={22} color={tint} />
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
    width: 54,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: 'rgba(217,119,87,0.12)' },
});
