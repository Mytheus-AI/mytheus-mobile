import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, shadows } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import { Sparkle, ArrowRight } from '@/components/icons';
import ScreenHeader from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import Tappable from '@/components/Tappable';
import { askSuggestions, recentQuestions } from '@/data/mock';

export default function AskScreen() {
  const [draft, setDraft] = useState('');

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title="Ask Reprise"
        subtitle="Answers drawn from every meeting you have captured"
        right={
          <View style={styles.brandDot}>
            <Sparkle size={16} color={colors.accent} />
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro hero */}
        <LinearGradient
          colors={gradients.overview.colors}
          locations={gradients.overview.locations}
          start={gradients.overview.start}
          end={gradients.overview.end}
          style={styles.hero}
        >
          <Sparkle size={18} color={colors.accentDeep} />
          <Text style={styles.heroTitle}>Ask anything about your meetings</Text>
          <Text style={styles.heroSub}>
            Decisions, action items, who said what - Reprise searches across every session
            and answers with sources.
          </Text>
        </LinearGradient>

        {/* Suggestions */}
        <Text style={styles.sectionLabel}>TRY ASKING</Text>
        <View style={styles.suggestions}>
          {askSuggestions.map((s) => (
            <Tappable key={s} style={styles.suggestion} onPress={() => setDraft(s)}>
              <View style={styles.suggestionDot}>
                <Sparkle size={11} color={colors.accent} />
              </View>
              <Text style={styles.suggestionText}>{s}</Text>
            </Tappable>
          ))}
        </View>

        {/* Recent answers */}
        <Text style={styles.sectionLabel}>RECENT</Text>
        <View style={styles.recent}>
          {recentQuestions.map((t) => (
            <Card key={t.id}>
              <Text style={styles.question}>{t.question}</Text>
              <View style={styles.answerRow}>
                <Sparkle size={12} color={colors.accent} />
                <Text style={styles.answer}>{t.answer}</Text>
              </View>
              <Text style={styles.when}>{t.when}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Input bar */}
      <View style={styles.askWrap}>
        <View style={styles.askBar}>
          <Sparkle size={15} color="rgba(255,255,255,0.7)" />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask anything about your meetings…"
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.input}
            multiline={false}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.send, { opacity: draft.trim() ? 1 : 0.55 }]}
            accessibilityLabel="Send question"
          >
            <ArrowRight size={17} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  brandDot: {
    width: 42,
    height: 42,
    borderRadius: 42,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.iconBtn,
  },
  scroll: { flex: 1, paddingTop: 12 },
  hero: {
    marginHorizontal: 14,
    borderRadius: radii.hero,
    padding: 20,
    overflow: 'hidden',
    ...shadows.hero,
  },
  heroTitle: {
    fontFamily: serif('600'),
    fontSize: 22,
    letterSpacing: -0.3,
    color: colors.inkDeep,
    marginTop: 12,
    lineHeight: 28,
  },
  heroSub: {
    fontFamily: sans('500'),
    fontSize: 13,
    color: colors.warmText,
    lineHeight: 19,
    marginTop: 7,
  },
  sectionLabel: {
    fontFamily: sans('800'),
    fontSize: 11.5,
    letterSpacing: 0.9,
    color: colors.mutedLabel,
    marginTop: 24,
    marginHorizontal: 18,
    marginBottom: 11,
  },
  suggestions: { marginHorizontal: 14, gap: 10 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 14,
    paddingHorizontal: 15,
    ...shadows.card,
  },
  suggestionDot: {
    width: 26,
    height: 26,
    borderRadius: 26,
    backgroundColor: colors.chipOrangeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: { flex: 1, fontFamily: sans('600'), fontSize: 14, color: colors.body },
  recent: { marginHorizontal: 14, gap: 12 },
  question: { fontFamily: sans('700'), fontSize: 14.5, color: colors.ink, letterSpacing: -0.2 },
  answerRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 9 },
  answer: { flex: 1, fontFamily: sans('500'), fontSize: 13.5, color: colors.body, lineHeight: 19.5 },
  when: { fontFamily: sans('500'), fontSize: 11, color: colors.muted, marginTop: 10 },
  askWrap: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8 },
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
