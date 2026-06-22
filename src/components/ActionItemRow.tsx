import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '@/theme/tokens';
import { sans } from '@/theme/typography';
import Checkbox from './Checkbox';
import type { ActionItem } from '@/data/mock';

interface ActionItemRowProps {
  item: ActionItem;
  checked: boolean;
  onToggle: () => void;
}

/** A single action item: checkbox, text, and the owner chip. */
export default function ActionItemRow({ item, checked, onToggle }: ActionItemRowProps) {
  return (
    <View style={styles.row}>
      <Checkbox checked={checked} onToggle={onToggle} />
      <Text style={[styles.text, checked && styles.done]}>{item.text}</Text>
      <View style={styles.owner}>
        <Text style={styles.ownerText}>{item.owner}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  text: {
    flex: 1,
    fontFamily: sans('500'),
    fontSize: 13.5,
    color: colors.body,
    lineHeight: 18.2,
  },
  done: {
    textDecorationLine: 'line-through',
    color: colors.muted,
  },
  owner: {
    backgroundColor: colors.chipNeutralBg,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radii.chip,
  },
  ownerText: { fontFamily: sans('700'), fontSize: 11, color: colors.chipNeutralText },
});
