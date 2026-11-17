import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/api/ApiProvider';
import { useAskMyte } from '@/api/hooks/ask-myte';
import { useMeetings } from '@/api/hooks/meetings';
import { Button, Card, PageHead, Row, T } from '@/components/ui';
import { meetingTitle } from '@/components/feature/MeetingRow';
import { MyteAnswer } from '@/components/feature/MyteAnswer';
import { ThreadsSheet } from '@/components/feature/ThreadsSheet';
import { ArrowUp, CaretRight, Square, X } from '@/components/Icon';
import { ALL_SCOPE, LIMITS, type AskScope } from '@/lib/ask-myte/types';
import { dayLabel } from '@/lib/format';
import { unregisterPush } from '@/push/push';
import { radii, sans, size, space, useTheme } from '@/theme';

type MeetingScope = { id: string; title: string };

const SUGGESTIONS = ['What did I agree to do this week?', 'What was decided in my last meeting?', 'What is still open from my recent meetings?'];

/** The scope chip's meeting as the stream's scope (ADR-0047 D8); "all" when none is picked. */
function toScope(m: MeetingScope | null): AskScope {
  return m ? { kind: 'meeting', meeting_id: m.id, person_id: null, as_of: null, label: m.title } : ALL_SCOPE;
}

/**
 * Ask Myte: your Myte answers from your meetings, decisions, tasks and your company's documents,
 * as the words arrive, with numbered sources. Conversations are kept for you (core-api threads)
 * and reopened from History. The answer is held in memory only on this phone.
 *
 * Ask is a tab, so it stays mounted when you switch tabs or open a source. Leaving it while an
 * answer is still being written stops that answer (it keeps what streamed, and nothing is
 * stored), as the web stops it on a route change. An answer already done is left to finish
 * saving, as the web's route saves it after the browser has gone.
 */
