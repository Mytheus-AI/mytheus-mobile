import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';
import { AudioSession } from '@livekit/react-native';
import { useApi } from '@/api/ApiProvider';
import { ApiError } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { usePeople } from '@/api/hooks/identity';
import { useReviewCandidate } from '@/api/hooks/inbox';
import { useMeeting } from '@/api/hooks/meetings';
import { newIdempotencyKey } from '@/api/client';
import { Button, Card, EmptyState, IconButton, Segmented, T, useToast } from '@/components/ui';
import { meetingTitle } from '@/components/feature/MeetingRow';
import { CONSENT_VERSION, ConsentTerms } from '@/components/feature/Consent';
import { CandidateCard, SettledNote } from '@/components/room/CandidateCard';
import { AgendaPanel, CaptionsPanel, NotesPanel } from '@/components/room/Panels';
import { Stage } from '@/components/room/Stage';
import {
  HandPalm,
  Microphone,
  MicrophoneSlash,
  PhoneDisconnect,
  Smiley,
  VideoCamera,
  VideoCameraSlash,
  WarningCircle,
} from '@/components/Icon';
import { config } from '@/lib/config';
import { clock } from '@/lib/format';
import { nameFor } from '@/lib/people';
import { joinErrorText, speakerLabel } from '@/lib/room';
import { lockedBy, orderedCandidates, recentSettlements, type Candidate } from '@/realtime/candidates';
import { roomConnection } from '@/realtime/connection';
import { roomHydrators } from '@/realtime/hydrators';
import { REACTIONS, reactionOf } from '@/realtime/room-live';
import { useLiveKitRoom } from '@/realtime/useLiveKitRoom';
import { useMeetingSocket } from '@/realtime/useMeetingSocket';
import type { AgendaItem, AgendaStatus } from '@/realtime/types';
import { radii, space, useTheme } from '@/theme';

type PanelKey = 'needs' | 'captions' | 'notes' | 'agenda';

const TAP_PREFIX = 'nexus-audio-tap';

/**
 * The meeting room on a phone: the call (LiveKit), and the meeting's live layer (realtime-gateway):
 * captions, your agent's notes, the shared cards everyone can confirm, the shared agenda, hands and
 * reactions. One line says honestly when either link is down.
 */
