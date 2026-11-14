import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { useBriefingAudioUrl, useBriefingHeard, useBriefMe, useSaveBriefingPreferences } from '@/api/hooks/briefings';
import { Button, Card, Chip, Skeleton, T, useToast } from '@/components/ui';
import { Doodle } from '@/components/Doodle';
import { ArrowUpRight, Sparkle } from '@/components/Icon';
import { useBriefingPlayer } from '@/briefing/useBriefingPlayer';
import {
  KIND_LABEL,
  SPEEDS,
  agentSeed,
  clock,
  coverLine,
  isWriting,
  momentLabel,
  momentRoute,
  nearestSpeed,
  segmentStarts,
  speedLabel,
  unavailableCopy,
  type Briefing,
  type BriefingPreferences,
} from '@/lib/briefing';
import { radii, TOUCH, useTheme } from '@/theme';
import Svg, { Path } from 'react-native-svg';

/* A briefing from your agent on the phone.

   `BriefingPanel` (Home, a meeting): the agent's face and name, Play right there, the line being
   said, and "Open the briefing" for the full screen. Every other state is drawn: nothing yet
   (Brief me), being written (polled by the hook), nothing to say, could not be written (Try
   again).

   `BriefingFull` (the screen a push opens): built for the lock screen and one hand: a big face,
   a 72 pt Play, skip either side, speed, and the transcript with the point being said lit and
   each point one tap from where it came from. A new briefing starts by itself when the person
   turned auto-play on. */

const DEFAULTS: BriefingPreferences = { enabled: true, auto_play: false, length: 'standard', language: 'en', voice: null, server_voice: null, rate: 1 };

function PlayGlyph({ playing, color, size }: { playing: boolean; color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" accessible={false}>
      {playing ? (
        <Path fill={color} d="M200,32H160a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-104,0H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Z" />
      ) : (
        <Path fill={color} d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z" />
      )}
    </Svg>
  );
}

function SkipGlyph({ back, color }: { back?: boolean; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 256 256" accessible={false} style={back ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Path fill={color} d="M200,32a8,8,0,0,0-8,8v69.23L72.43,34.45A15.95,15.95,0,0,0,48,47.88V208.12a16,16,0,0,0,24.43,13.43L192,146.77V216a8,8,0,0,0,16,0V40A8,8,0,0,0,200,32Z" />
    </Svg>
  );
}

function Face({ seed, size, speaking }: { seed: string; size: number; speaking: boolean }) {
  const p = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size + 10,
        height: size + 10,
        borderRadius: radii.full,
        borderWidth: 2,
        borderColor: speaking ? p.signalLine : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: size, height: size, borderRadius: radii.full, overflow: 'hidden', backgroundColor: p.surface }}>
        <Doodle seed={seed} size={size} />
      </View>
    </View>
  );
}

/** The voice could not be reached: said quietly, and the words stay on screen. */
function VoiceNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <T variant="meta" accessibilityLiveRegion="polite">
      {error}. The words are all here.
    </T>
  );
}

/** Not ready: nothing yet, being written, nothing to say, could not be written. */
function NotReady({
  briefing,
  seed,
  meetingId,
  canRequest,
  enabled,
}: {
  briefing: Briefing | null;
  seed: string;
  meetingId: string | null;
  canRequest: boolean;
  enabled: boolean;
}) {
  const ask = useBriefMe(meetingId);
  const toast = useToast();
  const writing = isWriting(briefing);
  const title = writing
    ? `${briefing?.agent.name ?? 'Your Myte'} is writing your briefing`
    : briefing?.status === 'empty'
      ? 'Nothing needs you right now'
      : briefing?.status === 'unavailable'
        ? 'Your briefing could not be written'
        : 'A briefing from your Myte';
  const body = writing
    ? 'About 90 seconds of what changed for you, who is waiting on you, your promises and what is still open.'
    : briefing?.status === 'empty'
      ? 'Nothing changed for you and nobody is waiting on you. Your Myte will brief you when something comes up.'
      : briefing?.status === 'unavailable'
        ? unavailableCopy(briefing.reason)
        : !canRequest
          ? 'Your Myte can brief you on this meeting once it has ended.'
          : enabled
            ? 'What changed for you, who is waiting on you, your promises and the questions still open, in your Myte\'s voice.'
            : 'Briefings after meetings are off. You can still ask for one.';
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Face seed={seed} size={48} speaking={writing} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant="label">Your briefing</T>
          <T variant="title" accessibilityLiveRegion="polite">
            {title}
          </T>
        </View>
      </View>
      <T variant="secondary">{body}</T>
      {writing ? <Skeleton lines={3} card={false} /> : null}
      {!writing && canRequest ? (
        <Button
          label={ask.isPending ? 'Asking your Myte' : briefing ? (briefing.status === 'unavailable' ? 'Try again' : 'Ask again') : 'Brief me'}
          icon={Sparkle}
          variant={briefing ? 'outline' : 'primary'}
          busy={ask.isPending}
          onPress={() =>
            void ask.run(undefined).catch((e: unknown) => {
              const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
              toast({ text: code === 'RATE_LIMITED' ? 'That is a lot of briefings for one hour. Try again later.' : 'Your Myte could not be asked just now.' });
            })
          }
        />
      ) : null}
    </Card>
  );
}

