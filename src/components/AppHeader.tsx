import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '@/theme/tokens';
import { serif } from '@/theme/typography';
import { Back } from './icons';

interface AppHeaderProps {
  title: string;
  onBack?: () => void;
  /** Optional element rendered on the right (icon button or brand mark). */
  right?: React.ReactNode;
  /** Optional element rendered in the center instead of a plain title. */
  center?: React.ReactNode;
}

const IconShell = ({ children }: { children?: React.ReactNode }) => (
  <View style={styles.iconShell}>{children}</View>
);

/** Top bar with a back affordance, used on Start / Live / Recap screens. */
export default function AppHeader({ title, onBack, right, center }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { paddingTop: insets.top + 8 }]}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8} style={styles.iconShell}>
          <Back size={18} color={colors.warmText3} />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      {center ?? <Text style={styles.title}>{title}</Text>}

      {right ? <IconShell>{right}</IconShell> : <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  iconShell: {
    width: 40,
    height: 40,
    borderRadius: radii.iconBtn,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.iconBtn,
  },
  spacer: { width: 40, height: 40 },
  title: {
    fontFamily: serif('600'),
    fontSize: 18,
    letterSpacing: -0.1,
    color: colors.ink,
  },
});
