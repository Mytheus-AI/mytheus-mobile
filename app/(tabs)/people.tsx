import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { sans } from '@/theme/typography';
import ScreenHeader from '@/components/ScreenHeader';
import SearchBar from '@/components/SearchBar';
import PersonCard from '@/components/PersonCard';
import { people } from '@/data/mock';

export default function PeopleScreen() {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="People" subtitle={`${people.length} people across your meetings`} />

      <View style={styles.search}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search people or roles" />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No matches for &quot;{query}&quot;.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {results.map((p) => (
              <PersonCard key={p.id} person={p} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  search: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  scroll: { flex: 1, paddingTop: 10 },
  list: { marginHorizontal: 14, gap: 11 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: sans('500'), fontSize: 14, color: colors.muted },
});
