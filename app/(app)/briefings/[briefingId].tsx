import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useBriefing, useBriefingPreferences } from '@/api/hooks/briefings';
import { Card, EmptyState, ErrorState, Screen, Skeleton } from '@/components/ui';
import { BriefingFull, BriefingPanel } from '@/components/feature/Briefing';

/** One briefing from your agent: where its push lands (`/briefings/{id}`). Lock-screen friendly:
    big controls, and the voice keeps playing when the phone locks. */
export default function BriefingScreen() {
  const { briefingId } = useLocalSearchParams<{ briefingId: string }>();
  const id = String(briefingId ?? '');
  const briefing = useBriefing(id);
  const prefs = useBriefingPreferences();
  const b = briefing.data;

  if (briefing.isPending) {
    return (
      <Screen back title="Your briefing">
        <Skeleton lines={5} />
      </Screen>
    );
  }
  if (!b) {
    const missing = briefing.error && 'code' in briefing.error && (briefing.error as { code: string }).code === 'NOT_FOUND';
    return (
      <Screen back title="Your briefing">
        {missing ? (
          <Card>
            <EmptyState title="This briefing is not available" body="It may have been removed. Your Myte can brief you again from Home." />
          </Card>
        ) : (
          <ErrorState title="Your briefing could not be loaded" onRetry={() => void briefing.refetch()} />
        )}
      </Screen>
    );
  }
  return (
    <Screen back title="Your briefing" onRefresh={() => void briefing.refetch()} refreshing={briefing.isRefetching}>
      {b.status === 'ready' ? (
        <BriefingFull briefing={b} prefs={prefs.data ?? null} />
      ) : (
        <BriefingPanel briefing={b} prefs={prefs.data ?? null} meetingId={b.meeting_id ?? null} canRequest={false} />
      )}
    </Screen>
  );
}