function useReady(briefing: Briefing, prefs: BriefingPreferences, ownerKey: string) {
  const heard = useBriefingHeard();
  const audioUrl = useBriefingAudioUrl();
  const seed = agentSeed(briefing.agent.seed, ownerKey);
  const player = useBriefingPlayer({
    briefingId: briefing.id,
    segments: briefing.segments,
    language: briefing.language,
    personality: briefing.agent.personality ?? 'balanced',
    title: briefing.meeting_title ? `Briefing: ${briefing.meeting_title}` : 'Your briefing',
    agentName: briefing.agent.name,
    rate: nearestSpeed(prefs.rate),
    hasAudio: briefing.audio.status === 'ready',
    audioUrl,
    onFirstPlay: () => {
      if (!briefing.listened_at) void heard.run(briefing.id).catch(() => undefined);
    },
  });
  const total = (briefing.duration_s || 0) / nearestSpeed(prefs.rate);
  return { player, seed, total };
}

export function BriefingPanel({
  briefing,
  prefs,
  meetingId = null,
  canRequest = true,
  enabled = true,
}: {
  briefing: Briefing | null;
  prefs: BriefingPreferences | null;
  meetingId?: string | null;
  canRequest?: boolean;
  enabled?: boolean;
}) {
  const { user } = useUser();
  const ownerKey = user?.id ?? '';
  if (!briefing || briefing.status !== 'ready') {
    return (
      <NotReady
        briefing={briefing}
        seed={agentSeed(briefing?.agent.seed, ownerKey)}
        meetingId={meetingId}
        canRequest={canRequest}
        enabled={enabled}
      />
    );
  }
  return <ReadyPanel briefing={briefing} prefs={prefs ?? DEFAULTS} ownerKey={ownerKey} />;
}

function ReadyPanel({ briefing, prefs, ownerKey }: { briefing: Briefing; prefs: BriefingPreferences; ownerKey: string }) {
  const p = useTheme();
  const router = useRouter();
  const { player, seed, total } = useReady(briefing, prefs, ownerKey);
  const current = briefing.segments[player.index];
  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Face seed={seed} size={52} speaking={player.playing} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T variant="label">{coverLine(briefing)}</T>
          <T variant="title">A briefing from {briefing.agent.name}</T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip label={`${clock(total)} long`} />
            {!briefing.listened_at ? <Chip label="New" tone="signal" /> : null}
          </View>
        </View>
      </View>
      {current ? (
        <T variant="lead" style={{ fontSize: 18, lineHeight: 25 }} accessibilityLiveRegion={player.playing ? 'polite' : 'none'}>
          {current.text}
        </T>
      ) : null}
      <VoiceNote error={player.error} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable
          onPress={player.toggle}
          accessibilityRole="button"
          accessibilityLabel={player.playing ? 'Pause briefing' : 'Play briefing'}
          accessibilityState={{ busy: player.loading }}
          style={({ pressed }) => [styles.play, { width: 56, height: 56, backgroundColor: pressed ? p.pill2 : p.pill }]}
        >
          <PlayGlyph playing={player.playing} color={p.pillOn} size={22} />
        </Pressable>
        <Beads segments={briefing.segments} progress={player.progress} />
      </View>
      <Pressable
        onPress={() => router.push(`/briefings/${briefing.id}`)}
        accessibilityRole="link"
        accessibilityLabel="Open the briefing"
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: TOUCH }}
      >
        <T variant="body" weight="600" tone="ink2">
          Open the briefing
        </T>
        <ArrowUpRight size={16} color={p.ink3} />
      </Pressable>
    </Card>
  );
}

