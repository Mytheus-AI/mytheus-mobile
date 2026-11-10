import React, { useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Chip, EmptyState, T } from '@/components/ui';
import StreamingDots from '@/components/StreamingDots';
import type { CaptionState } from '@/realtime/captions';
import { orderedNotes, type NotesState } from '@/realtime/notes';
import type { AgendaState } from '@/realtime/agenda';
import type { AgendaItem, AgendaStatus } from '@/realtime/types';
import { useTheme } from '@/theme';

const CAPTION_WINDOW = 60;

/** Live captions: settled lines and the line being spoken, newest at the bottom. */
export function CaptionsPanel({ captions, speaker }: { captions: CaptionState; speaker: (id: string) => string }) {
  const p = useTheme();
  const ref = useRef<ScrollView>(null);
  const lines = captions.lines.slice(-CAPTION_WINDOW);
  const tail = `${lines.length}:${lines[lines.length - 1]?.text ?? ''}`;
  useEffect(() => {
    ref.current?.scrollToEnd({ animated: false });
  }, [tail]);
  if (lines.length === 0) {
    return <EmptyState compact title="Captions appear here" body="What people say shows up within a couple of seconds." />;
  }
  return (
    <ScrollView ref={ref} style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
      {lines.map((l) => (
        <View key={l.chunkId} style={{ gap: 2, opacity: l.isFinal ? 1 : 0.62 }} accessible accessibilityLabel={`${speaker(l.speakerId)}: ${l.text}`}>
          <T variant="meta" weight="600" style={{ color: p.ink3 }}>
            {speaker(l.speakerId)}
          </T>
          <T variant="body" tone="ink">
            {l.text}
          </T>
        </View>
      ))}
    </ScrollView>
  );
}

/** Your agent's notes, streaming in as it writes them. Only you see these. */
export function NotesPanel({ notes }: { notes: NotesState }) {
  const items = orderedNotes(notes);
  if (items.length === 0) {
    return <EmptyState compact title="No notes yet" body="Your agent writes notes on what matters to you as the meeting goes. Only you can see them." />;
  }
  return (
    <View style={{ gap: 12 }}>
      {items.map((n) => (
        <View key={n.windowId} style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <T variant="body" tone="ink2">
            {n.text}
          </T>
          <StreamingDots visible={!n.final} />
        </View>
      ))}
    </View>
  );
}

const STATUS_LABEL: Record<AgendaStatus, string> = {
  pending: 'Not started',
  in_progress: 'Now',
  covered: 'Covered',
  skipped: 'Skipped',
};

/** The shared agenda. The host marks items; everyone sees it change. */
export function AgendaPanel({
  agenda,
  isHost,
  ownerName,
  onSet,
}: {
  agenda: AgendaState;
  isHost: boolean;
  ownerName: (id: string | null) => string | null;
  onSet: (item: AgendaItem, status: AgendaStatus) => void;
}) {
  if (!agenda.loaded) return <EmptyState compact title="Loading the agenda" />;
  if (agenda.items.length === 0) return <EmptyState compact title="No agenda for this meeting" />;
  return (
    <View style={{ gap: 10 }}>
      {agenda.stale ? <T variant="meta">The agenda may be out of date. It refreshes when the connection is back.</T> : null}
      {agenda.items.map((it) => {
        const owner = ownerName(it.owner_user_id);
        return (
          <Card key={it.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <T variant="body" weight="600" tone="ink" style={{ flex: 1 }}>
                {it.title}
              </T>
              <Chip
                label={STATUS_LABEL[it.status]}
                tone={it.status === 'in_progress' ? 'signal' : it.status === 'covered' ? 'ok' : 'neutral'}
              />
            </View>
            <T variant="meta">
              {[owner ? `Led by ${owner}` : null, it.duration_minutes ? `${it.duration_minutes} min` : null].filter(Boolean).join('. ')}
            </T>
            {it.agent_note ? <T variant="secondary">{it.agent_note}</T> : null}
            {isHost ? (
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {it.status !== 'in_progress' ? <Button small variant="outline" label="Start" onPress={() => onSet(it, 'in_progress')} /> : null}
                {it.status !== 'covered' ? <Button small variant="outline" label="Mark covered" onPress={() => onSet(it, 'covered')} /> : null}
                {it.status !== 'skipped' ? <Button small variant="ghost" label="Skip" onPress={() => onSet(it, 'skipped')} /> : null}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
