import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCommitments, useCompleteTask, useReopenTask, useSetCommitment, useStatusRequests, useTasks } from '@/api/hooks/work';
import { AnswerSheet } from '@/components/feature/AnswerSheet';
import { Button, Card, Chip, EmptyState, ErrorState, Row, Screen, Segmented, Skeleton, T, useToast } from '@/components/ui';
import { dayLabel, dueLabel } from '@/lib/format';
import { toStatusView, type StatusRequestView } from '@/lib/inbox';
import type { WorkTab } from '@/lib/routes';
import { radii, useTheme } from '@/theme';
import type { Commitment, Task } from '@/api/types';

/** My work: tasks assigned to you, the promises you made, and the updates you owe. */
export default function Work() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<WorkTab>(asTab(params.tab));
  useEffect(() => {
    if (params.tab) setTab(asTab(params.tab));
  }, [params.tab]);

  const tasks = useTasks('confirmed');
  const promises = useCommitments('open');
  const updates = useStatusRequests('pending');

  const refetch = () => {
    void tasks.refetch();
    void promises.refetch();
    void updates.refetch();
  };

  return (
    <Screen
      title="My work"
      context="What you took on, in meetings and outside them."
      onRefresh={refetch}
      refreshing={tasks.isRefetching || promises.isRefetching || updates.isRefetching}
      header={
        <Segmented
          label="My work"
          value={tab}
          onChange={setTab}
          segments={[
            { key: 'tasks', label: 'Tasks', count: tasks.data?.items.length },
            { key: 'promises', label: 'Promises', count: promises.data?.items.length },
            { key: 'updates', label: 'Updates', count: updates.data?.items.length },
          ]}
        />
      }
    >
      {tab === 'tasks' ? <Tasks /> : tab === 'promises' ? <Promises /> : <Updates />}
    </Screen>
  );
}

function asTab(v: string | undefined): WorkTab {
  return v === 'promises' || v === 'updates' ? v : 'tasks';
}

function Tasks() {
  const router = useRouter();
  const toast = useToast();
  const open = useTasks('confirmed');
  const done = useTasks('done');
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const [showDone, setShowDone] = useState(false);

  const reopenTask = (t: Task, announce: boolean) => {
    reopen.run(t).then(
      () => {
        if (announce) toast({ text: 'Task reopened' });
      },
      () => toast({ text: 'The task could not be reopened. Try again.', tone: 'error' }),
    );
  };

  // Done is sent at once (the list updates optimistically); Undo reopens it on the server.
  const markDone = (t: Task) => {
    complete.run(t.id).then(
      () => toast({ text: 'Task done', undo: () => reopenTask(t, false) }),
      () => toast({ text: 'The task could not be marked done. Try again.', tone: 'error' }),
    );
  };

  if (open.isPending) return <Skeleton lines={4} />;
  if (open.isError && !open.data) return <ErrorState onRetry={() => void open.refetch()} />;
  const items = open.data?.items ?? [];

  return (
    <>
      {items.length === 0 ? (
        <Card>
          <EmptyState title="No open tasks" body="Actions confirmed in your meetings, and tasks colleagues give you, show up here." />
        </Card>
      ) : (
        <Card padded={false}>
          {items.map((t, i) => (
            <TaskRow key={t.id} task={t} first={i === 0} onDone={() => markDone(t)} onOpen={t.meeting_id ? () => router.push(`/meetings/${t.meeting_id}`) : undefined} />
          ))}
        </Card>
      )}
      <Button
        label={showDone ? 'Hide done tasks' : 'Show done tasks'}
        variant="ghost"
        small
        onPress={() => setShowDone((s) => !s)}
      />
      {showDone ? (
        done.isPending ? (
          <Skeleton lines={2} />
        ) : (done.data?.items ?? []).length === 0 ? (
          <T variant="secondary">Nothing done yet.</T>
        ) : (
          <Card padded={false}>
            {(done.data?.items ?? []).slice(0, 30).map((t, i) => (
              <Row key={t.id} first={i === 0}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <T variant="body" style={{ flex: 1, textDecorationLine: 'line-through' }} tone="ink3">
                    {t.content}
                  </T>
                  <Button
                    label="Reopen"
                    variant="ghost"
                    small
                    accessibilityHint={`Moves "${t.content}" back to your open tasks`}
                    onPress={() => reopenTask(t, true)}
                  />
                </View>
              </Row>
            ))}
          </Card>
        )
      ) : null}
    </>
  );
}

