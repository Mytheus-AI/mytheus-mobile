import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme/tokens';
import { sans } from '@/theme/typography';
import { Card, SectionLabel } from './Card';

/** "Key points" card: a short bulleted list of takeaways. */
export function KeyPointsCard({ points }: { points: string[] }) {
  return (
    <Card>
      <SectionLabel dot={colors.brownDot} label="KEY POINTS" />
      <View style={{ gap: 9, marginTop: 11 }}>
        {points.map((p, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={styles.bulletText}>{p}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** "Decision" card: a single resolved decision with a check badge. */
export function DecisionCard({
  text,
  emphasis,
  withBadge = true,
}: {
  text: string;
  emphasis?: string;
  withBadge?: boolean;
}) {
  const parts = emphasis ? text.split(emphasis) : [text];
  return (
    <Card>
      <SectionLabel dot={colors.green} label="DECISION" />
      <View style={[styles.decisionRow, { marginTop: 11 }]}>
        {withBadge ? (
          <View style={styles.badge}>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path
                d="M5 12.5 10 17.5 19 7"
                stroke={colors.green}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        ) : null}
        <Text style={styles.decisionText}>
          {emphasis ? (
            <>
              {parts[0]}
              <Text style={styles.strong}>{emphasis}</Text>
              {parts[1]}
            </>
          ) : (
            text
          )}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#D8CFC2',
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontFamily: sans('500'),
    fontSize: 13.5,
    color: colors.body,
    lineHeight: 19.5,
  },
  decisionRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: colors.chipGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  decisionText: {
    flex: 1,
    fontFamily: sans('600'),
    fontSize: 14,
    color: '#2B2825',
    lineHeight: 19.6,
  },
  strong: { fontFamily: sans('800') },
});
