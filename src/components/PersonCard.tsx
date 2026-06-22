import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows } from '@/theme/tokens';
import { sans } from '@/theme/typography';
import { ChevronRight } from './icons';
import Pill from './Pill';
import type { Person } from '@/data/mock';

/**
 * A teammate/speaker row: haloed avatar with an open-actions badge, name +
 * role, status chips, last-met, and a disclosure chevron.
 */
export default function PersonCard({ person }: { person: Person }) {
  const hasOpen = person.openActions > 0;

  return (
    <View style={styles.card}>
      <View style={styles.avatarWrap}>
        <View style={[styles.halo, { backgroundColor: person.color + '24' }]} />
        <View style={[styles.avatar, { backgroundColor: person.color }]}>
          <Text style={styles.avatarText}>{person.initial}</Text>
        </View>
        {hasOpen ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{person.openActions}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {person.name}
          </Text>
          <Text style={styles.lastMet}>{person.lastMet}</Text>
        </View>
        <Text style={styles.role}>{person.role}</Text>
        <View style={styles.chips}>
          <Pill
            label={`${person.meetings} meetings`}
            bg={colors.chipNeutralBg}
            color={colors.chipNeutralText}
          />
          {hasOpen ? (
            <Pill
              label={`${person.openActions} open`}
              bg={colors.chipOrangeBg}
              color={colors.chipOrangeText}
            />
          ) : (
            <Pill label="Up to date" bg={colors.chipGreenBg} color={colors.chipGreenText} />
          )}
        </View>
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
    paddingVertical: 15,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  avatarWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 56, height: 56, borderRadius: 56 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: sans('700'), fontSize: 16, color: colors.white },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 20,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: sans('800'), fontSize: 10.5, color: colors.white },
  body: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontFamily: sans('700'), fontSize: 15.5, letterSpacing: -0.2, color: colors.ink },
  lastMet: { fontFamily: sans('600'), fontSize: 11, color: colors.mutedAlt },
  role: { fontFamily: sans('500'), fontSize: 12.5, color: colors.mutedDeep, marginTop: 2 },
  chips: { flexDirection: 'row', gap: 7, marginTop: 9 },
});
