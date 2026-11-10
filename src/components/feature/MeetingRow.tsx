import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, Row, T } from '@/components/ui';
import { whenLabel } from '@/lib/format';

export interface MeetingLike {
  id: string;
  title: string | null;
  status?: string | null;
  scheduled_start: string | null;
}

export function meetingTitle(m: { title?: string | null }): string {
  return m.title?.trim() || 'Untitled meeting';
}

export function statusChip(status: string | null | undefined) {
  if (status === 'live') return <Chip label="Live now" tone="high" />;
  if (status === 'cancelled') return <Chip label="Cancelled" />;
  return null;
}

/** One meeting in a list: title, when, and Live now when it is. */
export function MeetingRow({ meeting, first, meta }: { meeting: MeetingLike; first?: boolean; meta?: string | null }) {
  const router = useRouter();
  const when = whenLabel(meeting.scheduled_start) || 'No time set';
  const title = meetingTitle(meeting);
  return (
    <Row
      first={first}
      onPress={() => router.push(`/meetings/${meeting.id}`)}
      accessibilityLabel={[title, meeting.status === 'live' ? 'live now' : null, when, meta].filter(Boolean).join(', ')}
    >
      <View style={{ gap: 4 }}>
        <T variant="body" weight="600" tone="ink" numberOfLines={2}>
          {title}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {statusChip(meeting.status)}
          <T variant="meta">{when}</T>
          {meta ? <T variant="meta">{meta}</T> : null}
        </View>
      </View>
    </Row>
  );
}
