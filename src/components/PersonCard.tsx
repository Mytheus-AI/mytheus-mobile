import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows } from '@/theme/tokens';
import { sans } from '@/theme/typography';
import { ChevronRight } from './icons';
import type { Person } from '@/data/mock';

/** A teammate/speaker row: avatar, name + role, activity meta, disclosure. */
export default function PersonCard({ person }: { person: Person }) {
  const meta = [
    `${person.meetings} meetings`,
    person.openActions > 0
      ? `${person.openActions} open action${person.openActions > 1 ? 's' : ''}`
      : 'No open actions',
  ].join(' · ');

  return (
    <View style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: person.color }]}>
        <Text style={styles.avatarText}>{person.initial}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.lastMet}>{person.lastMet}</Text>
        </View>
        <Text style={styles.role}>{person.role}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <ChevronRight size={15} color={colors.mutedIcon} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: sans('700'), fontSize: 16, color: colors.white },
  body: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  name: { fontFamily: sans('700'), fontSize: 15, letterSpacing: -0.2, color: colors.ink },
  lastMet: { fontFamily: sans('600'), fontSize: 11, color: colors.mutedAlt },
  role: { fontFamily: sans('500'), fontSize: 12.5, color: colors.warmText, marginTop: 1 },
  meta: { fontFamily: sans('500'), fontSize: 11.5, color: colors.muted, marginTop: 3 },
});
