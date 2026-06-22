import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, radii } from '@/theme/tokens';
import { sans } from '@/theme/typography';
import { Search } from './icons';

interface SearchBarProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}

/** Rounded search field used on the People and Library tabs. */
export default function SearchBar({ value, onChangeText, placeholder }: SearchBarProps) {
  return (
    <View style={styles.wrap}>
      <Search size={18} color={colors.mutedLabel} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.input}
        returnKeyType="search"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.surface,
    borderRadius: radii.button,
    paddingHorizontal: 14,
    height: 46,
    shadowColor: '#3C2D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  input: {
    flex: 1,
    fontFamily: sans('500'),
    fontSize: 14,
    color: colors.ink,
    padding: 0,
  },
});
