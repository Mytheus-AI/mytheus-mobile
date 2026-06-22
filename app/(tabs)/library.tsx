import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/tokens';
import { sans } from '@/theme/typography';
import ScreenHeader from '@/components/ScreenHeader';
import SearchBar from '@/components/SearchBar';
import FilterChips from '@/components/FilterChips';
import MeetingCard from '@/components/MeetingCard';
import Tappable from '@/components/Tappable';
import { librarySessions, libraryFilters, type RecentMeeting } from '@/data/mock';

export default function LibraryScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('All');

  const matches = (m: RecentMeeting) => {
    const q = query.trim().toLowerCase();
    if (q && !m.title.toLowerCase().includes(q)) return false;
    if (filter === 'In-person') return true; // all captured sessions are in-person pods
    if (filter === 'Decisions') return m.chips.some((c) => c.kind === 'decision');
    if (filter === 'Actions') return m.chips.some((c) => c.kind === 'action');
    return true;
  };

  const groups = useMemo(
    () =>
      librarySessions
        .map((g) => ({ ...g, items: g.items.filter(matches) }))
        .filter((g) => g.items.length > 0),
    [query, filter],
  );

  const count = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Library" subtitle="Every session you have captured" />

      <View style={styles.search}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search sessions" />
      </View>

      <View style={styles.filters}>
        <FilterChips options={libraryFilters} selected={filter} onSelect={setFilter} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {count === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No sessions match your filters.</Text>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.label} style={styles.group}>
              <Text style={styles.groupLabel}>{g.label.toUpperCase()}</Text>
              <View style={styles.list}>
                {g.items.map((m) => (
                  <Tappable key={m.id} onPress={() => router.push('/recap')}>
                    <MeetingCard meeting={m} />
                  </Tappable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  search: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  filters: { marginBottom: 6 },
  scroll: { flex: 1, paddingTop: 6 },
  group: { marginBottom: 18 },
  groupLabel: {
    fontFamily: sans('800'),
    fontSize: 11.5,
    letterSpacing: 0.9,
    color: colors.mutedLabel,
    marginHorizontal: 18,
    marginBottom: 11,
  },
  list: { marginHorizontal: 14, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: sans('500'), fontSize: 14, color: colors.muted },
});
