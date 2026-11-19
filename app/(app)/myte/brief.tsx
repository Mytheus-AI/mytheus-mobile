import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useBriefingPlayer } from '@/briefing/useBriefingPlayer';
import { Doodle } from '@/components/Doodle';
import { Button, Card, ErrorState, Row, Screen, SectionTitle, Skeleton, T } from '@/components/ui';
import { dueLabel } from '@/lib/format';
import { nearestSpeed } from '@/lib/briefing';
import type { TalkLine } from '@/lib/myte-talk';
import { useMyteTalk } from '@/myte/useMyteTalk';
import { radii, useTheme } from '@/theme';

/* "Your Myte talks you through it" (`/myte/brief`, `mytheus://myte/brief`; system.md N28): the
   widget's tap and Home's "Talk me through it" land here. Once the lists have loaded your Myte
   says your recent decisions and your open tasks, one line each, in its Aura-2 voice through the
   briefing player (lock-screen player; background audio only while it speaks, and only while this
   screen is in front). The line being said is the caption; every item is a row that opens it, and
   opening one stops the voice and lets go of the audio. */

export default function MyteBriefScreen() {
  const t = useMyteTalk();

  if (t.state === 'loading') {
    return (
      <Screen back title="Your Myte">
        <Skeleton lines={5} />
      </Screen>
    );
  }
  if (t.state === 'error') {
    return (
      <Screen back title="Your Myte" onRefresh={t.refetch} refreshing={t.refreshing}>
        <ErrorState title="Your decisions and tasks could not be loaded" onRetry={t.refetch} />
      </Screen>
    );
  }
  return (
    <Screen back title="Your Myte" onRefresh={t.refetch} refreshing={t.refreshing}>
      <Talk t={t} />
    </Screen>
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

function Talk({ t }: { t: ReturnType<typeof useMyteTalk> }) {
  const p = useTheme();
  const router = useRouter();
  const { talk, persona } = t;
  const lines = talk.lines;
  // Stop and Play are ours; the engine's playing/loading say whether it is still speaking.
  const [active, setActive] = useState(false);
  const player = useBriefingPlayer({
    briefingId: 'myte-talk',
    segments: lines,
    language: t.voice.language,
    personality: persona.personality,
    title: 'Your decisions and tasks',
    agentName: persona.name,
    rate: nearestSpeed(t.voice.rate),
    hasAudio: false,
    audioUrl: async () => null,
  });
  const speaking = active && (player.playing || player.loading);

  // The lines as they were when the voice started. The voice keeps saying those even if a refresh
  // changes the lists meanwhile, so the caption and the lit row follow them, not the new ones.
  const [said, setSaid] = useState<readonly TalkLine[]>(lines);

  const playerRef = useRef(player);
  playerRef.current = player;
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const spoke = useRef(false);

  // Opening this screen is the request to speak: once per visit, as soon as it is focused. Leaving
  // it (opening a row, switching away) stops the voice and lets go of the audio: the lock-screen
  // player and the background session never outlive the screen being in front (N24, N28).
  useFocusEffect(
    useCallback(() => {
      if (!spoke.current && linesRef.current.length) {
        spoke.current = true;
        setActive(true);
        setSaid(linesRef.current);
        void playerRef.current.play(0);
      }
      return () => {
        setActive(false);
        playerRef.current.release();
      };
    }, []),
  );

  const stop = () => {
    setActive(false);
    player.release();
  };
  const again = () => {
    setActive(true);
    setSaid(lines);
    void player.play(0);
  };

  const current = said[player.index];
  const spokenItem = speaking ? current?.itemId : undefined;
  const open = (route: string) => router.push(route as never);
  const lineOf = (id: string) => lines.find((l) => l.itemId === id);
  const noteOf = (id: string) => lines.find((l) => l.id === id);

  return (
    <View style={{ gap: 18 }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Face seed={persona.seed} size={112} speaking={speaking} />
        <T variant="display" center>
          {persona.name}
        </T>
        <T variant="secondary" center>
          Talking you through your decisions and tasks
        </T>
      </View>

      {current ? (
        <T variant="lead" style={{ fontSize: 18, lineHeight: 25 }} accessibilityLiveRegion={speaking ? 'polite' : 'none'}>
          {current.text}
        </T>
      ) : null}
      {player.error ? (
        <T variant="meta" accessibilityLiveRegion="polite">
          {player.error}. The words are all here.
        </T>
      ) : null}

      {speaking ? (
        <Button label="Stop" variant="outline" full onPress={stop} />
      ) : (
        <Button label="Talk me through it again" full onPress={again} />
      )}

      <Section
        title="Decisions"
        note={talk.decisions.length ? null : noteOf('decisions')}
        more={lines.find((l) => l.id === 'decisions-more') ?? null}
        onOpen={open}
      >
        {talk.decisions.map((d, i) => {
          const line = lineOf(d.id);
          return (
            <Row
              key={d.id}
              first={i === 0}
              onPress={() => open(line?.route ?? `/decisions/${d.id}`)}
              accessibilityLabel={`Decision: ${d.content}`}
              style={spokenItem === d.id ? { backgroundColor: p.signalSoft } : undefined}
            >
              <T variant="body" tone="ink">
                {d.content}
              </T>
              {d.meeting_title ? (
                <T variant="meta" style={{ marginTop: 4 }}>
                  {d.meeting_title}
                </T>
              ) : null}
            </Row>
          );
        })}
      </Section>

      <Section
        title="Your tasks"
        note={talk.tasks.length ? null : noteOf('tasks')}
        more={lines.find((l) => l.id === 'tasks-more') ?? null}
        onOpen={open}
      >
        {talk.tasks.map((task, i) => {
          const due = dueLabel(task.due_date);
          return (
            <Row
              key={task.id}
              first={i === 0}
              onPress={() => open(lineOf(task.id)?.route ?? '/work?tab=tasks')}
              accessibilityLabel={`Task: ${task.content}${due ? `, ${due.text.charAt(0).toLowerCase()}${due.text.slice(1)}` : ''}`}
              style={spokenItem === task.id ? { backgroundColor: p.signalSoft } : undefined}
            >
              <T variant="body" tone="ink">
                {task.content}
              </T>
              {due ? (
                <T variant="meta" style={{ marginTop: 4, color: due.overdue ? p.high : undefined }}>
                  {due.text}
                </T>
              ) : null}
            </Row>
          );
        })}
      </Section>
    </View>
  );
}

function Section({
  title,
  note,
  more,
  onOpen,
  children,
}: {
  title: string;
  note: TalkLine | null | undefined;
  more: TalkLine | null;
  onOpen: (route: string) => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 10 }}>
      <SectionTitle title={title} />
      {note ? (
        <Card>
          <T variant="secondary">{note.text}</T>
        </Card>
      ) : (
        <Card padded={false}>
          {children}
          {more?.route ? (
            <Row onPress={() => onOpen(more.route as string)} accessibilityLabel={more.text}>
              <T variant="body" tone="ink2">
                {more.text}
              </T>
            </Row>
          ) : null}
        </Card>
      )}
    </View>
  );
}
