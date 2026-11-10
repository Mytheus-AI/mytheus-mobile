import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useDecisions } from '@/api/hooks/decisions';
import { Card, Chip, EmptyState, ErrorState, Row, Screen, Segmented, Skeleton, T } from '@/components/ui';
import { dayLabel } from '@/lib/format';
import { View } from 'react-native';

/** The decision log: what your company decided, newest first, and what replaced what. */
export default function Decisions() {
  const router = useRouter();
  const q = useDecisions();
  const [show, setShow] = useState<'current' | 'all'>('current');
  const items = useMemo(() => {
    const all = [...(q.data?.items ?? [])].sort((a, b) => (a.meeting_started_at < b.meeting_started_at ? 1 : -1));
    return show === 'current' ? all.filter((d) => d.status === 'confirmed') : all;
  }, [q.data, show]);

  return (
    <Screen
      back
      title="Decisions"
      context="Confirmed in meetings, with where each came from."
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
      header={
        <Segmented
          label="Show"
          value={show}
          onChange={setShow}
          segments={[
            { key: 'current', label: 'Current' },
            { key: 'all', label: 'Including replaced' },
          ]}
        />
      }
    >
      {q.isPending ? (
        <Skeleton lines={5} />
      ) : q.isError && !q.data ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="No decisions yet" body="When someone confirms a decision in a meeting, it is kept here." />
        </Card>
      ) : (
        <Card padded={false}>
          {items.map((d, i) => (
            <Row
              key={d.id}
              first={i === 0}
              onPress={() => router.push(`/decisions/${d.id}`)}
              accessibilityLabel={`${d.status === 'superseded' ? 'Replaced decision' : 'Decision'}: ${d.content}`}
            >
              <T variant="body" tone={d.status === 'superseded' ? 'ink3' : 'ink'}>
                {d.content}
              </T>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                {d.status === 'superseded' ? <Chip label="Replaced" tone="medium" /> : null}
                <T variant="meta">{[d.meeting_title, dayLabel(d.meeting_started_at)].filter(Boolean).join(', ')}</T>
              </View>
            </Row>
          ))}
        </Card>
      )}
    </Screen>
  );
}
