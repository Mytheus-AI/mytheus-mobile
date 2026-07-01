import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
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
import {
  Sparkle,
  ArrowRight,
  Back,
  Calendar,
  Check,
  Doc,
  Gallery,
  People as PeopleIcon,
  Clock,
  Plus,
} from '@/components/icons';
import BrandMark from '@/components/BrandMark';
import Reveal from '@/components/Reveal';
import StreamingDots from '@/components/StreamingDots';
import Tappable from '@/components/Tappable';
import {
  allMeetings,
  askAnswers,
  askFallbackAnswer,
  askSuggestions,
  currentUser,
  recentQuestions,
} from '@/data/mock';

interface Attachment {
  id: string;
  kind: 'image' | 'doc';
  name: string;
}

interface ThreadItem {
  id: string;
  question: string;
  answer: string;
  source: string;
  attachments: Attachment[];
  meetings: string[];
  /** How much of the answer has streamed in so far. */
  shown: number;
  thinking: boolean;
}

/** Mock picks; a real build wires expo-image-picker / document-picker here. */
const MOCK_IMAGES = ['Whiteboard.jpg', 'Roadmap-sketch.png', 'IMG_0231.jpg'];
const MOCK_DOCS = ['Q3-scope.pdf', 'QA-test-plan.docx', 'Launch-checklist.pdf'];

