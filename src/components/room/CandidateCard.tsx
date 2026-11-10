import React from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, T } from '@/components/ui';
import { LockSimple } from '@/components/Icon';
import type { Candidate, Settlement } from '@/realtime/candidates';
import { dueLabel } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * A decision or action your agents heard, for anyone in the room to confirm. Nothing is saved
 * until someone taps Confirm. Dismiss is for everyone only when the host does it; anyone else hides
 * the card for themselves. While someone edits a card (on the web), it is locked here.
 */
export function CandidateCard({
  candidate,
  lockedByName,
  assigneeName,
  isHost,
  busy,
  onConfirm,
  onDismiss,
  onHide,
}: {
  candidate: Candidate;
  lockedByName: string | null;
  assigneeName: string | null;
  isHost: boolean;
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  onHide: () => void;
}) {
  const p = useTheme();
  const noun = candidate.kind === 'decision' ? 'Decision' : 'Action';
  const due = dueLabel(candidate.dueDate ?? null);
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip label={candidate.kind === 'decision' ? 'Decision to confirm' : 'Action to confirm'} tone={candidate.kind === 'decision' ? 'medium' : 'low'} />
        {lockedByName ? (
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            <LockSimple size={14} color={p.ink3} />
            <T variant="meta">{lockedByName} is editing</T>
          </View>
        ) : null}
      </View>
      <T variant="body" tone="ink">
        {candidate.content}
      </T>
      {candidate.rationale ? <T variant="secondary">{candidate.rationale}</T> : null}
      {candidate.kind === 'action' && (assigneeName || due) ? (
        <T variant="meta">{[assigneeName ? `For ${assigneeName}` : null, due?.text].filter(Boolean).join('. ')}</T>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button small label={`Confirm ${noun.toLowerCase()}`} busy={busy} disabled={!!lockedByName} onPress={onConfirm} />
        {isHost ? (
          <Button small variant="ghost" label="Dismiss for everyone" disabled={!!lockedByName || busy} onPress={onDismiss} />
        ) : (
          <Button small variant="ghost" label="Hide for me" onPress={onHide} />
        )}
      </View>
    </Card>
  );
}

/** "Confirmed by Maya", in place of the card for a few seconds. */
export function SettledNote({ s, byName }: { s: Settlement; byName: string }) {
  const p = useTheme();
  const noun = s.kind === 'decision' ? 'Decision' : 'Action';
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: s.outcome === 'confirmed' ? p.okSoft : p.bg2, borderRadius: 12, padding: 12, gap: 2 }}
    >
      <T variant="meta" weight="600" style={{ color: s.outcome === 'confirmed' ? p.ok : p.ink3 }}>
        {noun} {s.outcome} by {byName}
      </T>
      <T variant="secondary" numberOfLines={2}>
        {s.content}
      </T>
    </View>
  );
}
