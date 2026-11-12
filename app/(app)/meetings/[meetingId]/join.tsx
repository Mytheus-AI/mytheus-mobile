import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMeeting, useRoomSession } from '@/api/hooks/meetings';
import { Button, Card, EmptyState, Screen, Skeleton, T } from '@/components/ui';
import { meetingTitle } from '@/components/feature/MeetingRow';
import { CONSENT_VERSION, ConsentTerms } from '@/components/feature/Consent';
import { Microphone } from '@/components/Icon';
import { whenLabel } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * Before the call: what the meeting keeps, asked once per person per meeting. Agreeing sends the
 * notice's version with the token request (`consent.version`), and meeting-service records it before
 * it lets you in. If you already agreed for this meeting, this is just the way in.
 */
export default function Join() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const id = String(meetingId ?? '');
  const router = useRouter();
  const p = useTheme();
  const meeting = useMeeting(id);
  const session = useRoomSession(id);
  const s = session.data;

  const enter = (consent: string | null) =>
    router.replace(consent ? `/meetings/${id}/room?consent=${encodeURIComponent(consent)}` : `/meetings/${id}/room`);

  const title = meeting.data ? meetingTitle(meeting.data) : 'Meeting';
  if (session.isPending || meeting.isPending) {
    return (
      <Screen back title={title}>
        <Skeleton lines={4} />
      </Screen>
    );
  }
  if (s?.ended || meeting.data?.status === 'ended') {
    return (
      <Screen back title={title}>
        <Card>
          <EmptyState title="This meeting has ended" actionLabel="See what was decided" onAction={() => router.replace(`/meetings/${id}`)} />
        </Card>
      </Screen>
    );
  }
  // A failed session read is not fatal: ask for consent, and the server decides.
  const needsConsent = !s || (s.consent_required && !s.consented_at);

  return (
    <Screen back title={title} context={meeting.data ? whenLabel(meeting.data.scheduled_start) || null : null}>
      {needsConsent ? (
        <Card style={{ gap: 16 }}>
          <T variant="title">Before you join</T>
          <T variant="body">Everyone in this meeting has a Myte, their personal AI agent. Here is what is kept.</T>
          <ConsentTerms recording={s ? s.recording : null} />
        </Card>
      ) : null}
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Microphone size={20} color={p.ink3} />
        <T variant="secondary" style={{ flex: 1 }}>
          Your microphone turns on when you join, so your Myte can follow along. You can mute at any time. Your phone may ask
          for permission first.
        </T>
      </Card>
      <Button
        full
        label={needsConsent ? 'Agree and join' : 'Join meeting'}
        accessibilityHint={needsConsent ? 'Records that you agreed to this notice for this meeting' : undefined}
        onPress={() => enter(needsConsent ? CONSENT_VERSION : null)}
      />
      <Button full variant="ghost" label="Not now" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}
