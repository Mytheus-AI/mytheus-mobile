import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, shadows } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import { Calendar, Check, CheckCircle, People as PeopleIcon, Sparkle } from '@/components/icons';
import AppHeader from '@/components/AppHeader';
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
          <View style={styles.heroLabelRow}>
            <Sparkle size={12} color={colors.accentDeep} />
            <Text style={styles.heroLabel}>CAPTURED THIS WEEK</Text>
          </View>
          <Text style={styles.heroValue}>{formatDuration(weeklyStats.minutes)}</Text>
          <Text style={styles.heroSub}>
            across {weeklyStats.meetings} meetings with {weeklyStats.people} people
          </Text>
        </LinearGradient>

        {/* Stat tiles */}
        <View style={styles.grid}>
          {tiles.map((t) => (
            <View key={t.label} style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: t.tint }]}>{t.icon}</View>
              <Text style={styles.tileValue}>{t.value}</Text>
              <Text style={styles.tileLabel}>{t.label}</Text>
            </View>
          ))}
        </View>

        {/* Action progress */}
        <Text style={styles.sectionLabel}>FOLLOW-UPS</Text>
        <View style={styles.section}>
          <Card>
            <View style={styles.progressTop}>
              <Text style={styles.progressTitle}>
                {weeklyStats.actionsDone}
                <Text style={styles.progressOf}> / {weeklyStats.actionsTotal} done</Text>
              </Text>
              <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(progress * 100, 4)}%` }]} />
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
              {topCollaborators.map((p) => (
                <View key={p.id} style={styles.collab}>
                  <View style={[styles.collabAvatar, { backgroundColor: p.color }]}>
                    <Text style={styles.collabInitial}>{p.initial}</Text>
                  </View>
                  <Text style={styles.collabName} numberOfLines={1}>
                    {p.name.split(' ')[0]}
                  </Text>
                  <Text style={styles.collabCount}>{p.meetings}</Text>
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

/** Per-day activity as a simple bar chart; the busiest day is accented. */
function WeekBars() {
  const max = Math.max(...weeklyActivity.map((d) => d.minutes), 1);
  return (
    <View>
      <View style={styles.barsRow}>
        {weeklyActivity.map((d) => {
          const h = Math.max((d.minutes / max) * 78, 4);
          const busiest = d.minutes === max;
          return (
            <View key={d.day} style={styles.barCol}>
              <View style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: h,
                      backgroundColor: busiest ? colors.accent : 'rgba(217,119,87,0.20)',
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barDay, busiest && { color: colors.accentDeep, fontFamily: sans('700') }]}>
                {d.day}
              </Text>
            </View>
          );
        })}
      </View>
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