function TaskRow({ task, first, onDone, onOpen }: { task: Task; first: boolean; onDone: () => void; onOpen?: () => void }) {
  const p = useTheme();
  const due = dueLabel(task.due_date);
  return (
    <Row first={first} chevron={false}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Pressable
          onPress={onDone}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: false }}
          accessibilityLabel={`Mark done: ${task.content}`}
          hitSlop={10}
          style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: p.line2, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}
        >
        </Pressable>
        <Pressable style={{ flex: 1, gap: 4 }} onPress={onOpen} disabled={!onOpen} accessibilityRole={onOpen ? 'link' : undefined} accessibilityHint={onOpen ? 'Opens the meeting' : undefined}>
          <T variant="body" tone="ink">
            {task.content}
          </T>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {due ? <Chip label={due.text} tone={due.overdue ? 'high' : 'neutral'} /> : null}
            <T variant="meta">{task.meeting_title?.trim() || (task.meeting_id ? 'From a meeting' : 'No meeting')}</T>
          </View>
        </Pressable>
      </View>
    </Row>
  );
}

function Promises() {
  const toast = useToast();
  const open = useCommitments('open');
  const set = useSetCommitment();

  const close = (c: Commitment, status: 'done' | 'dismissed') => {
    set
      .run({ id: c.id, status })
      .then(() =>
        toast({
          text: status === 'done' ? 'Promise kept' : 'Promise dismissed',
          undo: () => void set.run({ id: c.id, status: 'open' }).catch(() => undefined),
        }),
      )
      .catch(() => toast({ text: 'That did not save. Try again.', tone: 'error' }));
  };

  if (open.isPending) return <Skeleton lines={3} />;
  if (open.isError && !open.data) return <ErrorState onRetry={() => void open.refetch()} />;
  const items = open.data?.items ?? [];
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState title="No open promises" body={'When you say "I\'ll send it Friday" in a meeting, your Myte notes it here for you, privately.'} />
      </Card>
    );
  }
  return (
    <>
      <T variant="secondary">Only you can see these. Your Myte noted them from what you said.</T>
      {items.map((c) => (
        <Card key={c.id} style={{ gap: 8 }}>
          <T variant="quote">{c.content}</T>
          <T variant="meta">
            {[c.due_hint ? `By ${c.due_hint}` : null, c.meeting_title ? `Said in ${c.meeting_title}` : null].filter(Boolean).join('. ')}
          </T>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button small label="Mark kept" onPress={() => close(c, 'done')} />
            <Button small variant="ghost" label="Dismiss" onPress={() => close(c, 'dismissed')} />
          </View>
        </Card>
      ))}
    </>
  );
}

function Updates() {
  const pending = useStatusRequests('pending');
  const answered = useStatusRequests('answered');
  const [answering, setAnswering] = useState<StatusRequestView | null>(null);
  const views = useMemo(() => (pending.data?.items ?? []).map(toStatusView), [pending.data]);
  const p = useTheme();

  if (pending.isPending) return <Skeleton lines={3} />;
  if (pending.isError && !pending.data) return <ErrorState onRetry={() => void pending.refetch()} />;
  return (
    <>
      {views.length === 0 ? (
        <Card>
          <EmptyState title="No updates owed" body="Before a follow-up meeting, you may be asked how your open actions are going. Those requests show up here." />
        </Card>
      ) : (
        views.map((u) => (
          <Card key={u.id} style={{ gap: 8 }}>
            <T variant="quote">{u.actionTitle}</T>
            <T variant="meta">
              For {u.meetingTitle}
              {u.meetingStart ? `, ${dayLabel(u.meetingStart)}` : ''}
            </T>
            <Button small label="Answer" onPress={() => setAnswering(u)} />
          </Card>
        ))
      )}
      {(answered.data?.items ?? []).length ? (
        <>
          <T variant="label" style={{ marginTop: 12 }}>
            Answered
          </T>
          <Card padded={false}>
            {(answered.data?.items ?? []).slice(0, 20).map((r, i) => {
              const v = toStatusView(r);
              return (
                <Row key={r.id} first={i === 0}>
                  <T variant="secondary" tone="ink2">
                    {v.actionTitle}
                  </T>
                  {r.status_text ? (
                    <View style={{ marginTop: 6, paddingLeft: 10, borderRadius: radii.ctl, backgroundColor: p.surface2, padding: 10 }}>
                      <T variant="secondary">{r.status_text}</T>
                    </View>
                  ) : null}
                </Row>
              );
            })}
          </Card>
        </>
      ) : null}
      <AnswerSheet request={answering} onClose={() => setAnswering(null)} />
    </>
  );
}