export default function Room() {
  const params = useLocalSearchParams<{ meetingId: string; consent?: string }>();
  const id = String(params.meetingId ?? '');
  const router = useRouter();
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const api = useApi();
  const { getToken } = useAuth();
  const { people, meId } = usePeople();
  const meeting = useMeeting(id);
  const review = useReviewCandidate();
  const m = meeting.data;
  const isHost = !!meId && !!m && (m.host_user_id === meId || m.created_by === meId);

  const call = useLiveKitRoom(id, {
    mint: (consent) => endpoints.mintToken(api, id, consent),
    startAudio: () => AudioSession.startAudioSession(),
    stopAudio: () => AudioSession.stopAudioSession(),
    initialConsent: params.consent === CONSENT_VERSION ? CONSENT_VERSION : null,
  });
  const hydrate = useMemo(() => roomHydrators(api, id), [api, id]);
  const live = useMeetingSocket(id, { url: config.realtimeUrl, getToken: () => getToken(), meId, hydrate });

  const speakers = useQuery({
    queryKey: ['speakers', id],
    queryFn: () => endpoints.speakers(api, id),
    refetchInterval: 60_000,
    enabled: !!id,
  });
  const speakerNames = useMemo(() => {
    const out = new Map<string, string>();
    for (const [uid, person] of people ?? []) out.set(uid, person.isYou ? 'You' : person.name);
    for (const s of speakers.data?.items ?? []) {
      if (s.user_id && people?.get(s.user_id)) out.set(s.speaker_id, nameFor(people, s.user_id));
    }
    return out;
  }, [people, speakers.data]);

  const [panel, setPanel] = useState<PanelKey>('captions');
  const [busy, setBusy] = useState<string | null>(null);
  const [reacting, setReacting] = useState(false);
  const opRef = useRef(0);
  const now = useNow(1000);

  // The host ended it for everyone: leave the call and say so.
  const leaveCall = call.leave;
  useEffect(() => {
    if (live.ended) void leaveCall();
  }, [live.ended, leaveCall]);

  const participants = call.participants.filter((pt) => !pt.identity.startsWith(TAP_PREFIX));
  const notice = roomConnection(call.status === 'consent' ? 'connecting' : call.status, live.status, live.everJoined);
  const open = orderedCandidates(live.candidates).filter((c) => !live.candidates.resolved[c.id]);
  const settled = recentSettlements(live.candidates);
  const needsCount = open.length + (isHost && live.nudges.current ? 1 : 0);
  const myHand = !!(meId && live.hands.raised[meId]);
  const elapsed = call.startedAt ? clock(now - Date.parse(call.startedAt)) : null;

  const leave = async () => {
    await call.leave();
    router.replace(`/meetings/${id}`);
  };

  const confirm = async (c: Candidate) => {
    setBusy(c.id);
    const noun = c.kind === 'decision' ? 'Decision' : 'Action';
    try {
      await review.run({ kind: c.kind, id: c.id, outcome: 'confirm' });
      live.settleCandidate(c.id, 'confirmed');
      void live.announceCandidate(c.id, 'confirmed');
      toast({ text: `${noun} confirmed` });
    } catch (e) {
      toast({ text: e instanceof ApiError && e.code === 'VERSION_CONFLICT' ? `Someone already settled this ${noun.toLowerCase()}.` : `The ${noun.toLowerCase()} could not be confirmed. Try again.`, tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const dismissForAll = async (c: Candidate) => {
    setBusy(c.id);
    try {
      await review.run({ kind: c.kind, id: c.id, outcome: 'dismiss' });
      live.settleCandidate(c.id, 'dismissed');
      void live.announceCandidate(c.id, 'dismissed');
      toast({ text: c.kind === 'decision' ? 'Decision dismissed' : 'Action dismissed' });
    } catch {
      toast({ text: 'That did not save. Try again.', tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const setAgenda = async (item: AgendaItem, status: AgendaStatus) => {
    opRef.current += 1;
    const op = opRef.current;
    live.agendaHost.begin(item.id, status, op);
    try {
      const row = await endpoints.setAgendaStatus(api, id, item.id, status, newIdempotencyKey());
      live.agendaHost.commit(item.id, op, row);
      void live.agendaHost.announce(item.id);
    } catch {
      live.agendaHost.rollback(item.id, op);
      toast({ text: 'The agenda did not change. Try again.', tone: 'error' });
    }
  };

  const endForEveryone = () =>
    Alert.alert('End the meeting for everyone?', 'Everyone leaves the call. Unconfirmed cards stay in their inboxes.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End meeting',
        style: 'destructive',
        onPress: async () => {
          try {
            await endpoints.endMeeting(api, id, newIdempotencyKey());
            await live.announceEnd();
            await leave();
          } catch {
            toast({ text: 'The meeting could not be ended. Try again.', tone: 'error' });
          }
        },
      },
    ]);

  // ---- states that replace the room
  if (live.ended) {
    return (
      <Full insetsTop={insets.top}>
        <Card>
          <EmptyState
            title="The meeting has ended"
            body={`${nameFor(people, live.ended.byUserId)} ended it for everyone. Decisions and actions are on the meeting page.`}
            actionLabel="See what was decided"
            onAction={() => router.replace(`/meetings/${id}`)}
          />
        </Card>
      </Full>
    );
  }
  if (call.status === 'consent') {
    return (
      <Full insetsTop={insets.top}>
        <Card style={{ gap: 16 }}>
          <T variant="title">Before you join</T>
          <T variant="body">This meeting has an AI agent for each person in it. Here is what is kept.</T>
          <ConsentTerms recording={null} />
          <Button full label="Agree and join" onPress={() => call.acceptConsent(CONSENT_VERSION)} />
          <Button full variant="ghost" label="Leave" onPress={() => router.replace(`/meetings/${id}`)} />
        </Card>
      </Full>
    );
  }
  if (call.status === 'error') {
    const e = joinErrorText(call.error);
    return (
      <Full insetsTop={insets.top}>
        <Card style={{ gap: 12 }}>
          <WarningCircle size={24} color={p.high} />
          <T variant="title">{e.title}</T>
          <T variant="body">{e.body}</T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Try again" onPress={call.retry} />
            <Button variant="ghost" label="Leave" onPress={() => router.replace(`/meetings/${id}`)} />
          </View>
        </Card>
      </Full>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 140, gap: space.gap }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <T variant="title" numberOfLines={1}>
              {m ? meetingTitle(m) : 'Meeting'}
            </T>
            <T variant="meta">{call.status === 'connecting' ? 'Joining the call' : elapsed ? `Meeting time ${elapsed}` : 'In the call'}</T>
          </View>
          {isHost ? <Button small variant="danger" label="End for everyone" onPress={endForEveryone} /> : null}
        </View>

        {notice ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: radii.ctl, backgroundColor: notice.tone === 'error' ? p.highSoft : p.mediumSoft }}
          >
            <WarningCircle size={18} color={notice.tone === 'error' ? p.high : p.medium} />
            <T variant="secondary" style={{ flex: 1, color: notice.tone === 'error' ? p.high : p.medium }}>
              {notice.text}
            </T>
            {notice.retry === 'live' ? <Button small variant="ghost" label="Try again" onPress={live.retry} /> : null}
            {notice.retry === 'call' ? <Button small variant="ghost" label="Try again" onPress={call.retry} /> : null}
          </View>
        ) : null}

        <Stage
          participants={participants}
          nameOf={(pt) => pt.name || (people?.get(pt.identity)?.name ?? 'Guest')}
          handRaised={(identity) => !!live.hands.raised[identity]}
        />

        {live.reactions.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityLiveRegion="polite">
            {live.reactions.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: p.surface, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                <T variant="body">{reactionOf(r.reaction)?.emoji}</T>
                <T variant="meta">{nameFor(people, r.userId)}</T>
              </View>
            ))}
          </View>
        ) : null}

        <Segmented
          label="Live panel"
          value={panel}
          onChange={setPanel}
          segments={[
            { key: 'needs', label: 'Needs you', count: needsCount },
            { key: 'captions', label: 'Captions' },
            { key: 'notes', label: 'Notes' },
            { key: 'agenda', label: 'Agenda' },
          ]}
        />

        {panel === 'needs' ? (
          <View style={{ gap: 10 }}>
            {isHost && live.nudges.current ? (
              <Card style={{ gap: 8, borderColor: p.mediumSoft }}>
                <T variant="label">For the host</T>
                <T variant="body" tone="ink">
                  {live.nudges.current.content}
                </T>
                <Button small variant="ghost" label="Got it" onPress={() => live.nudges.current && live.dismissNudge(live.nudges.current.id)} />
              </Card>
            ) : null}
            {settled.map((s) => (
              <SettledNote key={s.id} s={s} byName={nameFor(people, s.byUserId)} />
            ))}
            {open.length === 0 && !(isHost && live.nudges.current) ? (
              <EmptyState compact title="Nothing needs you" body="When your agents hear a decision or an action, it shows up here for anyone to confirm." />
            ) : (
              open.map((c) => {
                const holder = lockedBy(live.candidates, c.id, meId, now);
                return (
                  <CandidateCard
                    key={c.id}
                    candidate={c}
                    lockedByName={holder ? nameFor(people, holder) : null}
                    assigneeName={c.assigneeId ? nameFor(people, c.assigneeId) : null}
                    isHost={isHost}
                    busy={busy === c.id}
                    onConfirm={() => void confirm(c)}
                    onDismiss={() => void dismissForAll(c)}
                    onHide={() => live.hideCandidate(c.id)}
                  />
                );
              })
            )}
          </View>
        ) : panel === 'captions' ? (
          <Card>
            {live.status === 'disabled' ? (
              <EmptyState compact title="Captions are off" body="This app is not set up for live captions." />
            ) : live.status === 'forbidden' ? (
              <EmptyState compact title="Captions are off" body="You are not on this meeting's participant list." />
            ) : (
              <CaptionsPanel captions={live.captions} speaker={(sid) => speakerLabel(sid, speakerNames)} />
            )}
          </Card>
        ) : panel === 'notes' ? (
          <Card>
            <NotesPanel notes={live.notes} />
          </Card>
        ) : (
          <AgendaPanel
            agenda={live.agenda}
            isHost={isHost}
            ownerName={(uid) => (uid ? nameFor(people, uid) : null)}
            onSet={(item, status) => void setAgenda(item, status)}
          />
        )}
      </ScrollView>

      {reacting ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 84, flexDirection: 'row', justifyContent: 'space-around', backgroundColor: p.surface, borderRadius: radii.full, padding: 6, borderWidth: 1, borderColor: p.line }}>
          {REACTIONS.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={r.label}
              onPress={() => {
                setReacting(false);
                void live.react(r.id);
              }}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <T variant="lead" maxFontSizeMultiplier={1.2}>
                {r.emoji}
              </T>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: insets.bottom + 12,
          paddingTop: 12,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 14,
          backgroundColor: p.surface,
          borderTopWidth: 1,
          borderTopColor: p.line,
        }}
      >
        <IconButton
          icon={call.micOn ? Microphone : MicrophoneSlash}
          label={call.micOn ? 'Mute microphone' : 'Unmute microphone'}
          tone={call.micOn ? 'card' : 'danger'}
          size={52}
          onPress={() => void call.setMic(!call.micOn).catch(() => toast({ text: 'The microphone could not be turned on. Check the app permission.', tone: 'error' }))}
        />
        <IconButton
          icon={call.cameraOn ? VideoCamera : VideoCameraSlash}
          label={call.cameraOn ? 'Turn camera off' : 'Turn camera on'}
          tone="card"
          size={52}
          onPress={() => void call.setCamera(!call.cameraOn).catch(() => toast({ text: 'The camera could not be turned on. Check the app permission.', tone: 'error' }))}
        />
        <IconButton
          icon={HandPalm}
          label={myHand ? 'Lower hand' : 'Raise hand'}
          tone={myHand ? 'active' : 'card'}
          size={52}
          onPress={() => void live.setHand(!myHand)}
        />
        <IconButton icon={Smiley} label="React" tone={reacting ? 'active' : 'card'} size={52} onPress={() => setReacting((r) => !r)} />
        <IconButton icon={PhoneDisconnect} label="Leave the call" tone="danger" size={52} onPress={() => void leave()} />
      </View>
    </View>
  );
}

function Full({ children, insetsTop }: { children: React.ReactNode; insetsTop: number }) {
  const p = useTheme();
  return <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insetsTop + 24, paddingHorizontal: space.gutter }}>{children}</View>;
}

/** A clock for the meeting time and lock expiry. */
function useNow(ms: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
