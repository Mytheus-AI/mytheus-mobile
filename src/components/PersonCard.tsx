import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows } from '@/theme/tokens';
import { sans } from '@/theme/typography';
import { Check, ChevronRight } from './icons';
import { getPersonCommitments, type Person } from '@/data/mock';

/**
 * A teammate row: avatar with an open-commitments badge, name, one compact
 * meta line, and - only when something is open - who owes whom.
 */
export default function PersonCard({ person }: { person: Person }) {
  const { youOwe, theyOwe } = getPersonCommitments(person.id);
  const open = youOwe.length + theyOwe.length;

  return (
    <View style={styles.card}>
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { backgroundColor: person.color }]}>
          <Text style={styles.avatarText}>{person.initial}</Text>
        </View>
        {open > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{open}</Text>
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
        <Text style={styles.meta} numberOfLines={1}>
          {person.role} · {person.meetings} meetings
        </Text>
        {open > 0 ? (
          <Text style={styles.commitLine} numberOfLines={1}>
            {youOwe.length > 0 ? (
              <Text style={styles.youOwe}>You owe {youOwe.length}</Text>
            ) : null}
            {youOwe.length > 0 && theyOwe.length > 0 ? (
              <Text style={styles.commitSep}> · </Text>
            ) : null}
            {theyOwe.length > 0 ? (
              <Text style={styles.theyOwe}>
                Owes you {theyOwe.length}
              </Text>
            ) : null}
          </Text>
        ) : (
          <View style={styles.upToDateRow}>
            <Check size={9} color={colors.green} />
            <Text style={styles.upToDate}>Up to date</Text>
          </View>
        )}
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
    paddingVertical: 13,
    paddingHorizontal: 15,
    ...shadows.card,
  },
  avatarWrap: { width: 46, height: 46 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: sans('700'), fontSize: 15.5, color: colors.white },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 19,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: sans('800'), fontSize: 10, color: colors.white },
  body: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontFamily: sans('700'), fontSize: 15, letterSpacing: -0.2, color: colors.ink },
  lastMet: { fontFamily: sans('600'), fontSize: 11, color: colors.mutedAlt },
  meta: { fontFamily: sans('500'), fontSize: 12.5, color: colors.mutedDeep, marginTop: 2 },
  commitLine: { fontSize: 12, marginTop: 5 },
  youOwe: { fontFamily: sans('700'), fontSize: 12, color: colors.accentDeep },
  commitSep: { fontFamily: sans('600'), fontSize: 12, color: colors.muted },
  theyOwe: { fontFamily: sans('700'), fontSize: 12, color: colors.green },
  upToDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  upToDate: { fontFamily: sans('600'), fontSize: 12, color: colors.green },
});
