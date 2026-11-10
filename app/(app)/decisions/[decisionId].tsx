import React from 'react';
import { Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateShareLink, useDecisionRecord, useShareLinks } from '@/api/hooks/decisions';
import { ApiError } from '@/api/client';
import { Button, Card, Chip, EmptyState, ErrorState, Row, Screen, SectionTitle, Skeleton, T, useToast } from '@/components/ui';
import { ShareNetwork } from '@/components/Icon';
import { dayLabel, dueLabel, plural } from '@/lib/format';
import type { LineageStep, ShareLink } from '@/api/types';
import { useTheme } from '@/theme';

/**
 * One decision: what was decided and why, who confirmed it, where it sits in its lineage (what it
 * replaced, what replaced it), the actions that came with it, and a link to share it with people
 * outside the workspace.
 */
export default function DecisionScreen() {
  const { decisionId } = useLocalSearchParams<{ decisionId: string }>();
  const id = String(decisionId ?? '');
  const router = useRouter();
  const record = useDecisionRecord(id);
  const r = record.data;

  if (record.isPending) {
    return (
      <Screen back title="Decision">
        <Skeleton lines={4} />
      </Screen>
    );
  }
  if (!r) {
    const notFound = record.error instanceof ApiError && (record.error.code === 'NOT_FOUND' || record.error.code === 'FORBIDDEN_ROLE');
    return (
      <Screen back title="Decision">
        {notFound ? (
          <Card>
            <EmptyState title="This decision is not available" body="It may be from a meeting you were not part of." />
          </Card>
        ) : (
          <ErrorState onRetry={() => void record.refetch()} />
        )}
      </Screen>
    );
  }

  return (
    <Screen back kicker="Decision" title={r.meeting_title || 'Decision'} context={dayLabel(r.decided_at) || null} onRefresh={() => void record.refetch()} refreshing={record.isRefetching}>
      <Card style={{ gap: 10 }}>
        {r.status === 'superseded' ? <Chip label="Replaced by a later decision" tone="medium" /> : <Chip label="Confirmed" tone="ok" />}
        <T variant="title">{r.content}</T>
        {r.rationale ? <T variant="body">{r.rationale}</T> : null}
        <T variant="meta">
          {[r.confirmed_by_name ? `Confirmed by ${r.confirmed_by_name}` : null, `in ${r.meeting_title}`].filter(Boolean).join(' ')}
        </T>
        <Button small variant="outline" label="Open the meeting" onPress={() => router.push(`/meetings/${r.meeting_id}`)} />
      </Card>

      {r.lineage.length > 1 ? (
        <>
          <SectionTitle title="Lineage" />
          <Lineage steps={r.lineage} onOpen={(did) => router.push(`/decisions/${did}`)} />
        </>
      ) : null}

      {r.meeting_actions.length ? (
        <>
          <SectionTitle title="Actions from this meeting" />
          <Card padded={false}>
            {r.meeting_actions.map((a, i) => (
              <Row key={a.id} first={i === 0}>
                <T variant="body" tone="ink" style={a.status === 'done' ? { textDecorationLine: 'line-through' } : undefined}>
                  {a.content}
                </T>
                <T variant="meta" style={{ marginTop: 4 }}>
                  {[a.owner_name ?? 'No owner', dueLabel(a.due_date)?.text, a.status === 'done' ? 'Done' : null].filter(Boolean).join('. ')}
                </T>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      <ShareSection decisionId={r.decision_id} />
    </Screen>
  );
}

const RELATION: Record<LineageStep['relation'], string> = {
  earlier: 'Earlier',
  subject: 'This decision',
  later: 'Later',
};

/** The memory line: one coral thread joining the decisions this one grew from and led to. */
function Lineage({ steps, onOpen }: { steps: LineageStep[]; onOpen: (id: string) => void }) {
  const p = useTheme();
  return (
    <Card>
      <View>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const subject = s.relation === 'subject';
          const open = s.visible && s.decision_id && !subject ? () => onOpen(s.decision_id as string) : undefined;
          return (
            <View key={`${s.decision_id ?? 'hidden'}-${i}`} style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ width: 14, alignItems: 'center' }} accessible={false}>
                <View
                  style={{
                    width: subject ? 14 : 10,
                    height: subject ? 14 : 10,
                    borderRadius: 7,
                    marginTop: 5,
                    backgroundColor: subject ? p.signalLine : p.surface,
                    borderWidth: 2,
                    borderColor: p.signalLine,
                  }}
                />
                {!last ? <View style={{ flex: 1, width: 2, backgroundColor: p.signalLine, marginVertical: 2 }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: last ? 0 : 18, gap: 3 }}>
                <T variant="label">{[RELATION[s.relation], s.decided_at ? dayLabel(s.decided_at) : null].filter(Boolean).join(', ')}</T>
                {s.visible ? (
                  <T
                    variant="body"
                    tone={subject ? 'ink' : 'ink2'}
                    weight={subject ? '600' : undefined}
                    onPress={open}
                    accessibilityRole={open ? 'link' : undefined}
                    style={open ? { textDecorationLine: 'underline', textDecorationColor: p.line2 } : undefined}
                  >
                    {s.content}
                  </T>
                ) : (
                  <T variant="secondary">A decision from a meeting you were not in.</T>
                )}
                {s.visible && s.meeting_title ? <T variant="meta">{s.meeting_title}</T> : null}
                {s.status === 'superseded' && !subject ? <Chip label="Replaced" tone="medium" /> : null}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function ShareSection({ decisionId }: { decisionId: string }) {
  const toast = useToast();
  const links = useShareLinks(decisionId);
  const create = useCreateShareLink();
  const active = (links.data?.items ?? []).filter((l) => l.state === 'active');

  const shareUrl = async (link: ShareLink) => {
    try {
      await Share.share({ message: link.url, url: link.url });
    } catch {
      toast({ text: 'The share sheet could not open.', tone: 'error' });
    }
  };

  const makeLink = async () => {
    try {
      const link = await create.run(decisionId);
      toast({ text: 'Share link created' });
      await shareUrl(link);
    } catch (e) {
      const forbidden = e instanceof ApiError && (e.status === 403 || e.code === 'FORBIDDEN_ROLE');
      const off = e instanceof ApiError && e.status === 503;
      toast({
        text: forbidden
          ? 'Your workspace does not let you share decisions outside it.'
          : off
            ? 'Sharing is not available right now.'
            : 'A share link could not be created. Try again.',
        tone: 'error',
      });
    }
  };

  return (
    <>
      <SectionTitle title="Share" />
      <Card style={{ gap: 10 }}>
        <T variant="secondary">
          A read-only page with this decision, its rationale and its actions, for people outside your workspace. Links stop
          working after 30 days.
        </T>
        {active.map((l) => (
          <View key={l.id} style={{ gap: 2 }}>
            <T variant="secondary" tone="ink2" numberOfLines={1} selectable>
              {l.url}
            </T>
            <T variant="meta">
              {[`Expires ${dayLabel(l.expires_at)}`, plural(l.view_count, 'view'), l.created_by_name ? `by ${l.created_by_name}` : null]
                .filter(Boolean)
                .join(', ')}
            </T>
            <Button small variant="ghost" label="Share this link" icon={ShareNetwork} onPress={() => void shareUrl(l)} />
          </View>
        ))}
        <Button label={active.length ? 'Create a new link' : 'Create share link'} icon={ShareNetwork} busy={create.isPending} onPress={() => void makeLink()} />
      </Card>
    </>
  );
}
