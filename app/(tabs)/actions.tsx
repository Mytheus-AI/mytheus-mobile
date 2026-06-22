import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import ScreenHeader from '@/components/ScreenHeader';
import FilterChips from '@/components/FilterChips';
import { Card } from '@/components/Card';
import Checkbox from '@/components/Checkbox';
import Pill from '@/components/Pill';
import { allActions } from '@/data/mock';

const FILTERS = ['All', 'Open', 'Done'] as const;
type Filter = (typeof FILTERS)[number];

export default function ActionsScreen() {
  const [checks, setChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(allActions.map((a) => [a.id, a.done])),
  );
  const [filter, setFilter] = useState<Filter>('All');

  const total = allActions.length;
  const doneCount = Object.values(checks).filter(Boolean).length;
  const progress = total ? doneCount / total : 0;

  const grouped = useMemo(() => {
    const visible = allActions.filter((a) => {
      if (filter === 'Open') return !checks[a.id];
      if (filter === 'Done') return checks[a.id];
      return true;
    });
    const map = new Map<string, { when: string; items: typeof allActions }>();
    for (const a of visible) {
      if (!map.has(a.meeting)) map.set(a.meeting, { when: a.when, items: [] });
      map.get(a.meeting)!.items.push(a);
    }
    return Array.from(map.entries());
  }, [filter, checks]);

  const toggle = (id: string) => setChecks((c) => ({ ...c, [id]: !c[id] }));

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Action items" subtitle="Every follow-up across your meetings" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress summary */}
        <View style={styles.summaryWrap}>
          <Card>
            <View style={styles.summaryTop}>
              <View>
                <Text style={styles.summaryValue}>
                  {total - doneCount} <Text style={styles.summaryUnit}>open</Text>
                </Text>
                <Text style={styles.summaryMeta}>{doneCount} of {total} completed</Text>
              </View>
              <View style={styles.ring}>
                <Text style={styles.ringText}>{Math.round(progress * 100)}%</Text>
              </View>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(progress * 100, 4)}%` }]} />
            </View>
          </Card>
        </View>

        <View style={{ marginBottom: 14 }}>
          <FilterChips options={FILTERS} selected={filter} onSelect={(f) => setFilter(f as Filter)} />
        </View>

        {grouped.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nothing here yet.</Text>
          </View>
        ) : (
          grouped.map(([meeting, group]) => (
            <View key={meeting} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTitle}>{meeting}</Text>
                <Text style={styles.groupWhen}>{group.when}</Text>
              </View>
              <Card style={{ gap: 14 }}>
                {group.items.map((a, i) => (
                  <View key={a.id}>
                    <View style={styles.row}>
                      <Checkbox checked={!!checks[a.id]} onToggle={() => toggle(a.id)} />
                      <Text style={[styles.text, checks[a.id] && styles.done]}>{a.text}</Text>
                      <Pill label={a.owner} bg={colors.chipNeutralBg} color={colors.chipNeutralText} />
                    </View>
                    {i < group.items.length - 1 ? <View style={styles.divider} /> : null}
                  </View>
                ))}
              </Card>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flex: 1, paddingTop: 14 },
  summaryWrap: { marginHorizontal: 14, marginBottom: 16 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryValue: { fontFamily: serif('600'), fontSize: 30, color: colors.ink, letterSpacing: -0.5 },
  summaryUnit: { fontFamily: sans('600'), fontSize: 15, color: colors.muted },
  summaryMeta: { fontFamily: sans('500'), fontSize: 12.5, color: colors.muted, marginTop: 2 },
  ring: {
    width: 52,
    height: 52,
    borderRadius: 52,
    borderWidth: 4,
    borderColor: colors.chipOrangeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: { fontFamily: sans('800'), fontSize: 13, color: colors.accentDeep },
  track: {
    height: 7,
    borderRadius: 7,
    backgroundColor: '#EDE8DF',
    marginTop: 16,
    overflow: 'hidden',
  },
  fill: { height: 7, borderRadius: 7, backgroundColor: colors.accent },
  group: { marginHorizontal: 14, marginBottom: 16 },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  groupTitle: { fontFamily: sans('700'), fontSize: 13, color: colors.bodySoft, letterSpacing: -0.1 },
  groupWhen: { fontFamily: sans('600'), fontSize: 11.5, color: colors.mutedAlt },
  row: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  text: { flex: 1, fontFamily: sans('500'), fontSize: 13.5, color: colors.body, lineHeight: 18.5 },
  done: { textDecorationLine: 'line-through', color: colors.muted },
  divider: { height: 1, backgroundColor: '#F1EDE5', marginTop: 14 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: sans('500'), fontSize: 14, color: colors.muted },
});
