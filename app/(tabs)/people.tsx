import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/tokens';
import { sans } from '@/theme/typography';
import ScreenHeader from '@/components/ScreenHeader';
import SearchBar from '@/components/SearchBar';
import FilterChips from '@/components/FilterChips';
import PersonCard from '@/components/PersonCard';
import BrandMark from '@/components/BrandMark';
import Reveal from '@/components/Reveal';
import Tappable from '@/components/Tappable';
import { commitmentStats, getPersonCommitments, people, type Person } from '@/data/mock';

const FILTERS = ['All', 'You owe', 'Owes you'] as const;

export default function PeopleScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('All');

  const { needsAttention, upToDate } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (p: Person) => {
      const { youOwe, theyOwe } = getPersonCommitments(p.id);
      if (filter === 'You owe' && youOwe.length === 0) return false;
      if (filter === 'Owes you' && theyOwe.length === 0) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    };
    const shown = people.filter(matches);
    return {
      needsAttention: shown.filter((p) => {
        const c = getPersonCommitments(p.id);
        return c.youOwe.length + c.theyOwe.length > 0;
      }),
      upToDate: shown.filter((p) => {
        const c = getPersonCommitments(p.id);
        return c.youOwe.length + c.theyOwe.length === 0;
      }),
    };
  }, [query, filter]);

  const empty = needsAttention.length === 0 && upToDate.length === 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="People"
        subtitle={`${people.length} people · you owe ${commitmentStats.youOweOpen} · owed ${commitmentStats.theyOweOpen}`}
      />

      <View style={styles.search}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search people or roles" />
      </View>

      <View style={styles.filters}>
        <FilterChips options={FILTERS} selected={filter} onSelect={setFilter} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {empty ? (
          <View style={styles.empty}>
            <BrandMark width={90} color={colors.mutedIcon} strokeWidth={7} />
            <Text style={styles.emptyText}>
              {query ? `No matches for "${query}".` : 'No one to show here.'}
            </Text>
          </View>
        ) : (
          <>
            {needsAttention.length > 0 ? (
              <Reveal>
                <Text style={styles.groupLabel}>NEEDS ATTENTION</Text>
                <View style={styles.list}>
                  {needsAttention.map((p) => (
                    <Tappable key={p.id} onPress={() => router.push(`/person/${p.id}`)}>
                      <PersonCard person={p} />
                    </Tappable>
                  ))}
                </View>
              </Reveal>
            ) : null}

            {upToDate.length > 0 ? (
              <Reveal delay={110}>
                <Text style={styles.groupLabel}>UP TO DATE</Text>
                <View style={styles.list}>
                  {upToDate.map((p) => (
                    <Tappable key={p.id} onPress={() => router.push(`/person/${p.id}`)}>
                      <PersonCard person={p} />
                    </Tappable>
                  ))}
                </View>
              </Reveal>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  search: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  filters: { marginBottom: 4 },
  scroll: { flex: 1 },
  groupLabel: {
    fontFamily: sans('800'),
    fontSize: 11.5,
    letterSpacing: 0.9,
    color: colors.mutedLabel,
    marginTop: 16,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  list: { marginHorizontal: 14, gap: 11 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 16 },
  emptyText: { fontFamily: sans('500'), fontSize: 14, color: colors.muted },
});