/** The @mention being typed: text after the last '@' that starts a word. */
function mentionQueryOf(text: string): string | null {
  const at = text.lastIndexOf('@');
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(text[at - 1])) return null;
  const q = text.slice(at + 1);
  if (/\n/.test(q)) return null;
  return q;
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkedMeetings, setLinkedMeetings] = useState<string[]>([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const pickCount = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const scrollY = useRef(new Animated.Value(0)).current;

  const mentionQuery = mentionQueryOf(draft);
  const mentionMatches =
    mentionQuery !== null
      ? allMeetings
          .filter(
            (m) =>
              !linkedMeetings.includes(m.title) &&
              m.title.toLowerCase().includes(mentionQuery.toLowerCase()),
          )
          .slice(0, 4)
      : [];

  const addAttachment = (kind: Attachment['kind']) => {
    const pool = kind === 'image' ? MOCK_IMAGES : MOCK_DOCS;
    const name = pool[pickCount.current++ % pool.length];
    setAttachments((prev) => [...prev, { id: `a${Date.now()}`, kind, name }]);
    setTrayOpen(false);
  };

  const linkMeeting = (title: string) => {
    setLinkedMeetings((prev) => [...prev, title]);
    const at = draft.lastIndexOf('@');
    setDraft(at >= 0 ? draft.slice(0, at) : draft);
  };

  useEffect(
    () => () => {
      timers.current.forEach(clearInterval);
    },
    [],
  );

  const busy = thread.some((t) => t.thinking || t.shown < t.answer.length);

  const ask = (question: string) => {
    const q = question.trim();
    if ((!q && attachments.length === 0 && linkedMeetings.length === 0) || busy) return;
    setDraft('');
    setTrayOpen(false);
    const canned = askAnswers[q] ?? askFallbackAnswer;
    // A linked meeting scopes the answer's source.
    const source = linkedMeetings.length > 0 ? linkedMeetings.join(' · ') : canned.source;
    const sent = {
      attachments,
      meetings: linkedMeetings,
    };
    setAttachments([]);
    setLinkedMeetings([]);
    const id = `t${Date.now()}`;
    setThread((prev) => [
      ...prev,
      {
        id,
        question: q || 'Take a look at this.',
        answer: canned.answer,
        source,
        ...sent,
        shown: 0,
        thinking: true,
      },
    ]);

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

  // The big squiggle lives in the scroll content; as it scrolls away (or
  // once a conversation starts) a mini mark docks at the top right.
  const miniLogoOpacity = inConversation
    ? 1
    : scrollY.interpolate({ inputRange: [70, 150], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      // Android runs edge-to-edge on SDK 54+, so adjustResize never fires;
      // both platforms need explicit padding for the composer to stay visible.
      behavior="padding"
    >
      {/* The tab bar is hidden on this surface, so provide the way back. */}
      <View style={[styles.backWrap, { top: insets.top + 8 }]}>
        <Tappable scaleTo={0.9} onPress={() => router.navigate('/')}>
          <View style={styles.backBtn}>
            <Back size={18} color={colors.warmText3} />
          </View>
        </Tappable>
      </View>

      {/* Mini mark docked top-right once the big one scrolls away */}
      <Animated.View
        pointerEvents="none"
        style={[styles.miniLogo, { top: insets.top + 16, opacity: miniLogoOpacity }]}
      >
        <BrandMark width={46} strokeWidth={9} />
      </Animated.View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
      >
        {/* Greeting - the Claude-style open surface; steps aside in conversation */}
        {!inConversation ? (
          <View style={styles.greeting}>
            <BrandMark width={84} strokeWidth={8} animated duration={1500} delay={200} />
            <Text style={styles.greetingTitle}>
              What do you want to know, {firstName}?
            </Text>
            <Text style={styles.greetingSub}>I remember every meeting you&apos;ve captured.</Text>
          </View>
        ) : (
          <View style={{ height: 52 }} />
        )}

        {/* Conversation */}
        {thread.map((t) => (
          <View key={t.id} style={styles.exchange}>
            <View style={styles.questionBubble}>
              <Text style={styles.questionText}>{t.question}</Text>
              {t.attachments.length > 0 || t.meetings.length > 0 ? (
                <View style={styles.sentChips}>
                  {t.meetings.map((m) => (
                    <View key={m} style={styles.sentChip}>
                      <Calendar size={11} color={colors.warmText3} />
                      <Text style={styles.sentChipText}>{m}</Text>
                    </View>
                  ))}
                  {t.attachments.map((a) => (
                    <View key={a.id} style={styles.sentChip}>
                      {a.kind === 'image' ? (
                        <Gallery size={12} color={colors.warmText3} />
                      ) : (
                        <Doc size={12} color={colors.warmText3} />
                      )}
                      <Text style={styles.sentChipText}>{a.name}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
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

      {/* Composer deck */}
      <View style={[styles.askWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {/* @meeting suggestions */}
        {mentionMatches.length > 0 ? (
          <View style={styles.popover}>
            <Text style={styles.popoverLabel}>LINK A MEETING</Text>
            {mentionMatches.map((m) => (
              <Tappable key={m.id} onPress={() => linkMeeting(m.title)}>
                <View style={styles.popoverRow}>
                  <View style={styles.popoverIcon}>
                    <Calendar size={13} color={colors.accentDeep} />
                  </View>
                  <Text style={styles.popoverTitle} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={styles.popoverWhen}>{m.when}</Text>
                </View>
              </Tappable>
            ))}
          </View>
        ) : null}

        <View style={styles.deck}>
          {/* Attach options live inside the deck so they read as part of it */}
          {trayOpen && mentionMatches.length === 0 ? (
            <View style={styles.trayRow}>
              <Tappable onPress={() => addAttachment('image')}>
                <View style={styles.trayOption}>
                  <Gallery size={15} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.trayText}>Photo</Text>
                </View>
              </Tappable>
              <Tappable onPress={() => addAttachment('doc')}>
                <View style={styles.trayOption}>
                  <Doc size={15} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.trayText}>Document</Text>
                </View>
              </Tappable>
            </View>
          ) : null}
          {/* Staged context: linked meetings + attachments */}
          {attachments.length > 0 || linkedMeetings.length > 0 ? (
            <View style={styles.stagedRow}>
              {linkedMeetings.map((m) => (
                <View key={m} style={[styles.stagedChip, styles.stagedMeeting]}>
                  <Calendar size={11} color={colors.white} />
                  <Text style={styles.stagedText} numberOfLines={1}>
                    {m}
                  </Text>
                  <Tappable onPress={() => setLinkedMeetings((p) => p.filter((x) => x !== m))}>
                    <Text style={styles.stagedRemove}>×</Text>
                  </Tappable>
                </View>
              ))}
              {attachments.map((a) => (
                <View key={a.id} style={styles.stagedChip}>
                  {a.kind === 'image' ? (
                    <Gallery size={12} color="rgba(255,255,255,0.8)" />
                  ) : (
                    <Doc size={12} color="rgba(255,255,255,0.8)" />
                  )}
                  <Text style={styles.stagedText} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Tappable onPress={() => setAttachments((p) => p.filter((x) => x.id !== a.id))}>
                    <Text style={styles.stagedRemove}>×</Text>
                  </Tappable>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.inputRow}>
            <Tappable scaleTo={0.88} onPress={() => setTrayOpen((o) => !o)}>
              <View style={[styles.plusBtn, trayOpen && styles.plusBtnActive]}>
                <Plus size={17} color={trayOpen ? colors.white : 'rgba(255,255,255,0.75)'} />
              </View>
            </Tappable>
            <TextInput
              value={draft}
              onChangeText={(t) => {
                setDraft(t);
                if (trayOpen) setTrayOpen(false);
              }}
              onSubmitEditing={() => ask(draft)}
              placeholder="Ask anything · @ links a meeting"
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={styles.input}
              multiline={false}
              returnKeyType="send"
            />
            <Tappable scaleTo={0.88} onPress={() => ask(draft)}>
              <View
                style={[
                  styles.send,
                  {
                    opacity:
                      (draft.trim() || attachments.length || linkedMeetings.length) && !busy
                        ? 1
                        : 0.55,
                  },
                ]}
              >
                <ArrowRight size={17} color={colors.white} />
              </View>
            </Tappable>
          </View>
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
    fontSize: 27,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: colors.inkDeep,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 30,
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
  sentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  sentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  sentChipText: { fontFamily: sans('700'), fontSize: 11, color: colors.warmText3 },

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
  miniLogo: { position: 'absolute', right: 18, zIndex: 10 },
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

  popover: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    ...shadows.card,
  },
  popoverLabel: {
    fontFamily: sans('800'),
    fontSize: 10,
    letterSpacing: 0.9,
    color: colors.mutedLabel,
    marginBottom: 4,
    marginLeft: 4,
  },
  popoverRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  popoverIcon: {
    width: 28,
    height: 28,
    borderRadius: 28,
    backgroundColor: colors.chipOrangeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popoverTitle: { flex: 1, fontFamily: sans('600'), fontSize: 13.5, color: colors.ink },
  popoverWhen: { fontFamily: sans('500'), fontSize: 11.5, color: colors.muted },
  trayRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 6,
    paddingTop: 5,
    paddingBottom: 10,
  },
  trayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  trayText: { fontFamily: sans('700'), fontSize: 13, color: colors.white },

  deck: {
    backgroundColor: colors.dark,
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 8,
    ...shadows.control,
  },
  stagedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    paddingHorizontal: 6,
    paddingTop: 5,
    paddingBottom: 9,
  },
  stagedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 6,
    maxWidth: '100%',
  },
  stagedMeeting: { backgroundColor: 'rgba(217,119,87,0.38)' },
  stagedText: {
    fontFamily: sans('600'),
    fontSize: 12,
    color: colors.white,
    flexShrink: 1,
  },
  stagedRemove: {
    fontFamily: sans('700'),
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 5,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 2,
  },
  plusBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBtnActive: { backgroundColor: 'rgba(217,119,87,0.45)' },
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
