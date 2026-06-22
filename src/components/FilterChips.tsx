import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radii } from '@/theme/tokens';
import { sans } from '@/theme/typography';

interface FilterChipsProps {
  options: readonly string[];
  selected: string;
  onSelect: (option: string) => void;
}

/** Horizontal row of single-select pill filters. */
export default function FilterChips({ options, selected, onSelect }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
        const active = opt === selected;
        return (
          <Pressable
            key={opt}
            onPress={() => onSelect(opt)}
            style={[styles.chip, active ? styles.active : styles.idle]}
          >
            <Text style={[styles.label, { color: active ? colors.white : colors.chipNeutralText }]}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 18 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: radii.chip,
  },
  active: { backgroundColor: colors.dark },
  idle: { backgroundColor: colors.surface },
  label: { fontFamily: sans('700'), fontSize: 12.5 },
});
