import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, shadows } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import { Sparkle, Mic, Chart, ChevronRight } from '@/components/icons';
import ScreenHeader from '@/components/ScreenHeader';
import MeetingCard from '@/components/MeetingCard';
import Tappable from '@/components/Tappable';
import Reveal from '@/components/Reveal';
import BrandMark from '@/components/BrandMark';
import { introEntranceDelay } from '@/components/BrandIntro';
import { recentMeetings, weeklyStats } from '@/data/mock';

/** Gentle breathing loop on the mic so the hero invites a tap. */
function MicPulse() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Mic size={16} color={colors.white} />
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  // On cold start the intro overlay owns the first moment; sections rise into
  // view as it lifts. On later mounts the delay collapses to zero.
  const baseDelay = useRef(introEntranceDelay()).current;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        greeting="Good afternoon"
        title="Your meetings"
        brand
        right={
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>JL</Text>
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Reveal delay={baseDelay}>
          <LinearGradient
            colors={gradients.hero.colors}
            locations={gradients.hero.locations}
            start={gradients.hero.start}
            end={gradients.hero.end}
            style={styles.hero}
          >
            <View style={styles.heroWatermark} pointerEvents="none">
              <BrandMark width={300} color="rgba(255,255,255,0.34)" strokeWidth={7} />
            </View>
            <View style={styles.podBadge}>
              <Sparkle size={11} color={colors.accentDeep} />
              <Text style={styles.podBadgeText}>MEETING POD</Text>
            </View>
            <Text style={styles.heroTitle}>Start listening</Text>
            <Text style={styles.heroSub}>
              Set your phone on the table - I&apos;ll capture the room and summarize as you
              talk.
            </Text>
            <Tappable scaleTo={0.96} onPress={() => router.push('/start-session')}>
              <View style={styles.recordBtn}>
                <MicPulse />
                <Text style={styles.recordBtnText}>Tap to record</Text>
              </View>
            </Tappable>
          </LinearGradient>
        </Reveal>

        {/* Week in review */}
        <Reveal delay={baseDelay + 110}>
          <Tappable style={styles.banner} onPress={() => router.push('/insights')}>
            <View style={styles.bannerIcon}>
              <Chart size={17} color={colors.accentDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Your week in review</Text>
              <Text style={styles.bannerSub}>
                {weeklyStats.meetings} meetings · {weeklyStats.decisions} decisions ·{' '}
                {weeklyStats.actionsTotal - weeklyStats.actionsDone} open
              </Text>
            </View>
            <ChevronRight size={15} color={colors.mutedIcon} />
          </Tappable>
        </Reveal>

        <Reveal delay={baseDelay + 220}>
          <Text style={styles.sectionLabel}>RECENT</Text>

          <View style={styles.list}>
            {recentMeetings.map((m) => (
              <Tappable key={m.id} onPress={() => router.push('/recap')}>
                <MeetingCard meeting={m} />
              </Tappable>
            ))}
          </View>
        </Reveal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 42,
    backgroundColor: colors.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: sans('800'), fontSize: 14, color: colors.avatarText },
  scroll: { flex: 1, paddingTop: 10 },
  hero: {
    marginHorizontal: 14,
    borderRadius: radii.hero,
    padding: 20,
    overflow: 'hidden',
    ...shadows.hero,
  },
  heroWatermark: {
    position: 'absolute',
    top: -34,
    right: -84,
    transform: [{ rotate: '-9deg' }],
  },
  podBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.52)',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: radii.chip,
  },
  podBadgeText: {
    fontFamily: sans('800'),
    fontSize: 10.5,
    letterSpacing: 0.7,
    color: colors.warmText3,
  },
  heroTitle: {
    fontFamily: serif('600'),
    fontSize: 26,
    letterSpacing: -0.3,
    color: colors.inkDeep,
    marginTop: 13,
  },
  heroSub: {
    fontFamily: sans('500'),
    fontSize: 13,
    color: colors.warmText,
    lineHeight: 18.8,
    marginTop: 5,
  },
  recordBtn: {
    marginTop: 18,
    backgroundColor: colors.dark,
    borderRadius: radii.button,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    ...shadows.darkButton,
  },
  recordBtnText: { fontFamily: sans('700'), fontSize: 15, color: colors.white },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  bannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 38,
    backgroundColor: colors.chipOrangeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { fontFamily: sans('700'), fontSize: 14.5, letterSpacing: -0.2, color: colors.ink },
  bannerSub: { fontFamily: sans('500'), fontSize: 12, color: colors.muted, marginTop: 2 },
  sectionLabel: {
    fontFamily: sans('800'),
    fontSize: 11.5,
    letterSpacing: 0.9,
    color: colors.mutedLabel,
    marginTop: 24,
    marginHorizontal: 18,
    marginBottom: 11,
  },
  list: { marginHorizontal: 14, gap: 12 },
});
