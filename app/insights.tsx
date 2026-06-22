import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, shadows } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import {
  Calendar,
  Check,
  CheckCircle,
  People as PeopleIcon,
  Sparkle,
  ArrowUpRight,
} from '@/components/icons';
import AppHeader from '@/components/AppHeader';
import AnimatedCount from '@/components/AnimatedCount';
import { Card } from '@/components/Card';
import {
  weeklyStats,
  weeklyActivity,
  topCollaborators,
  weekHighlights,
} from '@/data/mock';

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function InsightsScreen() {
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const openActions = weeklyStats.actionsTotal - weeklyStats.actionsDone;
  const progress = weeklyStats.actionsTotal
    ? weeklyStats.actionsDone / weeklyStats.actionsTotal
    : 0;
  const pct = Math.round(progress * 100);

  // Hero value fades/slides in (a count-up reads badly as a duration).
  const heroReveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(heroReveal, {
      toValue: 1,
      duration: 500,
      delay: 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [heroReveal]);
  const heroTranslate = heroReveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  // Progress bar fill grows in on mount.
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue: 1,
      duration: 900,
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fill]);
  const fillWidth = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.max(pct, 4)}%`],
  });

  const tiles = [
    { icon: <Calendar size={16} color={colors.warmText2} />, tint: colors.chipNeutralBg, value: weeklyStats.meetings, label: 'Meetings' },
    { icon: <Check size={14} color={colors.green} />, tint: colors.chipGreenBg, value: weeklyStats.decisions, label: 'Decisions' },
    { icon: <CheckCircle size={16} color={colors.accent} />, tint: colors.chipOrangeBg, value: openActions, label: 'Open actions' },
    { icon: <PeopleIcon size={16} color={colors.brown} />, tint: colors.chipBrownBg, value: weeklyStats.people, label: 'People' },
  ];

  return (
    <View style={styles.screen}>
      <AppHeader title="This week" onBack={goBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: headline metric */}
        <LinearGradient
          colors={gradients.hero.colors}
          locations={gradients.hero.locations}
          start={gradients.hero.start}
          end={gradients.hero.end}
          style={styles.hero}
        >
          <View style={styles.heroRow}>
            <View style={styles.heroLeft}>
              <View style={styles.heroLabelRow}>
                <Sparkle size={12} color={colors.accentDeep} />
                <Text style={styles.heroLabel}>CAPTURED THIS WEEK</Text>
              </View>
              <Animated.Text
                style={[
                  styles.heroValue,
                  { opacity: heroReveal, transform: [{ translateY: heroTranslate }] },
                ]}
              >
                {formatDuration(weeklyStats.minutes)}
              </Animated.Text>
              <Text style={styles.heroSub}>
                across {weeklyStats.meetings} meetings with {weeklyStats.people} people
              </Text>
            </View>

            <Animated.View style={[styles.trend, { opacity: heroReveal }]}>
              <View style={styles.trendTop}>
                <ArrowUpRight size={13} color={colors.accentDeep} />
                <Text style={styles.trendPct}>{weeklyStats.trendPct}%</Text>
              </View>
              <Text style={styles.trendLabel}>vs last week</Text>
            </Animated.View>
          </View>
        </LinearGradient>

        {/* Stat tiles */}
        <View style={styles.grid}>
          {tiles.map((t, i) => (
            <View key={t.label} style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: t.tint }]}>{t.icon}</View>
              <AnimatedCount
                value={t.value}
                duration={850}
                delay={120 + i * 90}
                style={styles.tileValue}
              />
              <Text style={styles.tileLabel}>{t.label}</Text>
            </View>
          ))}
        </View>

        {/* Action progress */}
        <Text style={styles.sectionLabel}>FOLLOW-UPS</Text>
        <View style={styles.section}>
          <Card>
            <View style={styles.progressTop}>
              <View style={styles.progressTitleRow}>
                <AnimatedCount
                  value={weeklyStats.actionsDone}
                  duration={700}
                  delay={150}
                  style={styles.progressTitle}
                />
                <Text style={styles.progressOf}> / {weeklyStats.actionsTotal} done</Text>
              </View>
              <AnimatedCount
                value={pct}
                duration={900}
                delay={250}
                suffix="%"
                style={styles.progressPct}
              />
            </View>
            <View style={styles.track}>
              <Animated.View style={[styles.fill, { width: fillWidth }]} />
            </View>
            <Text style={styles.progressHint}>{openActions} still open across your meetings</Text>
          </Card>
        </View>

        {/* Activity chart */}
        <Text style={styles.sectionLabel}>ACTIVITY</Text>
        <View style={styles.section}>
          <Card>
            <WeekBars />
          </Card>
        </View>

        {/* Top collaborators */}
        <Text style={styles.sectionLabel}>TOP COLLABORATORS</Text>
        <View style={styles.section}>
          <Card>
            <View style={styles.collabRow}>
              {topCollaborators.map((p, i) => (
                <View key={p.id} style={styles.collab}>
                  <View style={[styles.collabAvatar, { backgroundColor: p.color }]}>
                    <Text style={styles.collabInitial}>{p.initial}</Text>
                  </View>
                  <Text style={styles.collabName} numberOfLines={1}>
                    {p.name.split(' ')[0]}
                  </Text>
                  <AnimatedCount
                    value={p.meetings}
                    duration={800}
                    delay={200 + i * 90}
                    style={styles.collabCount}
                  />
                </View>
              ))}
            </View>
          </Card>
        </View>

        {/* Highlights */}
        <Text style={styles.sectionLabel}>HIGHLIGHTS</Text>
        <View style={[styles.section, { gap: 12 }]}>
          {weekHighlights.map((h, i) => (
            <Card key={i}>
              <View style={styles.highlightRow}>
                <View
                  style={[
                    styles.highlightDot,
                    { backgroundColor: h.kind === 'decision' ? colors.green : colors.brownDot },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.highlightText}>{h.text}</Text>
                  <Text style={styles.highlightMeta}>{h.meeting}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** Per-day activity as a simple bar chart; bars grow in on mount and the
 *  busiest day is accented. */
function WeekBars() {
  const max = Math.max(...weeklyActivity.map((d) => d.minutes), 1);
  const heights = weeklyActivity.map((d) => Math.max((d.minutes / max) * 78, 4));
  const anims = useRef(weeklyActivity.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel(
      heights.map((h, i) =>
        Animated.timing(anims[i], {
          toValue: h,
          duration: 620,
          delay: 150 + i * 70,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.barsRow}>
      {weeklyActivity.map((d, i) => {
        const busiest = d.minutes === max;
        return (
          <View key={d.day} style={styles.barCol}>
            <View style={styles.barSlot}>
              <Animated.View
                style={[
                  styles.bar,
                  {
                    height: anims[i],
                    backgroundColor: busiest ? colors.accent : 'rgba(217,119,87,0.20)',
                  },
                ]}
              />
            </View>
            <Text
              style={[styles.barDay, busiest && { color: colors.accentDeep, fontFamily: sans('700') }]}
            >
              {d.day}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flex: 1, paddingTop: 6 },

  hero: {
    marginHorizontal: 14,
    borderRadius: radii.hero,
    padding: 22,
    overflow: 'hidden',
    ...shadows.hero,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroLeft: { flex: 1 },
  trend: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  trendTop: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trendPct: { fontFamily: sans('800'), fontSize: 16, color: colors.accentDeep },
  trendLabel: { fontFamily: sans('600'), fontSize: 10.5, color: colors.warmText2, marginTop: 2 },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLabel: {
    fontFamily: sans('800'),
    fontSize: 11,
    letterSpacing: 1,
    color: colors.warmLabelOnPeach,
  },
  heroValue: {
    fontFamily: serif('600'),
    fontSize: 44,
    letterSpacing: -1,
    color: colors.inkDeep,
    marginTop: 10,
  },
  heroSub: { fontFamily: sans('500'), fontSize: 13.5, color: colors.warmText, marginTop: 4 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginHorizontal: 14,
    marginTop: 14,
  },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    ...shadows.card,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: { fontFamily: serif('600'), fontSize: 26, color: colors.ink, marginTop: 12 },
  tileLabel: { fontFamily: sans('600'), fontSize: 12, color: colors.muted, marginTop: 1 },

  sectionLabel: {
    fontFamily: sans('800'),
    fontSize: 11.5,
    letterSpacing: 0.9,
    color: colors.mutedLabel,
    marginTop: 26,
    marginHorizontal: 18,
    marginBottom: 11,
  },
  section: { marginHorizontal: 14 },

  progressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTitleRow: { flexDirection: 'row', alignItems: 'baseline' },
  progressTitle: { fontFamily: serif('600'), fontSize: 22, color: colors.ink },
  progressOf: { fontFamily: sans('600'), fontSize: 14, color: colors.muted },
  progressPct: { fontFamily: sans('800'), fontSize: 14, color: colors.accentDeep },
  track: { height: 8, borderRadius: 8, backgroundColor: '#EDE8DF', marginTop: 14, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 8, backgroundColor: colors.accent },
  progressHint: { fontFamily: sans('500'), fontSize: 12.5, color: colors.muted, marginTop: 12 },

  barsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  barCol: { alignItems: 'center', flex: 1, gap: 9 },
  barSlot: { height: 78, justifyContent: 'flex-end' },
  bar: { width: 13, borderRadius: 7 },
  barDay: { fontFamily: sans('600'), fontSize: 11, color: colors.muted },

  collabRow: { flexDirection: 'row', justifyContent: 'space-between' },
  collab: { alignItems: 'center', flex: 1, gap: 7 },
  collabAvatar: {
    width: 46,
    height: 46,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collabInitial: { fontFamily: sans('700'), fontSize: 16, color: colors.white },
  collabName: { fontFamily: sans('600'), fontSize: 12, color: colors.bodySoft },
  collabCount: { fontFamily: sans('800'), fontSize: 12.5, color: colors.accentDeep },

  highlightRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  highlightDot: { width: 7, height: 7, borderRadius: 7, marginTop: 6 },
  highlightText: { fontFamily: sans('500'), fontSize: 13.5, color: colors.body, lineHeight: 19.5 },
  highlightMeta: { fontFamily: sans('600'), fontSize: 11.5, color: colors.mutedAlt, marginTop: 5 },
});
