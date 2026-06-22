import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, shadows } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import { Sparkle, Check } from '@/components/icons';
import AppHeader from '@/components/AppHeader';
import { Card } from '@/components/Card';
import Checkbox from '@/components/Checkbox';
import Pill from '@/components/Pill';
import MeetingCard from '@/components/MeetingCard';
import Tappable from '@/components/Tappable';
import {
  getPerson,
  getPersonOpenActions,
  getPersonQuotes,
  getPersonMeetings,
} from '@/data/mock';

export default function PersonDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const person = getPerson(id ?? '');

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/people'));

  if (!person) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Profile" onBack={goBack} />
        <View style={styles.missing}>
          <Text style={styles.missingText}>This person could not be found.</Text>
        </View>
      </View>
    );
  }

  const openActions = getPersonOpenActions(person);
  const quotes = getPersonQuotes(person.id);
  const meetings = getPersonMeetings(person.id);
  const first = person.name.split(' ')[0];

  return (
    <View style={styles.screen}>
      <AppHeader title={first} onBack={goBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile hero */}
        <LinearGradient
          colors={gradients.hero.colors}
          locations={gradients.hero.locations}
          start={gradients.hero.start}
          end={gradients.hero.end}
          style={styles.hero}
        >
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: person.color }]}>
              <Text style={styles.avatarText}>{person.initial}</Text>
            </View>
          </View>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.role}>
            {person.role} · Last met {person.lastMet.toLowerCase()}
          </Text>

          <View style={styles.statStrip}>
            <Stat value={String(person.meetings)} label="Meetings" />
            <View style={styles.statDivider} />
            <Stat value={String(openActions.length)} label="Open" />
            <View style={styles.statDivider} />
            <Stat value={String(quotes.length)} label="Quotes" />
          </View>
        </LinearGradient>

        {/* Ask about this person */}
        <Tappable style={styles.askBtn} onPress={() => router.push('/ask')}>
          <Sparkle size={14} color={colors.white} />
          <Text style={styles.askText}>Ask about {first}</Text>
        </Tappable>

        {/* Open actions */}
        <Text style={styles.sectionLabel}>OPEN ACTIONS</Text>
        <View style={styles.section}>
          {openActions.length === 0 ? (
            <Card>
              <View style={styles.upToDate}>
                <View style={styles.upToDateIcon}>
                  <Check size={12} color={colors.green} />
                </View>
                <Text style={styles.upToDateText}>{first} is all caught up.</Text>
              </View>
            </Card>
          ) : (
            <Card style={{ gap: 14 }}>
              {openActions.map((a, i) => (
                <ActionRow
                  key={a.id}
                  text={a.text}
                  meeting={a.meeting}
                  last={i === openActions.length - 1}
                />
              ))}
            </Card>
          )}
        </View>

        {/* Recent quotes */}
        {quotes.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>RECENT QUOTES</Text>
            <View style={styles.section}>
              {quotes.map((q, i) => (
                <View key={i} style={styles.quoteCard}>
                  <View style={[styles.quoteBar, { backgroundColor: person.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quoteText}>{q.text}</Text>
                    <Text style={styles.quoteMeta}>
                      {q.meeting} · {q.when}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Meetings together */}
        <Text style={styles.sectionLabel}>MEETINGS TOGETHER</Text>
        <View style={[styles.section, { gap: 12 }]}>
          {meetings.map((m) => (
            <Tappable key={m.id} onPress={() => router.push('/recap')}>
              <MeetingCard meeting={m} />
            </Tappable>
          ))}
        </View>
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

function ActionRow({
  text,
  meeting,
  last,
}: {
  text: string;
  meeting: string;
  last: boolean;
}) {
  const [done, setDone] = useState(false);
  return (
    <View>
      <View style={styles.actionRow}>
        <Checkbox checked={done} onToggle={() => setDone((d) => !d)} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.actionText, done && styles.actionDone]}>{text}</Text>
          <Text style={styles.actionMeeting}>{meeting}</Text>
        </View>
      </View>
      {!last ? <View style={styles.divider} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flex: 1, paddingTop: 6 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { fontFamily: sans('500'), fontSize: 14, color: colors.muted },

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
  avatarWrap: {
    borderRadius: 80,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 72,
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

  askBtn: {
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: colors.dark,
    borderRadius: radii.button,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadows.darkButton,
  },
  askText: { fontFamily: sans('700'), fontSize: 14.5, color: colors.white },

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

  actionRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  actionText: { fontFamily: sans('500'), fontSize: 13.5, color: colors.body, lineHeight: 18.5 },
  actionDone: { textDecorationLine: 'line-through', color: colors.muted },
  actionMeeting: { fontFamily: sans('600'), fontSize: 11.5, color: colors.mutedAlt, marginTop: 3 },
  divider: { height: 1, backgroundColor: '#F1EDE5', marginTop: 14 },

  upToDate: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  upToDateIcon: {
    width: 24,
    height: 24,
    borderRadius: 24,
    backgroundColor: colors.chipGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upToDateText: { fontFamily: sans('500'), fontSize: 13.5, color: colors.body },

  quoteCard: {
    flexDirection: 'row',
    gap: 13,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginBottom: 12,
    ...shadows.card,
  },
  quoteBar: { width: 3, borderRadius: 3, alignSelf: 'stretch' },
  quoteText: { fontFamily: serif('500'), fontSize: 15, color: colors.bodySoft, lineHeight: 21 },
  quoteMeta: { fontFamily: sans('600'), fontSize: 11.5, color: colors.mutedAlt, marginTop: 8 },
});
