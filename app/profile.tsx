import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, shadows } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import {
  Bell,
  Captions,
  ChevronRight,
  Lock,
  Mic,
  SignOut,
  Sparkle,
} from '@/components/icons';
import AppHeader from '@/components/AppHeader';
import BrandMark from '@/components/BrandMark';
import { Card } from '@/components/Card';
import Tappable from '@/components/Tappable';
import { allMeetings, currentUser, weeklyStats } from '@/data/mock';
import { useSessionActions } from '@/lib/session';

const totalMinutes = allMeetings.reduce((n, m) => n + m.durationMin, 0);
const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

interface PrefRow {
  icon: React.ReactNode;
  label: string;
  hint: string;
}

const PREFS: PrefRow[] = [
  { icon: <Bell size={16} color={colors.warmText2} />, label: 'Notifications', hint: 'Nudges on' },
  { icon: <Mic size={15} color={colors.warmText2} />, label: 'Recording & audio', hint: 'Auto-stop 5m' },
  { icon: <Captions size={15} color={colors.warmText2} />, label: 'Live captions', hint: 'English' },
  { icon: <Sparkle size={15} color={colors.warmText2} />, label: 'Summary style', hint: 'Concise' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const { signOut } = useSessionActions();

  const onSignOut = async () => {
    // Clerk clears the session and the secure-store cache. Navigating first would leave the
    // sign-in screen briefly holding a live session, and the tab guard would bounce back.
    await signOut();
    router.replace('/sign-in');
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Profile" onBack={goBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity hero */}
        <LinearGradient
          colors={gradients.hero.colors}
          locations={gradients.hero.locations}
          start={gradients.hero.start}
          end={gradients.hero.end}
          style={styles.hero}
        >
          <View style={styles.heroWatermark} pointerEvents="none">
            <BrandMark width={280} color="rgba(255,255,255,0.32)" strokeWidth={7} />
          </View>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{currentUser.initials}</Text>
            </View>
          </View>
          <Text style={styles.name}>{currentUser.name}</Text>
          <Text style={styles.role}>
            {currentUser.role} · {currentUser.org}
          </Text>
          <Text style={styles.email}>{currentUser.email}</Text>

          <View style={styles.statStrip}>
            <Stat value={`${totalHours}h`} label="Captured" />
            <View style={styles.statDivider} />
            <Stat value={String(weeklyStats.meetings)} label="Meetings" />
            <View style={styles.statDivider} />
            <Stat value={`${currentUser.weekStreak}w`} label="Streak" />
          </View>
        </LinearGradient>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.section}>
          <Card style={{ paddingVertical: 6 }}>
            {PREFS.map((p, i) => (
              <View key={p.label}>
                <View style={styles.prefRow}>
                  <View style={styles.prefIcon}>{p.icon}</View>
                  <Text style={styles.prefLabel}>{p.label}</Text>
                  <Text style={styles.prefHint}>{p.hint}</Text>
                  <ChevronRight size={14} color={colors.mutedIcon} />
                </View>
                {i < PREFS.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </Card>
        </View>

        {/* Workspace */}
        <Text style={styles.sectionLabel}>WORKSPACE</Text>
        <View style={styles.section}>
          <Card>
            <View style={styles.workspaceRow}>
              <View style={styles.prefIcon}>
                <Lock size={14} color={colors.warmText2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefLabel}>{currentUser.org}</Text>
                <Text style={styles.workspaceHint}>
                  Provisioned by your company · member since {currentUser.memberSince}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Sign out */}
        <View style={[styles.section, { marginTop: 26 }]}>
          <Tappable onPress={onSignOut}>
            <View style={styles.signOut}>
              <SignOut size={16} color={colors.accentDeep} />
              <Text style={styles.signOutText}>Sign out</Text>
            </View>
          </Tappable>
        </View>

        <Text style={styles.version}>Mytheus 0.1.0</Text>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flex: 1, paddingTop: 6 },

  hero: {
    marginHorizontal: 14,
    borderRadius: radii.hero,
    paddingTop: 26,
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    overflow: 'hidden',
    ...shadows.hero,
  },
  heroWatermark: {
    position: 'absolute',
    top: -30,
    right: -90,
    transform: [{ rotate: '-9deg' }],
  },
  avatarWrap: { borderRadius: 80, padding: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 72,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: sans('700'), fontSize: 26, color: colors.white },
  name: {
    fontFamily: serif('600'),
    fontSize: 24,
    letterSpacing: -0.3,
    color: colors.inkDeep,
    marginTop: 14,
  },
  role: { fontFamily: sans('500'), fontSize: 13, color: colors.warmText, marginTop: 4 },
  email: { fontFamily: sans('500'), fontSize: 12, color: colors.warmLabelOnPeach, marginTop: 2 },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 18,
    paddingVertical: 14,
    marginTop: 20,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontFamily: serif('600'), fontSize: 22, color: colors.inkDeep },
  statLabel: {
    fontFamily: sans('600'),
    fontSize: 11,
    color: colors.warmText2,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(122,99,86,0.18)' },

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

  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  prefIcon: {
    width: 32,
    height: 32,
    borderRadius: 32,
    backgroundColor: colors.chipNeutralBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefLabel: { flex: 1, fontFamily: sans('600'), fontSize: 14, color: colors.ink },
  prefHint: { fontFamily: sans('500'), fontSize: 12, color: colors.muted },
  divider: { height: 1, backgroundColor: '#F1EDE5' },

  workspaceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  workspaceHint: { fontFamily: sans('500'), fontSize: 12, color: colors.muted, marginTop: 2 },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 15,
    ...shadows.card,
  },
  signOutText: { fontFamily: sans('700'), fontSize: 14.5, color: colors.accentDeep },

  version: {
    fontFamily: sans('600'),
    fontSize: 11.5,
    color: colors.mutedLabel,
    textAlign: 'center',
    marginTop: 22,
  },
});