export default function Ask() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const myte = useAskMyte();
  const [draft, setDraft] = useState('');
  const [scope, setScope] = useState<MeetingScope | null>(null);
  const [picking, setPicking] = useState(false);
  const [history, setHistory] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const count = myte.messages.length;
  const { signOut } = useAuth();
  const api = useApi();

  const latest = useRef(myte);
  latest.current = myte;
  useFocusEffect(
    useCallback(
      () => () => {
        if (latest.current.streaming) latest.current.stop();
      },
      [],
    ),
  );

  // An expired session's way out: this phone's push registration goes first, as in Settings, then
  // Clerk signs out and the shell opens sign-in.
  const signInAgain = () => void unregisterPush(api).then(() => signOut());

  useEffect(() => {
    if (count) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [count]);

  const send = (text: string) => {
    const question = text.trim().slice(0, LIMITS.question);
    if (!question || myte.busy) return;
    setDraft('');
    myte.send(question, toScope(scope), null);
  };

  const lastAnswerKey = [...myte.messages].reverse().find((m) => m.role === 'myte')?.key ?? null;
  const canSend = !!draft.trim() && !myte.busy;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 24, gap: space.gap }}
        keyboardShouldPersistTaps="handled"
      >
        <PageHead
          title="Ask"
          context={myte.title ?? "Your Myte answers from your meetings and your company's documents, with sources."}
          right={
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Button small variant="ghost" label="History" onPress={() => setHistory(true)} />
              {count ? <Button small variant="ghost" label="New chat" onPress={myte.reset} /> : null}
            </View>
          }
        />
        {count === 0 ? (
          <Card padded={false}>
            {SUGGESTIONS.map((s, i) => (
              <Row key={s} first={i === 0} onPress={() => send(s)} accessibilityLabel={`Ask: ${s}`}>
                <T variant="body" tone="ink">
                  {s}
                </T>
              </Row>
            ))}
          </Card>
        ) : (
          myte.messages.map((m) =>
            m.role === 'user' ? (
              <View key={m.key} style={{ alignSelf: 'flex-end', maxWidth: '88%', backgroundColor: p.pill, borderRadius: radii.card, paddingHorizontal: 14, paddingVertical: 10 }}>
                <T variant="body" style={{ color: p.pillOn }}>
                  {m.text}
                </T>
                {m.scope?.label ? (
                  <T variant="meta" style={{ color: p.pillOn, opacity: 0.7, marginTop: 2 }}>
                    About {m.scope.label}
                  </T>
                ) : null}
              </View>
            ) : (
              <MyteAnswer
                key={m.key}
                answer={m}
                now={myte.now}
                last={m.key === lastAnswerKey}
                onRetry={() => myte.retry(m.key)}
                onFollowup={(q) => send(q)}
                onOpen={(route) => router.push(route as never)}
                onSignIn={signInAgain}
              />
            ),
          )
        )}
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderTopColor: p.line, backgroundColor: p.surface, paddingHorizontal: space.gutter, paddingTop: 10, paddingBottom: 10, gap: 8 }}>
        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={scope ? `Asking about ${scope.title}. Change` : 'Asking across all your meetings. Narrow to one meeting'}
          style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: 32, paddingHorizontal: 10, borderRadius: radii.full, backgroundColor: scope ? p.signalSoft : p.bg2 }}
        >
          <T variant="meta" weight="600" style={{ color: scope ? p.signalInk : p.ink2 }} numberOfLines={1}>
            {scope ? scope.title : 'All your meetings'}
          </T>
          {scope ? (
            <Pressable onPress={() => setScope(null)} accessibilityRole="button" accessibilityLabel="Ask across all meetings" hitSlop={8}>
              <X size={14} color={p.signalInk} />
            </Pressable>
          ) : (
            <CaretRight size={12} color={p.ink3} />
          )}
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about a decision, a task or a meeting"
            placeholderTextColor={p.ink4}
            accessibilityLabel="Your question"
            multiline
            maxLength={LIMITS.question}
            selectionColor={p.signal}
            style={{
              flex: 1,
              minHeight: 44,
              maxHeight: 140,
              borderRadius: radii.ctl,
              borderWidth: 1,
              borderColor: p.line2,
              backgroundColor: p.bg,
              color: p.ink,
              paddingHorizontal: 14,
              paddingTop: 11,
              paddingBottom: 11,
              fontFamily: sans('400'),
              fontSize: size.body,
            }}
          />
          {myte.streaming ? (
            <Pressable
              onPress={myte.stop}
              accessibilityRole="button"
              accessibilityLabel="Stop"
              style={{ width: 44, height: 44, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: p.pill }}
            >
              <Square size={18} color={p.pillOn} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => send(draft)}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Ask"
              accessibilityState={{ disabled: !canSend }}
              style={{ width: 44, height: 44, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? p.pill : p.bg3 }}
            >
              <ArrowUp size={20} color={canSend ? p.pillOn : p.ink4} />
            </Pressable>
          )}
        </View>
      </View>
      <ScopePicker
        visible={picking}
        onClose={() => setPicking(false)}
        onPick={(s) => {
          setScope(s);
          setPicking(false);
        }}
      />
      <ThreadsSheet
        visible={history}
        activeId={myte.threadId}
        onClose={() => setHistory(false)}
        onOpen={(thread) => myte.load(thread)}
        onDeleted={(id) => {
          if (id === myte.threadId) myte.reset();
        }}
      />
    </KeyboardAvoidingView>
  );
}

function ScopePicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (s: MeetingScope | null) => void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const meetings = useMeetings();
  const items = (meetings.data?.pages[0]?.items ?? []).filter((m) => m.status === 'ended' || m.status === 'live').slice(0, 20);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: p.scrim }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View accessibilityViewIsModal style={{ maxHeight: '70%', backgroundColor: p.surface, borderTopLeftRadius: radii.hero, borderTopRightRadius: radii.hero, paddingTop: 18, paddingBottom: insets.bottom + 12 }}>
        <T variant="title" style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          Ask about
        </T>
        <ScrollView>
          <Row first onPress={() => onPick(null)} accessibilityLabel="All your meetings">
            <T variant="body" tone="ink">
              All your meetings
            </T>
          </Row>
          {items.map((m) => (
            <Row key={m.id} onPress={() => onPick({ id: m.id, title: meetingTitle(m) })} accessibilityLabel={meetingTitle(m)}>
              <T variant="body" tone="ink" numberOfLines={2}>
                {meetingTitle(m)}
              </T>
              <T variant="meta">{dayLabel(m.scheduled_start ?? m.created_at)}</T>
            </Row>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
