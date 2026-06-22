import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';

interface ScreenHeaderProps {
  title: string;
  greeting?: string;
  subtitle?: string;
  right?: React.ReactNode;
}

/** Consistent top header for the tab screens: greeting/subtitle + serif title. */
export default function ScreenHeader({ title, greeting, subtitle, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { paddingTop: insets.top + 6 }]}>
      <View style={{ flex: 1 }}>
        {greeting ? <Text style={styles.greeting}>{greeting}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 4,
    gap: 12,
  },
  greeting: { fontFamily: sans('500'), fontSize: 13, color: colors.mutedLabel },
  title: {
    fontFamily: serif('600'),
    fontSize: 26,
    letterSpacing: -0.4,
    color: colors.ink,
    marginTop: 1,
  },
  subtitle: { fontFamily: sans('500'), fontSize: 12.5, color: colors.muted, marginTop: 3 },
});
