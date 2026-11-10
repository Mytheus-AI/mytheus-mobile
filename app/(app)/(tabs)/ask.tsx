import React, { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { useAsk } from '@/api/hooks/ask';
import { useMeetings } from '@/api/hooks/meetings';
import type { AskAnswer } from '@/api/types';
import { Button, Card, PageHead, Row, T } from '@/components/ui';
import { meetingTitle } from '@/components/feature/MeetingRow';
import StreamingDots from '@/components/StreamingDots';
import { ArrowUp, CaretRight, X } from '@/components/Icon';
import { citationKind, citationRoute, splitCitations } from '@/lib/citations';
import { dayLabel } from '@/lib/format';
import { radii, sans, size, space, useTheme } from '@/theme';

interface Exchange {
  id: string;
  question: string;
  scope: { id: string; title: string } | null;
  answer: AskAnswer | null;
  error: string | null;
}

const SUGGESTIONS = ['What did I agree to do this week?', 'What was decided in my last meeting?', 'What is still open from my recent meetings?'];

function askError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.isAuthFailure) return 'Your session expired. Sign in again.';
    if (e.status === 503 || e.code === 'DEPENDENCY_UNAVAILABLE') return 'Ask is not available right now. Try again in a moment.';
    if (e.code === 'QUOTA_EXCEEDED' || e.code === 'RATE_LIMITED') return 'Your workspace has used its questions for now. Try again later.';
    if (e.code === 'NOT_A_PARTICIPANT' || e.code === 'NOT_FOUND') return 'You can only ask about meetings you took part in.';
    if (e.code === 'VALIDATION_FAILED') return 'That question is too long. Keep it under 1,000 characters.';
  }
  return 'That question could not be answered just now. Try again.';
}

/**
 * Ask across your meetings and your company's documents. Answers are grounded in sources you can
 * see and carry numbered citations; when the sources do not support an answer, it says so.
 */
export default function Ask() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const ask = useAsk();
  const [draft, setDraft] = useState('');
  const [scope, setScope] = useState<Exchange['scope']>(null);
  const [picking, setPicking] = useState(false);
  const [thread, setThread] = useState<Exchange[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  const send = async (text: string) => {
    const question = text.trim().slice(0, 1000);
    if (!question || ask.isPending) return;
    const id = `${Date.now()}`;
    setDraft('');
    setThread((t) => [...t, { id, question, scope, answer: null, error: null }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const answer = await ask.run({ question, meetingId: scope?.id ?? null });
      setThread((t) => t.map((x) => (x.id === id ? { ...x, answer } : x)));
    } catch (e) {
      setThread((t) => t.map((x) => (x.id === id ? { ...x, error: askError(e) } : x)));
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 24, gap: space.gap }}
        keyboardShouldPersistTaps="handled"
      >
        <PageHead title="Ask" context="Answers from your meetings and your company's documents, with sources." />
        {thread.length === 0 ? (
          <Card padded={false}>
            {SUGGESTIONS.map((s, i) => (
              <Row key={s} first={i === 0} onPress={() => void send(s)} accessibilityLabel={`Ask: ${s}`}>
                <T variant="body" tone="ink">
                  {s}
                </T>
              </Row>
            ))}
          </Card>
        ) : (
          thread.map((x) => <ExchangeView key={x.id} x={x} onRetry={() => void send(x.question)} />)
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
            maxLength={1000}
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
          <Pressable
            onPress={() => void send(draft)}
            disabled={!draft.trim() || ask.isPending}
            accessibilityRole="button"
            accessibilityLabel="Ask"
            accessibilityState={{ disabled: !draft.trim() || ask.isPending }}
            style={{ width: 44, height: 44, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: draft.trim() ? p.pill : p.bg3 }}
          >
            <ArrowUp size={20} color={draft.trim() ? p.pillOn : p.ink4} />
          </Pressable>
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
    </KeyboardAvoidingView>
  );
}

function ExchangeView({ x, onRetry }: { x: Exchange; onRetry: () => void }) {
  const p = useTheme();
  const router = useRouter();
  const a = x.answer;
  const parts = useMemo(() => (a?.answer ? splitCitations(a.answer, a.citations) : []), [a]);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ alignSelf: 'flex-end', maxWidth: '88%', backgroundColor: p.pill, borderRadius: radii.card, paddingHorizontal: 14, paddingVertical: 10 }}>
        <T variant="body" style={{ color: p.pillOn }}>
          {x.question}
        </T>
        {x.scope ? (
          <T variant="meta" style={{ color: p.pillOn, opacity: 0.7, marginTop: 2 }}>
            About {x.scope.title}
          </T>
        ) : null}
      </View>
      <Card style={{ gap: 10 }}>
        {x.error ? (
          <View accessibilityRole="alert" style={{ gap: 8 }}>
            <T variant="body" tone="high">
              {x.error}
            </T>
            <Button small variant="outline" label="Try again" onPress={onRetry} />
          </View>
        ) : !a ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityLabel="Finding an answer" accessibilityLiveRegion="polite">
            <T variant="secondary">Looking through your meetings</T>
            <StreamingDots visible />
          </View>
        ) : a.abstained || !a.answer ? (
          <T variant="body" accessibilityLiveRegion="polite">
            I could not find that in your meetings or your company&apos;s documents, so I will not guess.
          </T>
        ) : (
          <T variant="body" tone="ink" accessibilityLiveRegion="polite">
            {parts.map((part, i) =>
              part.kind === 'text' ? (
                part.text
              ) : (
                <T key={i} variant="meta" weight="700" style={{ color: p.signalInk }} accessibilityLabel={`source ${part.n}`}>
                  {` [${part.n}]`}
                </T>
              ),
            )}
          </T>
        )}
        {a?.degraded ? <T variant="meta">Your workspace&apos;s AI budget limited this answer.</T> : null}
        {a && a.citations.length ? (
          <View style={{ gap: 8, marginTop: 4 }}>
            <T variant="label">Sources</T>
            {a.citations.map((c) => {
              const route = citationRoute(c);
              const meta = [citationKind(c.kind), c.meeting_title, c.speaker, c.occurred_at ? dayLabel(c.occurred_at) : null].filter(Boolean).join(', ');
              return (
                <Pressable
                  key={c.n}
                  disabled={!route}
                  onPress={() => route && router.push(route as never)}
                  accessibilityRole={route ? 'link' : 'text'}
                  accessibilityLabel={`Source ${c.n}. ${meta}. ${c.text}`}
                  style={({ pressed }) => ({ flexDirection: 'row', gap: 10, padding: 10, borderRadius: radii.ctl, backgroundColor: pressed ? p.bg2 : p.surface2 })}
                >
                  <T variant="meta" weight="700" style={{ color: p.signalInk }}>
                    {c.n}
                  </T>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="meta">{meta}</T>
                    <T variant="secondary" tone="ink2" numberOfLines={4}>
                      {c.text}
                    </T>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function ScopePicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (s: Exchange['scope']) => void }) {
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