function Beads({ segments, progress }: { segments: Briefing['segments']; progress: number }) {
  const p = useTheme();
  const starts = segmentStarts(segments);
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: 3, alignItems: 'center' }} accessible accessibilityLabel={`${Math.round(progress * 100)} percent played`}>
      {segments.map((s, i) => {
        const from = starts[i] ?? 0;
        const to = starts[i + 1] ?? 1;
        const fill = progress >= to ? 1 : progress <= from ? 0 : (progress - from) / (to - from);
        return (
          <View key={s.id} style={{ flex: to - from, height: 6, borderRadius: radii.full, backgroundColor: p.bg3, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(fill * 100)}%`, height: '100%', backgroundColor: p.signal }} />
          </View>
        );
      })}
    </View>
  );
}

/** The full briefing screen (where its push lands). */
export function BriefingFull({ briefing, prefs }: { briefing: Briefing; prefs: BriefingPreferences | null }) {
  const p = useTheme();
  const router = useRouter();
  const { user } = useUser();
  const toast = useToast();
  const save = useSaveBriefingPreferences();
  const settings = prefs ?? DEFAULTS;
  const { player, seed, total } = useReady(briefing, settings, user?.id ?? '');
  const tried = useRef(false);

  // Auto-play a new briefing when the person turned it on (a tap on the push lands here).
  useEffect(() => {
    if (tried.current || !settings.auto_play || briefing.listened_at) return;
    tried.current = true;
    void player.play();
  }, [settings.auto_play, briefing.listened_at, player]);

  return (
    <View style={{ gap: 18 }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Face seed={seed} size={112} speaking={player.playing} />
        <T variant="label" center>
          {coverLine(briefing)}
        </T>
        <T variant="display" center>
          A briefing from {briefing.agent.name}
        </T>
        <T variant="meta" center>
          {clock(total)} long
          {player.engine === 'audio' ? ', recorded voice' : ''}
        </T>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <Pressable onPress={player.prev} accessibilityRole="button" accessibilityLabel="Previous point" hitSlop={10} style={styles.skip} disabled={player.index === 0}>
          <SkipGlyph back color={player.index === 0 ? p.ink4 : p.ink2} />
        </Pressable>
        <Pressable
          onPress={player.toggle}
          accessibilityRole="button"
          accessibilityLabel={player.playing ? 'Pause briefing' : player.finished ? 'Play briefing again' : 'Play briefing'}
          accessibilityState={{ busy: player.loading }}
          style={({ pressed }) => [styles.play, { width: 76, height: 76, backgroundColor: pressed ? p.pill2 : p.pill }]}
        >
          <PlayGlyph playing={player.playing} color={p.pillOn} size={30} />
        </Pressable>
        <Pressable
          onPress={player.next}
          accessibilityRole="button"
          accessibilityLabel="Next point"
          hitSlop={10}
          style={styles.skip}
          disabled={player.index >= briefing.segments.length - 1}
        >
          <SkipGlyph color={player.index >= briefing.segments.length - 1 ? p.ink4 : p.ink2} />
        </Pressable>
      </View>
      <Beads segments={briefing.segments} progress={player.progress} />
      <View style={{ alignItems: 'center' }}>
        <VoiceNote error={player.error} />
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="Speed" style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        {SPEEDS.map((s) => {
          const on = nearestSpeed(settings.rate) === s;
          return (
            <Pressable
              key={s}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`Speed ${speedLabel(s)}`}
              onPress={() =>
                void save.run({ ...settings, rate: s }).then(
                  () => toast({ text: 'Speed saved' }),
                  () => toast({ text: 'Your speed could not be saved.' }),
                )
              }
              style={{ minHeight: 40, minWidth: 52, paddingHorizontal: 12, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? p.signalSoft : p.bg2 }}
            >
              <T variant="body" weight="600" style={{ color: on ? p.signalInk : p.ink2 }}>
                {speedLabel(s)}
              </T>
            </Pressable>
          );
        })}
      </View>

      <Card padded={false}>
        {briefing.segments.map((s, i) => {
          const active = i === player.index && (player.playing || player.progress > 0);
          const route = momentRoute(s.link);
          return (
            <View key={s.id} style={[styles.seg, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.line }, active && { backgroundColor: p.signalSoft }]}>
              <Pressable onPress={() => void player.play(i)} accessibilityRole="button" accessibilityLabel={`Play from: ${s.text}`} accessibilityState={{ selected: active }}>
                <T variant="label">{KIND_LABEL[s.kind]}</T>
                <T variant="body" tone={active ? 'ink' : 'ink2'}>
                  {s.text}
                </T>
              </Pressable>
              {route ? (
                <Pressable onPress={() => router.push(route as never)} accessibilityRole="link" hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, alignSelf: 'flex-start' }}>
                  <T variant="secondary" weight="600" tone="ink2">
                    {momentLabel(s.link)}
                  </T>
                  <ArrowUpRight size={14} color={p.ink3} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  play: { borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  skip: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  seg: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
});
