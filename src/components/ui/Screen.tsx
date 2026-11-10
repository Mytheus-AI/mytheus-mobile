import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '@/theme';
import { ArrowLeft } from '@/components/Icon';
import { IconButton } from './Button';
import { T } from './Text';

/**
 * The one page head: a serif title, one line of context, the page's one action on the right.
 * Detail screens get a back control instead of repeating the title in a bar.
 */
export function PageHead({
  title,
  context,
  right,
  back,
  kicker,
}: {
  title: string;
  context?: string | null;
  right?: React.ReactNode;
  back?: boolean;
  kicker?: string | null;
}) {
  const router = useRouter();
  const p = useTheme();
  return (
    <View style={{ gap: 4 }}>
      {back ? (
        <View style={{ marginLeft: -10, marginBottom: 2 }}>
          <IconButton
            icon={ArrowLeft}
            label="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        </View>
      ) : null}
      {kicker ? (
        <T variant="label" style={{ color: p.ink3 }}>
          {kicker}
        </T>
      ) : null}
      <View style={styles.titleRow}>
        <T variant="display" style={{ flex: 1 }}>
          {title}
        </T>
        {right}
      </View>
      {context ? <T variant="secondary">{context}</T> : null}
    </View>
  );
}

/** A scrolling page on the stage, with pull to refresh when it reads from the server. */
export function Screen({
  title,
  context,
  kicker,
  right,
  back,
  children,
  onRefresh,
  refreshing = false,
  contentStyle,
  header,
}: {
  title?: string;
  context?: string | null;
  kicker?: string | null;
  right?: React.ReactNode;
  back?: boolean;
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Rendered between the head and the content (filters). */
  header?: React.ReactNode;
}) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={[
        { paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 32, gap: space.gap },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.ink3} colors={[p.signal]} />
        ) : undefined
      }
    >
      {title ? <PageHead title={title} context={context} right={right} back={back} kicker={kicker} /> : null}
      {header}
      {children}
    </ScrollView>
  );
}

/** A section title inside a page. */
export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={[styles.titleRow, { marginTop: 12 }]}>
      <T variant="title" style={{ flex: 1, fontSize: 19, lineHeight: 25 }}>
        {title}
      </T>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
