import React, { useMemo } from 'react';
import { useMeetings } from '@/api/hooks/meetings';
import { Button, Card, EmptyState, ErrorState, Screen, SectionTitle, Skeleton } from '@/components/ui';
import { MeetingRow } from '@/components/feature/MeetingRow';
import { groupMeetings } from '@/lib/meetings';
import type { Meeting } from '@/api/types';

/** Your meetings: live now, coming up, and past ones with what was decided. */
export default function Meetings() {
  const q = useMeetings();
  const all = useMemo(() => q.data?.pages.flatMap((pg) => pg.items) ?? [], [q.data]);
  const groups = useMemo(() => groupMeetings(all), [all]);

  return (
    <Screen title="Meetings" context="Join from your phone, or catch up on what happened." onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isPending ? (
        <Skeleton lines={5} />
      ) : q.isError && !q.data ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : all.length === 0 ? (
        <Card>
          <EmptyState title="No meetings yet" body="Meetings you are invited to show up here. Schedule one on the web." />
        </Card>
      ) : (
        <>
          {groups.live.length ? <Group title="Live now" items={groups.live} /> : null}
          {groups.upcoming.length ? <Group title="Coming up" items={groups.upcoming} /> : null}
          {groups.past.length ? <Group title="Past" items={groups.past} /> : null}
          {q.hasNextPage ? (
            <Button label="Show older meetings" variant="outline" busy={q.isFetchingNextPage} onPress={() => void q.fetchNextPage()} />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Group({ title, items }: { title: string; items: Meeting[] }) {
  return (
    <>
      <SectionTitle title={title} />
      <Card padded={false}>
        {items.map((m, i) => (
          <MeetingRow key={m.id} meeting={m} first={i === 0} />
        ))}
      </Card>
    </>
  );
}
