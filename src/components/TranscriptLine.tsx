import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { sans } from '@/theme/typography';
import StreamingDots from './StreamingDots';
import type { TranscriptLineData } from '@/data/mock';

interface TranscriptLineProps {
  line: TranscriptLineData;
  /** Whether the streaming dots animate (the room is actively being heard). */
  streaming?: boolean;
}

/** One speaker-attributed transcript bubble with avatar, name, time, text. */
export default function TranscriptLine({ line, streaming = false }: TranscriptLineProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: line.color }]}>
        <Text style={styles.avatarText}>{line.initial}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={styles.name}>{line.name}</Text>
          <Text style={[styles.time, line.time === 'now' && { color: colors.accentDeep }]}>
            {line.time}
          </Text>
        </View>
        <Text style={styles.text}>
          {line.text}
          {line.partial ? <StreamingDots visible={streaming} /> : null}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: sans('700'), fontSize: 11, color: colors.white },
  body: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  name: { fontFamily: sans('700'), fontSize: 12.5, color: colors.ink },
  time: { fontFamily: sans('500'), fontSize: 10.5, color: colors.mutedAlt },
  text: {
    fontFamily: sans('500'),
    fontSize: 13.5,
    color: colors.bodySoft,
    lineHeight: 19.5,
    marginTop: 2,
  },
});
