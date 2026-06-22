import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, shadows } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import { Sparkle, Mic } from '@/components/icons';
import MeetingCard from '@/components/MeetingCard';
import BottomNav from '@/components/BottomNav';
import { recentMeetings } from '@/data/mock';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View>
          <Text style={styles.greeting}>Good afternoon</Text>
          <Text style={styles.heading}>Your meetings</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>JL</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* CTA hero */}
        <LinearGradient
          colors={gradients.hero.colors}
          locations={gradients.hero.locations}
          start={gradients.hero.start}
          end={gradients.hero.end}
          style={styles.hero}
        >
          <View style={styles.podBadge}>
            <Sparkle size={11} color={colors.accentDeep} />
            <Text style={styles.podBadgeText}>MEETING POD</Text>
          </View>
          <Text style={styles.heroTitle}>Start listening</Text>
          <Text style={styles.heroSub}>
            Set your phone on the table - I&apos;ll capture the room and summarize as you
            talk.
          </Text>
          <Pressable style={styles.recordBtn} onPress={() => router.push('/start-session')}>
            <Mic size={16} color={colors.white} />
            <Text style={styles.recordBtnText}>Tap to record</Text>
          </Pressable>
        </LinearGradient>

        <Text style={styles.sectionLabel}>RECENT</Text>

        <View style={styles.list}>
          {recentMeetings.map((m) => (
            <Pressable key={m.id} onPress={() => router.push('/recap')}>
              <MeetingCard meeting={m} />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  greeting: { fontFamily: sans('500'), fontSize: 13, color: colors.mutedLabel },
  heading: {
    fontFamily: serif('600'),
    fontSize: 24,
    letterSpacing: -0.3,
    color: colors.ink,
    marginTop: 1,
  },
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
