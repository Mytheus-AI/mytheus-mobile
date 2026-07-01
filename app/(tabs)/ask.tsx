import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import { Sparkle, ArrowRight, Back, Check, People as PeopleIcon, Clock } from '@/components/icons';
import BrandMark from '@/components/BrandMark';
import Reveal from '@/components/Reveal';
import StreamingDots from '@/components/StreamingDots';
import Tappable from '@/components/Tappable';
import {
  askAnswers,
  askFallbackAnswer,
  askSuggestions,
  currentUser,
  recentQuestions,
} from '@/data/mock';

interface ThreadItem {
  id: string;
  question: string;
  answer: string;
  source: string;
  /** How much of the answer has streamed in so far. */
  shown: number;
  thinking: boolean;
}

const SUGGESTION_ICONS = [
  (c: string) => <Check size={11} color={c} />,
  (c: string) => <Sparkle size={11} color={c} />,
  (c: string) => <Clock size={11} color={c} />,
  (c: string) => <PeopleIcon size={12} color={c} />,
];

export default function AskScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearInterval);
    },
    [],
  );

  const busy = thread.some((t) => t.thinking || t.shown < t.answer.length);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setDraft('');
    const { answer, source } = askAnswers[q] ?? askFallbackAnswer;
    const id = `t${Date.now()}`;
    setThread((prev) => [...prev, { id, question: q, answer, source, shown: 0, thinking: true }]);

    // Think briefly, then stream the answer in a few characters at a time.
    setTimeout(() => {
      setThread((prev) => prev.map((t) => (t.id === id ? { ...t, thinking: false } : t)));
      const timer = setInterval(() => {
        setThread((prev) => {
          const item = prev.find((t) => t.id === id);
          if (!item) return prev;
          if (item.shown >= item.answer.length) {
            clearInterval(timer);
            return prev;
          }
          return prev.map((t) =>
            t.id === id ? { ...t, shown: Math.min(t.shown + 3, t.answer.length) } : t,
          );
        });
      }, 24);
      timers.current.push(timer);
    }, 1300);
  };

  useEffect(() => {
    if (thread.length) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
      return () => clearTimeout(t);
    }
  }, [thread]);

  const firstName = currentUser.name.split(' ')[0];
  const inConversation = thread.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* The tab bar is hidden on this surface, so provide the way back. */}
      <View style={[styles.backWrap, { top: insets.top + 8 }]}>
        <Tappable scaleTo={0.9} onPress={() => router.navigate('/')}>
          <View style={styles.backBtn}>
            <Back size={18} color={colors.warmText3} />
          </View>
        </Tappable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={[styles.scroll, { paddingTop: insets.top + 18 }]}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Greeting - the Claude-style open surface */}
        <View style={styles.greeting}>
          <BrandMark width={84} strokeWidth={8} animated duration={1500} delay={200} />
          <Text style={styles.greetingTitle}>
            What do you want to know,{'\n'}
            {firstName}?
          </Text>
          <Text style={styles.greetingSub}>I remember every meeting you&apos;ve captured.</Text>
        </View>

        {/* Conversation */}
        {thread.map((t) => (
          <View key={t.id} style={styles.exchange}>
            <View style={styles.questionBubble}>
              <Text style={styles.questionText}>{t.question}</Text>
            </View>

            <View style={styles.answerBlock}>
              <View style={styles.answerHead}>
                <View style={styles.answerBadge}>
                  <Sparkle size={11} color={colors.accent} />
                </View>
                <Text style={styles.answerAuthor}>Mytheus</Text>
                <StreamingDots visible={t.thinking} />
              </View>
              {!t.thinking ? (
                <>
                  <Text style={styles.answerText}>{t.answer.slice(0, t.shown)}</Text>
                  {t.shown >= t.answer.length ? (
                    <View style={styles.sourceRow}>
                      <View style={styles.sourcePill}>
                        <Text style={styles.sourceText}>{t.source}</Text>
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          </View>
        ))}

        {inConversation && !busy ? (
          <Tappable onPress={() => setThread([])}>
            <Text style={styles.clear}>Start over</Text>
          </Tappable>
        ) : null}

        {/* Suggestions + recent, only on the fresh surface */}
        {!inConversation ? (
          <>
            <Reveal delay={120}>
              <View style={styles.chipsWrap}>
                {askSuggestions.map((s, i) => {
                  const icon = SUGGESTION_ICONS[i % SUGGESTION_ICONS.length];
                  return (
                    <Tappable key={s} onPress={() => ask(s)}>
                      <View style={styles.chip}>
                        <View style={styles.chipIcon}>{icon(colors.accentDeep)}</View>
                        <Text style={styles.chipText} numberOfLines={1}>
                          {s}
                        </Text>
                      </View>
                    </Tappable>
                  );
                })}
              </View>
            </Reveal>

            <Reveal delay={240}>
              <Text style={styles.sectionLabel}>PREVIOUSLY ASKED</Text>
              <View style={styles.recent}>
                {recentQuestions.map((t) => (
                  <Tappable key={t.id} onPress={() => ask(t.question)}>
                    <View style={styles.recentCard}>
                      <Text style={styles.recentQuestion}>{t.question}</Text>
                      <Text style={styles.recentAnswer} numberOfLines={2}>
                        {t.answer}
                      </Text>
                      <Text style={styles.recentWhen}>{t.when}</Text>
                    </View>
                  </Tappable>
                ))}
              </View>
            </Reveal>
          </>
        ) : null}
      </ScrollView>

      {/* Input bar */}
      <View style={[styles.askWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.askBar}>
          <Sparkle size={15} color={busy ? colors.accent : 'rgba(255,255,255,0.7)'} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => ask(draft)}
            placeholder="Ask anything about your meetings…"
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.input}
            multiline={false}
            returnKeyType="send"
          />
          <Tappable scaleTo={0.88} onPress={() => ask(draft)}>
            <View style={[styles.send, { opacity: draft.trim() && !busy ? 1 : 0.55 }]}>
              <ArrowRight size={17} color={colors.white} />
            </View>
          </Tappable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flex: 1, paddingHorizontal: 18 },

  greeting: { alignItems: 'center', paddingTop: 8, paddingBottom: 26 },
  greetingTitle: {
    fontFamily: serif('600'),
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -0.4,
    color: colors.inkDeep,
    textAlign: 'center',
    marginTop: 18,
  },
  greetingSub: {
    fontFamily: sans('500'),
    fontSize: 13.5,
    color: colors.mutedDeep,
    marginTop: 9,
  },

  chipsWrap: { gap: 9 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.navBorder,
    ...shadows.iconBtn,
  },
  chipIcon: {
    width: 26,
    height: 26,
    borderRadius: 26,
    backgroundColor: colors.chipOrangeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { flex: 1, fontFamily: sans('600'), fontSize: 13.5, color: colors.body },

  sectionLabel: {
    fontFamily: sans('800'),
    fontSize: 11.5,
    letterSpacing: 0.9,
    color: colors.mutedLabel,
    marginTop: 30,
    marginBottom: 11,
    marginHorizontal: 4,
  },
  recent: { gap: 11 },
  recentCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  recentQuestion: {
    fontFamily: serif('600'),
    fontSize: 15.5,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  recentAnswer: {
    fontFamily: sans('500'),
    fontSize: 13,
    color: colors.mutedDeep,
    lineHeight: 18.5,
    marginTop: 6,
  },
  recentWhen: { fontFamily: sans('600'), fontSize: 11, color: colors.mutedAlt, marginTop: 9 },

  exchange: { marginBottom: 22 },
  questionBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: colors.chipOrangeBg,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingVertical: 11,
    paddingHorizontal: 15,
  },
  questionText: { fontFamily: sans('600'), fontSize: 14, color: colors.warmText3, lineHeight: 19.5 },

  answerBlock: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderTopLeftRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  answerBadge: {
    width: 22,
    height: 22,
    borderRadius: 22,
    backgroundColor: colors.chipOrangeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerAuthor: { fontFamily: sans('800'), fontSize: 12, color: colors.warmText3 },
  answerText: {
    fontFamily: sans('500'),
    fontSize: 14,
    color: colors.body,
    lineHeight: 20.5,
    marginTop: 10,
  },
  sourceRow: { flexDirection: 'row', marginTop: 12 },
  sourcePill: {
    backgroundColor: colors.chipNeutralBg,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  sourceText: { fontFamily: sans('700'), fontSize: 11, color: colors.chipNeutralText },

  clear: {
    fontFamily: sans('700'),
    fontSize: 12.5,
    color: colors.mutedDeep,
    textAlign: 'center',
    paddingVertical: 6,
  },

  backWrap: { position: 'absolute', left: 16, zIndex: 10 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.iconBtn,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.iconBtn,
  },
  askWrap: { paddingHorizontal: 14, paddingTop: 8 },
  askBar: {
    backgroundColor: colors.dark,
    borderRadius: 20,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...shadows.control,
  },
  input: { flex: 1, fontFamily: sans('500'), fontSize: 13.5, color: colors.white, padding: 0 },
  send: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
