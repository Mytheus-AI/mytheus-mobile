import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';
import { Home, SparkOutline, People, Gallery } from './icons';
import { Sparkle } from './icons';

/**
 * Static bottom navigation bar (Home is the active tab in this flow).
 * Tabs beyond Home are decorative placeholders for the prototype.
 */
export default function BottomNav() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 18) + 12 }]}>
      <View style={styles.item}>
        <Home size={22} color={colors.ink} />
      </View>
      <View style={styles.item}>
        <Sparkle size={22} color={colors.mutedIcon} />
      </View>
      <View style={styles.item}>
        <SparkOutline size={22} color={colors.mutedIcon} />
      </View>
      <View style={styles.item}>
        <People size={22} color={colors.mutedIcon} />
      </View>
      <View style={styles.item}>
        <Gallery size={22} color={colors.mutedIcon} />
      </View>
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
  item: { alignItems: 'center', justifyContent: 'center', gap: 3 },
});
