import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import BrandMark from './BrandMark';

interface ScreenHeaderProps {
  title: string;
  greeting?: string;
  subtitle?: string;
  right?: React.ReactNode;
  /** Show the squiggle signature above the greeting (home screen only). */
  brand?: boolean;
}

/** Consistent top header for the tab screens: greeting/subtitle + serif title. */
export default function ScreenHeader({
  title,
  greeting,
  subtitle,
  right,
  brand,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { paddingTop: insets.top + 6 }]}>
      <View style={{ flex: 1 }}>
        {brand ? (
          <View style={styles.brand}>
            <BrandMark width={36} strokeWidth={11} />
          </View>
        ) : null}
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
  brand: { marginBottom: 5 },
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
