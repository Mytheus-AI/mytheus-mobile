import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows } from '@/theme/tokens';
import { sans } from '@/theme/typography';
import Pill from './Pill';
import type { RecentMeeting, ChipKind } from '@/data/mock';

const CHIP_STYLE: Record<ChipKind, { bg: string; color: string }> = {
  action: { bg: colors.chipOrangeBg, color: colors.chipOrangeText },
  decision: { bg: colors.chipGreenBg, color: colors.chipGreenText },
  keypoints: { bg: colors.chipBrownBg, color: colors.chipBrownText },
};

/** A recent-meeting summary card on the Home screen. */
export default function MeetingCard({ meeting }: { meeting: RecentMeeting }) {
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{meeting.title}</Text>
        <Text style={styles.when}>{meeting.when}</Text>
      </View>
      <Text style={styles.meta}>
        {meeting.durationMin} min · {meeting.speakers} speakers
      </Text>
      <View style={styles.chips}>
        {meeting.chips.map((chip, i) => {
          const s = CHIP_STYLE[chip.kind];
          return <Pill key={i} label={chip.label} bg={s.bg} color={s.color} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 16,
    paddingHorizontal: 17,
    ...shadows.card,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    flex: 1,
    fontFamily: sans('700'),
    fontSize: 15.5,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  when: {
    fontFamily: sans('600'),
    fontSize: 11.5,
    color: colors.mutedAlt,
  },
  meta: {
    fontFamily: sans('500'),
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
  },
  chips: { flexDirection: 'row', gap: 7, marginTop: 12 },
});
