import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, shadows } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import { Sparkle, ArrowUpRight, ChevronRight } from '@/components/icons';
import AppHeader from '@/components/AppHeader';
import AnimatedCount from '@/components/AnimatedCount';
import BrandMark from '@/components/BrandMark';
import ProgressRing from '@/components/ProgressRing';
import Reveal from '@/components/Reveal';
import Tappable from '@/components/Tappable';
import { Card } from '@/components/Card';
import {
  weeklyStats,
  weeklyActivity,
  topCollaborators,
  weekHighlights,
  commitmentStats,
} from '@/data/mock';

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const DAY_NAMES: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

export default function InsightsScreen() {
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

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

  const openActions = weeklyStats.actionsTotal - weeklyStats.actionsDone;

  return (
    <View style={styles.screen}>
      <AppHeader title="This week" onBack={goBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: headline metric + the week's numbers in one card */}
        <Reveal>
          <LinearGradient
            colors={gradients.hero.colors}
            locations={gradients.hero.locations}
            start={gradients.hero.start}
            end={gradients.hero.end}
            style={styles.hero}
          >
            <View style={styles.heroWatermark} pointerEvents="none">
              <BrandMark width={300} color="rgba(255,255,255,0.32)" strokeWidth={7} />
            </View>

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
              </View>

              <Animated.View style={[styles.trend, { opacity: heroReveal }]}>
                <View style={styles.trendTop}>
                  <ArrowUpRight size={13} color={colors.accentDeep} />
                  <Text style={styles.trendPct}>{weeklyStats.trendPct}%</Text>
                </View>
                <Text style={styles.trendLabel}>vs last week</Text>
              </Animated.View>
            </View>

            <View style={styles.statStrip}>
              <HeroStat value={weeklyStats.meetings} label="Meetings" delay={150} />
              <View style={styles.statDivider} />
              <HeroStat value={weeklyStats.decisions} label="Decisions" delay={240} />
              <View style={styles.statDivider} />
              <HeroStat value={openActions} label="Open" delay={330} />
              <View style={styles.statDivider} />
              <HeroStat value={weeklyStats.people} label="People" delay={420} />
            </View>
          </LinearGradient>
        </Reveal>

        {/* Commitments: follow-through ring + who owes whom */}
        <Reveal delay={90}>
          <Text style={styles.sectionLabel}>COMMITMENTS</Text>
          <View style={styles.section}>
            <Card>
              <View style={styles.commitRow}>
                <ProgressRing size={92} progress={commitmentStats.followThroughPct / 100}>
                  <AnimatedCount
                    value={commitmentStats.followThroughPct}
                    duration={900}
                    delay={250}
                    suffix="%"
                    style={styles.ringValue}
                  />
                  <Text style={styles.ringLabel}>kept</Text>
                </ProgressRing>

                <View style={styles.commitList}>
                  <View style={styles.commitItem}>
                    <View style={[styles.commitDot, { backgroundColor: colors.accent }]} />
                    <Text style={styles.commitText}>
                      You owe <Text style={styles.commitStrong}>{commitmentStats.youOweOpen}</Text>
                    </Text>
                  </View>
                  <View style={styles.commitItem}>
                    <View style={[styles.commitDot, { backgroundColor: colors.green }]} />
                    <Text style={styles.commitText}>
                      Owed to you{' '}
                      <Text style={styles.commitStrong}>{commitmentStats.theyOweOpen}</Text>
                    </Text>
                  </View>
                  <Text style={styles.commitHint}>
                    {commitmentStats.doneThisWeek} kept this week
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        </Reveal>

        {/* Activity chart */}
        <Reveal delay={180}>
          <Text style={styles.sectionLabel}>ACTIVITY</Text>
          <View style={styles.section}>
            <Card>
              <WeekBars />
            </Card>
          </View>
        </Reveal>

        {/* Top collaborators */}
        <Reveal delay={260}>
          <Text style={styles.sectionLabel}>TOP COLLABORATORS</Text>
          <View style={styles.section}>
            <Card style={{ paddingVertical: 8 }}>
              {topCollaborators.map((p, i) => (
                <View key={p.id}>
                  <Tappable onPress={() => router.push(`/person/${p.id}`)}>
                    <View style={styles.collabRow}>
                      <View style={[styles.collabAvatar, { backgroundColor: p.color }]}>
                        <Text style={styles.collabInitial}>{p.initial}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.collabName}>{p.name}</Text>
                        <Text style={styles.collabRole}>{p.role}</Text>
                      </View>
                      <Text style={styles.collabCount}>{p.meetings}</Text>
                      <ChevronRight size={14} color={colors.mutedIcon} />
                    </View>
                  </Tappable>
                  {i < topCollaborators.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
            </Card>
          </View>
        </Reveal>

        {/* Highlights timeline */}
        <Reveal delay={340}>
          <Text style={styles.sectionLabel}>HIGHLIGHTS</Text>
          <View style={styles.section}>
            <Card>
              {weekHighlights.map((h, i) => {
                const tone = h.kind === 'decision' ? colors.green : colors.brownDot;
                const last = i === weekHighlights.length - 1;
                return (
                  <View key={i} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View style={[styles.timelineNode, { backgroundColor: tone }]} />
                      {!last ? <View style={styles.timelineLine} /> : null}
                    </View>
                    <View style={[styles.timelineBody, !last && { paddingBottom: 18 }]}>
                      <View
                        style={[
                          styles.kindTag,
                          {
                            backgroundColor:
                              h.kind === 'decision' ? colors.chipGreenBg : colors.chipBrownBg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.kindTagText,
                            { color: h.kind === 'decision' ? colors.chipGreenText : colors.chipBrownText },
                          ]}
                        >
                          {h.kind === 'decision' ? 'DECISION' : 'KEY POINT'}
                        </Text>
                      </View>
                      <Text style={styles.highlightText}>{h.text}</Text>
                      <Text style={styles.highlightMeta}>{h.meeting}</Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        </Reveal>
      </ScrollView>
    </View>
  );
}

function HeroStat({ value, label, delay }: { value: number; label: string; delay: number }) {
  return (
    <View style={styles.stat}>
      <AnimatedCount value={value} duration={800} delay={delay} style={styles.statValue} />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Per-day activity bars; the busiest day is accented and labeled with its
 *  minutes, and a caption narrates the week's rhythm. */
function WeekBars() {
  const max = Math.max(...weeklyActivity.map((d) => d.minutes), 1);
  const busiest = weeklyActivity.find((d) => d.minutes === max);
  const heights = weeklyActivity.map((d) => Math.max((d.minutes / max) * 74, 4));
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
    <View>
      <View style={styles.barsRow}>
        {weeklyActivity.map((d, i) => {
          const isBusiest = d.minutes === max;
          return (
            <View key={d.day} style={styles.barCol}>
              <View style={styles.barSlot}>
                {isBusiest ? <Text style={styles.barValue}>{d.minutes}m</Text> : null}
                <Animated.View
                  style={[
                    styles.bar,
                    {
                      height: anims[i],
                      backgroundColor: isBusiest ? colors.accent : 'rgba(217,119,87,0.20)',
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.barDay,
                  isBusiest && { color: colors.accentDeep, fontFamily: sans('700') },
                ]}
              >
                {d.day}
              </Text>
            </View>
          );
        })}
      </View>
      {busiest ? (
        <Text style={styles.barsCaption}>
          {DAY_NAMES[busiest.day]} was your heaviest day - {busiest.minutes}m of conversation.
        </Text>
      ) : null}
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
  heroWatermark: {
    position: 'absolute',
    top: -40,
    right: -86,
    transform: [{ rotate: '-9deg' }],
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroLeft: { flex: 1 },
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
    marginTop: 8,
  },
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

  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 18,
    paddingVertical: 13,
    marginTop: 18,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontFamily: serif('600'), fontSize: 21, color: colors.inkDeep },
  statLabel: {
    fontFamily: sans('600'),
    fontSize: 10.5,
    color: colors.warmText2,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  statDivider: { width: 1, height: 26, backgroundColor: 'rgba(122,99,86,0.18)' },

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

  commitRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringValue: { fontFamily: serif('600'), fontSize: 22, color: colors.ink },
  ringLabel: { fontFamily: sans('600'), fontSize: 10.5, color: colors.muted, marginTop: 1 },
  commitList: { flex: 1, gap: 9 },
  commitItem: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  commitDot: { width: 8, height: 8, borderRadius: 8 },
  commitText: { flex: 1, fontFamily: sans('600'), fontSize: 13.5, color: colors.body },
  commitStrong: { fontFamily: sans('800'), color: colors.ink },
  commitHint: { fontFamily: sans('500'), fontSize: 12, color: colors.muted, marginTop: 2 },

  barsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  barCol: { alignItems: 'center', flex: 1, gap: 9 },
  barSlot: { height: 92, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 13, borderRadius: 7 },
  barValue: {
    fontFamily: sans('800'),
    fontSize: 10.5,
    color: colors.accentDeep,
    marginBottom: 5,
  },
  barDay: { fontFamily: sans('600'), fontSize: 11, color: colors.muted },
  barsCaption: {
    fontFamily: sans('500'),
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 14,
  },

  collabRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  collabAvatar: {
    width: 40,
    height: 40,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collabInitial: { fontFamily: sans('700'), fontSize: 14, color: colors.white },
  collabName: { fontFamily: sans('700'), fontSize: 14, letterSpacing: -0.2, color: colors.ink },
  collabRole: { fontFamily: sans('500'), fontSize: 11.5, color: colors.mutedDeep, marginTop: 1 },
  collabCount: { fontFamily: sans('800'), fontSize: 13, color: colors.accentDeep },
  divider: { height: 1, backgroundColor: '#F1EDE5' },

  timelineRow: { flexDirection: 'row', gap: 13 },
  timelineRail: { width: 10, alignItems: 'center' },
  timelineNode: { width: 9, height: 9, borderRadius: 9, marginTop: 5 },
  timelineLine: { flex: 1, width: 2, borderRadius: 2, backgroundColor: '#EFEAE0', marginTop: 4 },
  timelineBody: { flex: 1 },
  kindTag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  kindTagText: { fontFamily: sans('800'), fontSize: 9.5, letterSpacing: 0.6 },
  highlightText: { fontFamily: sans('500'), fontSize: 13.5, color: colors.body, lineHeight: 19.5 },
  highlightMeta: { fontFamily: sans('600'), fontSize: 11.5, color: colors.mutedAlt, marginTop: 4 },
});
