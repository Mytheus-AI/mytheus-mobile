import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useInbox, useNotificationStatus, useReviewCandidate, type InboxArm } from '@/api/hooks/inbox';
import { AnswerSheet } from '@/components/feature/AnswerSheet';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  PartialNotice,
  Screen,
  Segmented,
  Skeleton,
  T,
  priorityLabel,
  priorityTone,
  useToast,
} from '@/components/ui';
import { filterInbox, type InboxFilter, type InboxItem, type StatusRequestView } from '@/lib/inbox';
import { ago, dayLabel } from '@/lib/format';
import { appRoute } from '@/lib/routes';
import { useTheme } from '@/theme';

const ARM_LABEL: Record<InboxArm, string> = {
  notifications: 'your notifications',
  updates: 'the updates you owe',
  review: 'what needs review',
};

/**
 * Everything waiting on you in one list: your agent's alerts and reminders, the status updates you
 * owe, and decisions and actions your agents detected that nobody has confirmed. Same merge, order
 * and counts as the web Inbox.
 */
export default function Inbox() {
  const inbox = useInbox();
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [answering, setAnswering] = useState<StatusRequestView | null>(null);
  const items = filterInbox(inbox.items, filter);
  const open = items.filter((i) => i.open);
  const earlier = items.filter((i) => !i.open);

  return (
    <Screen
      title="Inbox"
      context={inbox.loading ? null : inbox.counts.all ? `${inbox.counts.all} waiting on you` : 'You are all caught up'}
      onRefresh={inbox.refetch}
      refreshing={inbox.refreshing}
      header={
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          segments={[
            { key: 'all', label: 'All', count: inbox.counts.all },
            { key: 'review', label: 'Review', count: inbox.counts.review },
            { key: 'updates', label: 'Updates', count: inbox.counts.updates },
            { key: 'notifications', label: 'Alerts', count: inbox.counts.notifications },
          ]}
        />
      }
    >
      {inbox.failed.length ? (
        <PartialNotice
          text={`Some of your inbox could not be loaded: ${inbox.failed.map((a) => ARM_LABEL[a]).join(', ')}.`}
          onRetry={inbox.refetch}
        />
      ) : null}

      {inbox.loading ? (
        <Skeleton lines={4} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title={filter === 'all' ? 'Nothing is waiting on you' : 'Nothing here'}
            body="Alerts from your agent, updates you owe and decisions to confirm land here."
          />
        </Card>
      ) : (
        <>
          {open.map((item) => (
            <InboxCard key={item.key} item={item} onAnswer={setAnswering} />
          ))}
          {earlier.length ? (
            <T variant="label" style={{ marginTop: 12 }}>
              Earlier
            </T>
          ) : null}
          {earlier.map((item) => (
            <InboxCard key={item.key} item={item} onAnswer={setAnswering} />
          ))}
        </>
      )}
      <AnswerSheet request={answering} onClose={() => setAnswering(null)} />
    </Screen>
  );
}

function InboxCard({ item, onAnswer }: { item: InboxItem; onAnswer: (u: StatusRequestView) => void }) {
  const p = useTheme();
  const router = useRouter();
  const toast = useToast();
  const status = useNotificationStatus();
  const review = useReviewCandidate();

  if (item.kind === 'notification') {
    const n = item.notification;
    const route = appRoute(n.href);
    return (
      <Card style={{ gap: 8, opacity: n.unread ? 1 : 0.85 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip label={n.unread ? priorityLabel(n.priority) : 'Read'} tone={n.unread ? priorityTone(n.priority) : 'neutral'} />
          <T variant="meta">{ago(n.createdAt)}</T>
        </View>
        <T variant="body" weight="600" tone="ink">
          {n.title}
        </T>
        {n.body ? <T variant="secondary">{n.body}</T> : null}
        {n.quote ? <T variant="quote">{n.quote}</T> : null}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {route ? (
            <Button
              small
              label={n.linkLabel}
              variant="outline"
              onPress={() => {
                if (n.unread) void status.run({ id: n.id, status: 'read' }).catch(() => undefined);
                router.push(route as never);
              }}
            />
          ) : null}
          {n.unread ? (
            <Button small variant="ghost" label="Mark read" onPress={() => void status.run({ id: n.id, status: 'read' }).catch(() => toast({ text: 'That did not save. Try again.', tone: 'error' }))} />
          ) : null}
          <Button
            small
            variant="ghost"
            label="Dismiss"
            onPress={() =>
              void status
                .run({ id: n.id, status: 'dismissed' })
                .then(() => toast({ text: 'Notification dismissed' }))
                .catch(() => toast({ text: 'That did not save. Try again.', tone: 'error' }))
            }
          />
        </View>
      </Card>
    );
  }

  if (item.kind === 'update') {
    const u = item.update;
    return (
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip label={item.priority === 1 ? 'Meeting soon' : 'Update owed'} tone={priorityTone(item.priority)} />
          {u.meetingStart ? <T variant="meta">Before {dayLabel(u.meetingStart)}</T> : null}
        </View>
        <T variant="body" weight="600" tone="ink">
          How is this going?
        </T>
        <T variant="quote">{u.actionTitle}</T>
        <T variant="secondary">Asked for {u.meetingTitle}.</T>
        <Button small label="Answer" onPress={() => onAnswer(u)} style={{ marginTop: 4 }} />
      </Card>
    );
  }

  const r = item.review;
  const noun = r.kind === 'decision' ? 'Decision' : 'Action';
  const act = (outcome: 'confirm' | 'dismiss') =>
    void review
      .run({ kind: r.kind, id: r.id, outcome })
      .then(() => toast({ text: `${noun} ${outcome === 'confirm' ? 'confirmed' : 'dismissed'}` }))
      .catch(() => toast({ text: `The ${noun.toLowerCase()} could not be ${outcome === 'confirm' ? 'confirmed' : 'dismissed'}. Try again.`, tone: 'error' }));
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Chip label={`${noun} to confirm`} tone={priorityTone(item.priority)} />
        <T variant="meta">{ago(r.created_at)}</T>
      </View>
      <T variant="body" tone="ink">
        {r.content}
      </T>
      {r.meeting_title ? (
        <T variant="meta" style={{ color: p.ink3 }}>
          Detected in {r.meeting_title}
        </T>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <Button small label={`Confirm ${noun.toLowerCase()}`} busy={review.isPending} onPress={() => act('confirm')} />
        <Button small variant="ghost" label="Dismiss" onPress={() => act('dismiss')} />
        <Button small variant="ghost" label="Open meeting" onPress={() => router.push(`/meetings/${r.meeting_id}`)} />
      </View>
    </Card>
  );
}
