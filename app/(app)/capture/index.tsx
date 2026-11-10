import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCaptureStatus } from '@/api/hooks/capture';
import { Field } from '@/components/Field';
import { Check, Microphone, Square, WarningCircle } from '@/components/Icon';
import { Button, Card, EmptyState, ErrorState, Screen, Skeleton, T } from '@/components/ui';
import { elapsed, elapsedSpoken } from '@/lib/capture-copy';
import { useInPersonCapture } from '@/realtime/capture/useInPersonCapture';
import { radii, useTheme } from '@/theme';

/**
 * Record in person: a meeting held in a room, recorded on this phone. The transcript, notes and
 * minutes follow exactly as for a Mytheus call. Consent first: the person confirms that everyone
 * in the room knows it is being recorded, and that confirmation is stored with the meeting.
 */
export default function RecordInPerson() {
  const status = useCaptureStatus();
  const capture = useInPersonCapture();
  const { step } = capture.state;
  const recording = step === 'connecting' || step === 'live' || step === 'reconnecting' || step === 'stopping';

  return (
    <Screen
      back={!recording}
      title="Record in person"
      context="For a meeting in a room. Your phone listens; Mytheus writes the transcript, notes and minutes."
    >
      {status.isPending ? (
        <Skeleton lines={3} />
      ) : status.isError && !status.data ? (
        <ErrorState onRetry={() => void status.refetch()} />
      ) : !status.data?.configured || step === 'not_connected' ? (
        <NotConnected />
      ) : step === 'ready' || step === 'starting' ? (
        <Consent busy={step === 'starting'} onStart={(title) => void capture.start(title)} />
      ) : step === 'permission_denied' ? (
        <PermissionDenied onRetry={capture.reset} />
      ) : recording ? (
        <Recording state={capture.state} onStop={() => void capture.stop()} />
      ) : step === 'ended' ? (
        <Ended meetingId={capture.state.meetingId} />
      ) : (
        <Failed message={capture.state.error} meetingId={capture.state.meetingId} onRetry={capture.reset} />
      )}
    </Screen>
  );
}

function NotConnected() {
  return (
    <Card>
      <EmptyState
        title="Recording in person is not connected"
        body="This server cannot take recordings from a phone yet. Ask your admin, or record the meeting as a Mytheus call instead."
      />
    </Card>
  );
}

function Consent({ busy, onStart }: { busy: boolean; onStart: (title: string) => void }) {
  const p = useTheme();
  const [title, setTitle] = useState('');
  const [agreed, setAgreed] = useState(false);
  return (
    <Card style={{ gap: 18 }}>
      <Field
        label="Meeting name (optional)"
        value={title}
        onChangeText={setTitle}
        placeholder="In-person meeting"
        maxLength={120}
        returnKeyType="done"
      />
      <View style={{ gap: 8 }}>
        <T variant="body" weight="600" tone="ink">
          Before you start
        </T>
        <T variant="secondary">
          Mytheus transcribes what is said in the room, with your voice attributed to you. The audio is sent to our
          transcription provider and is not kept as a recording.
        </T>
      </View>
      <Pressable
        onPress={() => setAgreed((a) => !a)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        accessibilityLabel="Everyone in the room knows this meeting is being recorded"
        style={({ pressed }) => ({
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center',
          padding: 12,
          borderRadius: radii.ctl,
          borderWidth: 1,
          borderColor: agreed ? p.signal : p.line2,
          backgroundColor: pressed ? p.surface2 : p.surface,
          minHeight: 48,
        })}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: 1.5,
            borderColor: agreed ? p.signal : p.line2,
            backgroundColor: agreed ? p.signal : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {agreed ? <Check size={16} color="#ffffff" /> : null}
        </View>
        <T variant="body" tone="ink" style={{ flex: 1 }}>
          Everyone in the room knows this meeting is being recorded
        </T>
      </Pressable>
      <Button
        label="Start recording"
        icon={Microphone}
        variant="signal"
        full
        busy={busy}
        disabled={!agreed || busy}
        accessibilityHint={agreed ? 'Asks for the microphone, then starts recording' : 'Confirm the people in the room know first'}
        onPress={() => onStart(title)}
      />
    </Card>
  );
}

function PermissionDenied({ onRetry }: { onRetry: () => void }) {
  return (
    <Card style={{ gap: 12 }}>
      <EmptyState
        title="Mytheus cannot use the microphone"
        body="Allow microphone access for Mytheus in your phone's settings, then try again."
      />
      <Button label="Open settings" variant="outline" onPress={() => void Linking.openSettings()} />
      <Button label="Try again" variant="ghost" onPress={onRetry} />
    </Card>
  );
}

function Recording({
  state,
  onStop,
}: {
  state: { step: string; startedAt: number | null; level: number; title: string | null };
  onStop: () => void;
}) {
  const p = useTheme();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = state.startedAt ? now - state.startedAt : 0;
  const label =
    state.step === 'connecting'
      ? 'Connecting'
      : state.step === 'reconnecting'
        ? 'Reconnecting. Keep talking: nothing is lost.'
        : state.step === 'stopping'
          ? 'Saving the recording'
          : 'Recording';
  const bars = 12;
  const lit = Math.round(state.level * bars);
  return (
    <Card style={{ gap: 20, alignItems: 'center', paddingVertical: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite">
        {state.step === 'live' ? (
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.high }} />
        ) : (
          <ActivityIndicator size="small" color={p.ink3} />
        )}
        <T variant="label" style={{ color: state.step === 'reconnecting' ? p.medium : p.ink3 }}>
          {label}
        </T>
      </View>
      {state.title ? (
        <T variant="lead" center>
          {state.title}
        </T>
      ) : null}
      <T
        variant="display"
        center
        accessibilityLabel={`Recorded for ${elapsedSpoken(ms)}`}
        style={{ fontVariant: ['tabular-nums'], fontSize: 48, lineHeight: 56 }}
      >
        {elapsed(ms)}
      </T>
      <View
        style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 28 }}
        accessible
        accessibilityLabel={state.level > 0.05 ? 'Hearing the room' : 'Quiet'}
      >
        {Array.from({ length: bars }, (_, i) => (
          <View
            key={i}
            style={{
              width: 6,
              height: 8 + (i % 4) * 5,
              borderRadius: 3,
              backgroundColor: i < lit ? p.signal : p.line2,
            }}
          />
        ))}
      </View>
      <Button
        label="Stop and save"
        icon={Square}
        variant="danger"
        full
        busy={state.step === 'stopping'}
        disabled={state.step === 'stopping'}
        accessibilityHint="Ends the meeting; the transcript and minutes follow"
        onPress={onStop}
      />
    </Card>
  );
}

function Ended({ meetingId }: { meetingId: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (meetingId) router.replace(`/meetings/${meetingId}`);
  }, [meetingId, router]);
  return (
    <Card>
      <EmptyState title="Recording saved" body="Opening the meeting. Notes and minutes appear there in a few minutes." />
    </Card>
  );
}

function Failed({ message, meetingId, onRetry }: { message: string | null; meetingId: string | null; onRetry: () => void }) {
  const router = useRouter();
  const p = useTheme();
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <WarningCircle size={20} color={p.high} />
        <T variant="body" tone="ink" style={{ flex: 1 }}>
          {message ?? 'Something went wrong with the recording.'}
        </T>
      </View>
      {meetingId ? <Button label="Open the meeting" variant="outline" onPress={() => router.replace(`/meetings/${meetingId}`)} /> : null}
      <Button label="Start a new recording" variant="ghost" onPress={onRetry} />
    </Card>
  );
}
