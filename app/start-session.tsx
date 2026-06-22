import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, shadows } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import { Pencil, Pin, Lock, Captions, People, Sparkle } from '@/components/icons';
import RecordButton from '@/components/RecordButton';
import Waveform, { MINI_WAVE_HEIGHTS } from '@/components/Waveform';
import AppHeader from '@/components/AppHeader';
import { session } from '@/data/mock';

const CUES = [
  { Icon: Captions, label: 'Live captions' },
  { Icon: People, label: 'Speaker labels' },
  { Icon: Sparkle, label: 'Auto summary' },
];

export default function StartSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.screen}>
      <AppHeader title="New session" onBack={goBack} />

      <View style={styles.body}>
        <LinearGradient
          colors={gradients.hero.colors}
          locations={gradients.hero.locations}
          start={gradients.hero.start}
          end={gradients.hero.end}
          style={styles.hero}
        >
          {/* Top: editable title + context tags */}
          <View>
            <View style={styles.titleChip}>
              <Text style={styles.titleChipText}>{session.title}</Text>
              <Pencil size={13} color={colors.warmText4} />
            </View>
            <View style={styles.tagRow}>
              <View style={styles.tag}>
                <Pin size={11} color={colors.warmText2} />
                <Text style={styles.tagText}>{session.location}</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{session.mode}</Text>
              </View>
            </View>
          </View>

          {/* Center: the record control */}
          <View style={styles.center}>
            <RecordButton size={132} pulsing onPress={() => router.push('/live-session')} />
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.cta}>Tap to start listening</Text>
              <View style={styles.voicesRow}>
                <Waveform
                  active
                  heights={MINI_WAVE_HEIGHTS}
                  color="#A07A5E"
                  barWidth={2.5}
                  gap={2}
                  fadeByHeight={false}
                  style={{ height: 14 }}
                />
                <Text style={styles.voicesText}>3 voices nearby</Text>
              </View>
            </View>
          </View>

          {/* Bottom: what the Pod captures */}
          <View style={styles.cues}>
            {CUES.map(({ Icon, label }) => (
              <View key={label} style={styles.cue}>
                <View style={styles.cueIcon}>
                  <Icon size={14} color={colors.warmText2} />
                </View>
                <Text style={styles.cueLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={[styles.privacy, { paddingBottom: Math.max(insets.bottom, 18) + 12 }]}>
          <Lock size={13} color={colors.mutedDeep} />
          <Text style={styles.privacyText}>
            Audio is summarized on this device. Nothing is saved until you finish.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  body: { flex: 1, paddingHorizontal: 14, paddingTop: 8 },
  hero: {
    flex: 1,
    borderRadius: radii.hero,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 22,
    overflow: 'hidden',
    ...shadows.hero,
  },
  titleChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.58)',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: radii.chip,
  },
  titleChipText: { fontFamily: serif('600'), fontSize: 15, color: '#3A312C' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.45)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.chip,
  },
  tagText: { fontFamily: sans('600'), fontSize: 11.5, color: colors.warmText2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26 },
  cta: { fontFamily: serif('600'), fontSize: 20, color: colors.inkDeep },
  voicesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  voicesText: { fontFamily: sans('500'), fontSize: 12, color: colors.warmText },
  cues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 10,
  },
  cue: { flex: 1, alignItems: 'center', gap: 7 },
  cueIcon: {
    width: 30,
    height: 30,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cueLabel: { fontFamily: sans('600'), fontSize: 11, color: colors.warmText2, letterSpacing: 0.1 },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingTop: 16,
    paddingHorizontal: 8,
  },
  privacyText: {
    flex: 1,
    fontFamily: sans('600'),
    fontSize: 11.5,
    color: colors.mutedDeep,
    textAlign: 'center',
  },
});
