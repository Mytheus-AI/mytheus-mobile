import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { sans } from '@/theme/typography';
import ScreenHeader from '@/components/ScreenHeader';
import SearchBar from '@/components/SearchBar';
import FilterChips from '@/components/FilterChips';
import PersonCard from '@/components/PersonCard';
import Tappable from '@/components/Tappable';
import { people } from '@/data/mock';

const FILTERS = ['All', 'Open actions'] as const;

export default function PeopleScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('All');

  const totalOpen = people.reduce((n, p) => n + p.openActions, 0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (filter === 'Open actions' && p.openActions === 0) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [query, filter]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="People"
        subtitle={`${people.length} people · ${totalOpen} open actions`}
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
        {results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {query ? `No matches for "${query}".` : 'No one to show here.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {results.map((p) => (
              <Tappable key={p.id}>
                <PersonCard person={p} />
              </Tappable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  search: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  filters: { marginBottom: 8 },
  scroll: { flex: 1, paddingTop: 4 },
  list: { marginHorizontal: 14, gap: 11 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: sans('500'), fontSize: 14, color: colors.muted },
});
