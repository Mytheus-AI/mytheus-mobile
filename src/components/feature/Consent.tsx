import React from 'react';
import { View } from 'react-native';
import { T } from '@/components/ui';
import { ChatCircleText, Ear, LockSimple, Scales, Signature, VideoCamera, type IconType } from '@/components/Icon';
import { useTheme } from '@/theme';

/**
 * The recording and transcription notice, word for word the one mytheus-ui shows
 * (`src/components/call/consent.tsx`), with the same version label. meeting-service stores the
 * version with the agreement (`meeting_participants.consent_version`), so the stored label must
 * name the text the person actually read: change these words only together with the web notice,
 * and change CONSENT_VERSION in both when you do. Since ADR-0042 (the Myte rename) the phone has
 * its own label, `room-notice-2026-11-12-mobile`, because it has no off-the-record clause; meeting-service
 * keeps its words.
 */
export const CONSENT_VERSION = 'room-notice-2026-11-12-mobile';

export function consentTerms(recording: boolean | null): { icon: IconType; title: string; body: string }[] {
  return [
    {
      icon: Ear,
      title: 'A transcript is kept',
      body: 'What is said is transcribed with who said it, and kept with the meeting in your workspace for as long as its retention setting allows.',
    },
    {
      icon: VideoCamera,
      title: recording ? 'Audio and video are recorded' : 'Audio and video are not recorded',
      body: recording
        ? 'The call is recorded and stored with the meeting in your workspace.'
        : 'Speech is sent to our transcription provider to write the transcript. It is not kept as audio.',
    },
    { icon: LockSimple, title: 'Your Myte’s notes are yours', body: 'Only you can see the notes your Myte takes for you.' },
    { icon: Scales, title: 'Nothing is decided for you', body: 'Decisions and action items are saved only when someone in the meeting confirms them.' },
    {
      icon: ChatCircleText,
      title: 'Chat is kept',
      body: 'Messages in the meeting chat are stored with the meeting, so people who join later can read them.',
    },
    {
      icon: Signature,
      title: 'Your agreement is recorded',
      body: 'We store when you agreed and which version of this notice you saw. You are asked once per meeting.',
    },
  ];
}

export function ConsentTerms({ recording }: { recording: boolean | null }) {
  const p = useTheme();
  return (
    <View style={{ gap: 14 }} accessibilityRole="list">
      {consentTerms(recording).map(({ icon: Icon, title, body }) => (
        <View key={title} style={{ flexDirection: 'row', gap: 12 }} accessible accessibilityLabel={`${title}. ${body}`}>
          <View style={{ paddingTop: 2 }}>
            <Icon size={20} color={p.ink3} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="body" weight="600" tone="ink">
              {title}
            </T>
            <T variant="secondary">{body}</T>
          </View>
        </View>
      ))}
    </View>
  );
}
