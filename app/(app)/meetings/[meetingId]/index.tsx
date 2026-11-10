import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { endpoints } from '@/api/endpoints';
import { usePeople } from '@/api/hooks/identity';
import { useReviewCandidate } from '@/api/hooks/inbox';
import { useCatchUp, useMeeting, useMyNotes, useRecap } from '@/api/hooks/meetings';
import { Button, Card, Chip, EmptyState, ErrorState, Row, Screen, SectionTitle, Skeleton, T, useToast } from '@/components/ui';
import { meetingTitle, statusChip } from '@/components/feature/MeetingRow';
import { LockSimple } from '@/components/Icon';
import { dueLabel, whenLabel } from '@/lib/format';
import { qk } from '@/api/queryKeys';
import { useTheme } from '@/theme';

const AGENDA_LABEL: Record<string, string> = {
  covered: 'Covered',
  skipped: 'Skipped',
  in_progress: 'In progress',
  pending: 'Not reached',
};

/**
 * One meeting: the way in while it is on, and afterwards what it produced. The confirmed results
 * (decisions, actions with owners, the agenda's outcome), anything still waiting for someone to
 * confirm, and your agent's notes, which only you can see.
 */
export default function MeetingDetail() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const id = String(meetingId ?? '');
  const router = useRouter();
  const p = useTheme();
  const meeting = useMeeting(id);
  const m = meeting.data;
  const happened = m ? m.status === 'ended' || m.status === 'live' : false;
  const recap = useRecap(id, happened);
  const notes = useMyNotes(id, happened);
  const { meId } = usePeople();
  const mine = m?.participants?.find((x) => x.user_id === meId);
  const sentAgent = mine?.attendance === 'agent';
  const catchUp = useCatchUp(id, happened && sentAgent);

  const refetch = () => {
    void meeting.refetch();
    void recap.refetch();
    void notes.refetch();
  };

  if (meeting.isPending) {
    return (
      <Screen back title="Meeting">
        <Skeleton lines={4} />
      </Screen>
    );
  }
  if (!m) {
    const notFound = meeting.error && 'code' in meeting.error && (meeting.error as { code: string }).code === 'NOT_FOUND';
    return (
      <Screen back title="Meeting">
        {notFound ? (
          <Card>
            <EmptyState title="This meeting is not available" body="It may have been removed, or you are not on its participant list." />
          </Card>
        ) : (
          <ErrorState onRetry={() => void meeting.refetch()} />
        )}
      </Screen>
    );
  }

  const canJoin = m.status === 'live' || m.status === 'scheduled';
  return (
    <Screen back title={meetingTitle(m)} context={whenLabel(m.scheduled_start) || null} onRefresh={refetch} refreshing={meeting.isRefetching}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {statusChip(m.status)}
        {m.status === 'ended' ? <Chip label="Ended" /> : null}
        {m.confidential ? <Chip label="Confidential" tone="medium" /> : null}
        {m.recorded_in_person ? <Chip label="Recorded in person" tone="low" /> : null}
        {m.source && m.source !== 'mytheus' ? <Chip label={`Captured from ${m.source === 'meet' ? 'Google Meet' : m.source === 'teams' ? 'Teams' : 'Zoom'}`} tone="low" /> : null}
      </View>

      {/* A meeting recorded on a phone in a room has `source: mytheus` (the published enum is
          frozen) and `recorded_in_person: true`: there is no room to join. */}
      {canJoin && (m.source ?? 'mytheus') === 'mytheus' && !m.recorded_in_person ? (
        <Button label={m.status === 'live' ? 'Join meeting' : 'Join when it starts'} full onPress={() => router.push(`/meetings/${id}/join`)} />
      ) : null}

      {!happened ? (
        m.agenda?.length ? (
          <>
            <SectionTitle title="Agenda" />
            <Card padded={false}>
              {m.agenda.map((a, i) => (
                <Row key={a.id} first={i === 0}>
                  <T variant="body" tone="ink">
                    {a.title}
                  </T>
                  {a.duration_minutes ? <T variant="meta">{a.duration_minutes} min</T> : null}
                </Row>
              ))}
            </Card>
          </>
        ) : (
          <Card>
            <EmptyState compact title="Nothing to show yet" body="Decisions, actions and your agent's notes appear here once the meeting starts." />
          </Card>
        )
      ) : (
        <>
          <Results recap={recap} />
          <Pending id={id} />
          {sentAgent && catchUp.data?.my_questions.length ? (
            <>
              <SectionTitle title="Your agent asked for you" />
              <Card style={{ gap: 8 }}>
                {catchUp.data.my_questions.map((q, i) => (
                  <T key={i} variant="quote">
                    {q}
                  </T>
                ))}
              </Card>
            </>
          ) : null}
          <SectionTitle title="Your agent's notes" right={<LockSimple size={18} color={p.ink3} />} />
          <T variant="secondary">Only you can see these.</T>
          {notes.isPending ? (
            <Skeleton lines={3} />
          ) : notes.isError && !notes.data ? (
            <ErrorState title="Your notes could not be loaded" onRetry={() => void notes.refetch()} />
          ) : (notes.data?.items ?? []).length === 0 ? (
            <Card>
              <EmptyState compact title="No notes for you" body="Your agent keeps notes on what matters to your role and listen-for topics." />
            </Card>
          ) : (
            <Card style={{ gap: 14 }}>
              {(notes.data?.items ?? []).map((n) => (
                <T key={n.id} variant="body">
                  {n.content}
                </T>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function Results({ recap }: { recap: ReturnType<typeof useRecap> }) {
  const router = useRouter();
  if (recap.isPending) return <Skeleton lines={3} />;
  if (recap.isError && !recap.data) return <ErrorState title="The results could not be loaded" onRetry={() => void recap.refetch()} />;
  const r = recap.data;
  if (!r) return null;
  const covered = r.agenda.filter((a) => a.status === 'covered').length;
  return (
    <>
      <SectionTitle title="Decisions" />
      {r.decisions.length === 0 ? (
        <Card>
          <EmptyState compact title="No decisions confirmed" />
        </Card>
      ) : (
        <Card padded={false}>
          {r.decisions.map((d, i) => (
            <Row key={d.id} first={i === 0} onPress={() => router.push(`/decisions/${d.id}`)} accessibilityLabel={`Decision: ${d.content}`}>
              <T variant="body" tone="ink">
                {d.content}
              </T>
              {d.status === 'superseded' ? (
                <View style={{ marginTop: 6 }}>
                  <Chip label="Superseded" tone="medium" />
                </View>
              ) : null}
            </Row>
          ))}
        </Card>
      )}

      <SectionTitle title="Actions" />
      {r.actions.length === 0 ? (
        <Card>
          <EmptyState compact title="No actions confirmed" />
        </Card>
      ) : (
        <Card padded={false}>
          {r.actions.map((a, i) => {
            const due = dueLabel(a.due_date);
            return (
              <Row key={a.id} first={i === 0}>
                <T variant="body" tone="ink" style={a.status === 'done' ? { textDecorationLine: 'line-through' } : undefined}>
                  {a.content}
                </T>
                <T variant="meta" style={{ marginTop: 4 }}>
                  {[a.owner_name ?? 'No owner', due?.text, a.status === 'done' ? 'Done' : null].filter(Boolean).join('. ')}
                </T>
              </Row>
            );
          })}
        </Card>
      )}

      {r.agenda.length ? (
        <>
          <SectionTitle title="Agenda" right={<T variant="meta">{`${covered} of ${r.agenda.length} covered`}</T>} />
          <Card padded={false}>
            {r.agenda.map((a, i) => (
              <Row key={`${a.title}-${i}`} first={i === 0}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T variant="body" tone="ink" style={{ flex: 1 }}>
                    {a.title}
                  </T>
                  <Chip label={AGENDA_LABEL[a.status] ?? a.status} tone={a.status === 'covered' ? 'ok' : a.status === 'skipped' ? 'neutral' : 'medium'} />
                </View>
              </Row>
            ))}
          </Card>
        </>
      ) : null}
      {r.participant_names.length ? <T variant="meta">With {r.participant_names.join(', ')}</T> : null}
    </>
  );
}

/** Detected in this meeting and not confirmed or dismissed by anyone yet. */
function Pending({ id }: { id: string }) {
  const api = useApi();
  const toast = useToast();
  const review = useReviewCandidate();
  const q = useQuery({ queryKey: [...qk.meeting(id), 'candidates'], queryFn: () => endpoints.candidates(api, id) });
  const open = [
    ...(q.data?.decisions ?? []).filter((d) => d.status === 'proposed').map((d) => ({ kind: 'decision' as const, id: d.id, content: d.content })),
    ...(q.data?.actions ?? []).filter((a) => a.status === 'proposed').map((a) => ({ kind: 'action' as const, id: a.id, content: a.content })),
  ];
  if (!open.length) return null;
  return (
    <>
      <SectionTitle title="Waiting for someone to confirm" />
      {open.map((c) => {
        const noun = c.kind === 'decision' ? 'Decision' : 'Action';
        const act = (outcome: 'confirm' | 'dismiss') =>
          void review
            .run({ kind: c.kind, id: c.id, outcome })
            .then(() => {
              toast({ text: `${noun} ${outcome === 'confirm' ? 'confirmed' : 'dismissed'}` });
              void q.refetch();
            })
            .catch(() => toast({ text: 'That did not save. Try again.', tone: 'error' }));
        return (
          <Card key={c.id} style={{ gap: 8 }}>
            <Chip label={noun} tone={c.kind === 'decision' ? 'medium' : 'low'} />
            <T variant="body" tone="ink">
              {c.content}
            </T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small label={`Confirm ${noun.toLowerCase()}`} onPress={() => act('confirm')} />
              <Button small variant="ghost" label="Dismiss" onPress={() => act('dismiss')} />
            </View>
          </Card>
        );
      })}
    </>
  );
}
