import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, shadows } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import { Check, Share, Sparkle, ArrowRight } from '@/components/icons';
import AppHeader from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { DecisionCard } from '@/components/SummaryBlocks';
import ActionItemRow from '@/components/ActionItemRow';
import TranscriptLine from '@/components/TranscriptLine';
import {
  actionItems,
  decisionText,
  overviewText,
  fullTranscript,
} from '@/data/mock';

type Tab = 'summary' | 'transcript';
type Checks = Record<'a' | 'b' | 'c', boolean>;

export default function RecapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('summary');
  const [checks, setChecks] = useState<Checks>({ a: false, b: false, c: false });

  const toggle = (k: 'a' | 'b' | 'c') => setChecks((c) => ({ ...c, [k]: !c[k] }));
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.screen}>
      <AppHeader
        title="Recap"
        onBack={goBack}
        right={<Share size={17} color={colors.warmText3} />}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.completed}>
          <Check size={11} color={colors.green} />
          <Text style={styles.completedText}>Completed</Text>
        </View>
        <Text style={styles.title}>Q3 Roadmap Sync</Text>
        <Text style={styles.meta}>Today · 24 min · 3 speakers</Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          <Tab label="Summary" active={tab === 'summary'} onPress={() => setTab('summary')} />
          <Tab
            label="Transcript"
            active={tab === 'transcript'}
            onPress={() => setTab('transcript')}
          />
        </View>

        {tab === 'summary' ? (
          <View style={styles.list}>
            <LinearGradient
              colors={gradients.overview.colors}
              locations={gradients.overview.locations}
              start={gradients.overview.start}
              end={gradients.overview.end}
              style={styles.overview}
            >
              <View style={styles.overviewHead}>
                <Sparkle size={13} color={colors.accentDeep} />
                <Text style={styles.overviewLabel}>OVERVIEW</Text>
              </View>
              <Text style={styles.overviewText}>
                The team aligned on shipping Q3 on the{' '}
                <Text style={styles.strong}>14th</Text>, protecting a full QA week, and agreed
                to loop in support before launch.
              </Text>
            </LinearGradient>

            <DecisionCard text={decisionText} emphasis="14th" withBadge={false} />

            <Card>
              <View style={styles.actionHead}>
                <View style={[styles.actionDot, { backgroundColor: colors.accent }]} />
                <Text style={styles.actionLabel}>ACTION ITEMS</Text>
              </View>
              <View style={{ gap: 13 }}>
                {actionItems.map((item) => (
                  <ActionItemRow
                    key={item.id}
                    item={item}
                    checked={checks[item.id]}
                    onToggle={() => toggle(item.id)}
                  />
                ))}
              </View>
            </Card>
          </View>
        ) : (
          <Card style={{ marginTop: 14, gap: 15 }}>
            {fullTranscript.map((line) => (
              <TranscriptLine key={line.id} line={{ ...line, partial: false }} />
            ))}
          </Card>
        )}
      </ScrollView>

      {/* Ask bar */}
      <LinearGradient
        colors={['rgba(240,238,230,0)', colors.bgApp]}
        locations={[0, 0.3]}
        style={[styles.askWrap, { paddingBottom: Math.max(insets.bottom, 18) + 12 }]}
      >
        <View style={styles.askBar}>
          <Sparkle size={15} color="rgba(255,255,255,0.7)" />
          <Text style={styles.askPlaceholder}>Ask anything about this meeting…</Text>
          <Pressable style={styles.askSend} accessibilityLabel="Send">
            <ArrowRight size={17} color={colors.white} />
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

function Tab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, active ? styles.tabActive : styles.tabIdle]}
    >
      <Text style={[styles.tabLabel, { color: active ? colors.ink : colors.mutedLabel }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flex: 1, paddingHorizontal: 14, paddingTop: 8 },
  completed: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.chipGreenBg,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radii.chip,
  },
  completedText: { fontFamily: sans('700'), fontSize: 11, color: colors.green },
  title: {
    fontFamily: serif('600'),
    fontSize: 27,
    letterSpacing: -0.4,
    color: colors.ink,
    marginTop: 11,
  },
  meta: { fontFamily: sans('500'), fontSize: 12.5, color: colors.muted, marginTop: 4 },

  tabs: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.tabTrack,
    borderRadius: radii.tab,
    padding: 4,
    marginTop: 18,
  },
  tab: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface, ...shadows.iconBtn },
  tabIdle: { backgroundColor: 'transparent' },
  tabLabel: { fontFamily: sans('700'), fontSize: 13.5 },

  list: { gap: 12, marginTop: 14 },
  overview: { borderRadius: radii.card, padding: 17, overflow: 'hidden', ...shadows.hero },
  overviewHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 },
  overviewLabel: { fontFamily: sans('800'), fontSize: 10.5, letterSpacing: 1, color: colors.warmText2 },
  overviewText: { fontFamily: sans('500'), fontSize: 14, color: '#3A312C', lineHeight: 21 },
  strong: { fontFamily: sans('800') },

  actionHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 13 },
  actionDot: { width: 7, height: 7, borderRadius: 7 },
  actionLabel: { fontFamily: sans('800'), fontSize: 10.5, letterSpacing: 1, color: colors.mutedLabel },

  askWrap: { paddingHorizontal: 14, paddingTop: 8 },
  askBar: {
    backgroundColor: colors.dark,
    borderRadius: 20,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...shadows.control,
  },
  askPlaceholder: { flex: 1, fontFamily: sans('500'), fontSize: 13.5, color: 'rgba(255,255,255,0.5)' },
  askSend: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
