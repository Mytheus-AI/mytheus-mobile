import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, shadows } from '@/theme/tokens';
import { sans, serif } from '@/theme/typography';
import { Sparkle, Play, Pause } from '@/components/icons';
import AppHeader from '@/components/AppHeader';
import BrandMark from '@/components/BrandMark';
import Reveal from '@/components/Reveal';
import Tappable from '@/components/Tappable';
import Waveform, { LIVE_WAVE_HEIGHTS } from '@/components/Waveform';
import TranscriptLine from '@/components/TranscriptLine';
import { Card } from '@/components/Card';
import { KeyPointsCard, DecisionCard } from '@/components/SummaryBlocks';
import ActionItemRow from '@/components/ActionItemRow';
import {
  liveTranscript,
  keyPoints,
  decisionText,
  actionItems,
  session,
  type TranscriptLineData,
} from '@/data/mock';

type Checks = Record<'a' | 'b' | 'c', boolean>;

function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Scripted live-caption timeline, driven by a 50ms tick that only advances
 * while the room is being listened to (pausing freezes it mid-sentence).
 */
const D_BASE = liveTranscript[2].text; // 'Agreed. We should loop in support before we'
const D_REST = ' commit publicly.';
const P_TEXT = "I'll get the scope doc circulated by end of day.";

const T_D_TYPE = 20; // Dana resumes typing
const T_D_DONE = T_D_TYPE + D_REST.length;
const T_D_FINAL = T_D_DONE + 24; // her line settles with a timestamp
const T_P_START = T_D_FINAL + 30; // Priya starts speaking
const T_P_DONE = T_P_START + P_TEXT.length;
const T_P_FINAL = T_P_DONE + 24;
const T_M_JOIN = T_P_FINAL + 36; // Marcus joins, dots only
const T_END = T_M_JOIN;

function linesAt(tick: number): TranscriptLineData[] {
  const lines: TranscriptLineData[] = [liveTranscript[0], liveTranscript[1]];

  const dChars = Math.max(0, Math.min(tick - T_D_TYPE, D_REST.length));
  const dFinal = tick >= T_D_FINAL;
  lines.push({
    ...liveTranscript[2],
    text: D_BASE + D_REST.slice(0, dChars),
    time: dFinal ? '12:34' : 'now',
    live: !dFinal,
    partial: !dFinal,
  });

  if (tick >= T_P_START) {
    const pChars = Math.max(0, Math.min(tick - T_P_START, P_TEXT.length));
    const pFinal = tick >= T_P_FINAL;
    lines.push({
      id: 't4-live',
      initial: 'P',
      color: colors.speakerP,
      name: 'Priya',
      time: pFinal ? '12:36' : 'now',
      text: P_TEXT.slice(0, pChars),
      live: !pFinal,
      partial: !pFinal,
    });
  }

  if (tick >= T_M_JOIN) {
    lines.push({
      id: 't5-live',
      initial: 'M',
      color: colors.speakerM,
      name: 'Marcus',
      time: 'now',
      text: '',
      live: true,
      partial: true,
    });
  }

  return lines;
}

export default function LiveSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [elapsed, setElapsed] = useState(767); // 12:47, matching the draft
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [checks, setChecks] = useState<Checks>({ a: false, b: false, c: false });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scriptTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const listening = !paused && !stopped;

  useEffect(() => {
    timer.current = setInterval(() => {
      setElapsed((e) => (!paused && !stopped ? e + 1 : e));
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, stopped]);

  useEffect(() => {
    if (!listening) return;
    scriptTimer.current = setInterval(() => {
      setTick((t) => {
        if (t >= T_END && scriptTimer.current) clearInterval(scriptTimer.current);
        return Math.min(t + 1, T_END);
      });
    }, 50);
    return () => {
      if (scriptTimer.current) clearInterval(scriptTimer.current);
    };
  }, [listening]);

  const lines = useMemo(() => linesAt(tick), [tick]);
  const summarizing =
    (tick >= T_D_DONE && tick < T_D_FINAL) || (tick >= T_P_DONE && tick < T_P_FINAL);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const recLabel = stopped ? 'Ended' : paused ? 'Paused' : 'Recording';
  const recDotColor = listening ? colors.accent : '#B7B1A6';
  const statusText = stopped ? 'Session saved' : paused ? 'Paused' : 'Listening to the room';

  const toggle = (k: 'a' | 'b' | 'c') => setChecks((c) => ({ ...c, [k]: !c[k] }));

  return (
    <View style={styles.screen}>
      <AppHeader
        title="Meeting Pod"
        onBack={goBack}
        center={
          <View style={styles.brand}>
            <Sparkle size={15} color={colors.accent} />
            <Text style={styles.brandText}>Meeting Pod</Text>
          </View>
        }
        right={
          <View style={styles.dots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Recording hero */}
        <Reveal>
          <LinearGradient
            colors={gradients.hero.colors}
            locations={gradients.hero.locations}
            start={gradients.hero.start}
            end={gradients.hero.end}
            style={styles.hero}
          >
            <View style={styles.heroWatermark} pointerEvents="none">
              <BrandMark width={280} color="rgba(255,255,255,0.30)" strokeWidth={7} />
            </View>
            <View style={styles.heroTop}>
              <View style={styles.recPill}>
                <RecDot color={recDotColor} active={listening} />
                <Text style={styles.recLabel}>{recLabel}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.elapsedLabel}>ELAPSED</Text>
                <Text style={styles.elapsedValue}>{formatTime(elapsed)}</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{session.title}</Text>
            <Text style={styles.heroMeta}>
              {session.mode} · {session.location} · {session.activeSpeakers} active speakers
            </Text>
            <Waveform
              active={listening}
              heights={LIVE_WAVE_HEIGHTS}
              color="#36302A"
              barWidth={3}
              gap={3}
              style={styles.heroWave}
            />
          </LinearGradient>
        </Reveal>

        {/* Live transcript */}
        <Reveal delay={90}>
          <View style={styles.subhead}>
            <Text style={styles.subheadLabel}>LIVE TRANSCRIPT</Text>
            <RecDot color={recDotColor} active={listening} size={6} />
          </View>
          <Card style={{ marginHorizontal: 14, gap: 15 }}>
            {lines.map((line) => (
              <TranscriptLine key={line.id} line={line} streaming={listening} />
            ))}
          </Card>
        </Reveal>

        {/* Summary so far */}
        <Reveal delay={180}>
          <View style={styles.summaryHead}>
            <View>
              <Text style={styles.summaryTitle}>Summary so far</Text>
              <Text style={[styles.summarySub, summarizing && { color: colors.accentDeep }]}>
                {summarizing ? 'Updating…' : 'Updated just now'}
              </Text>
            </View>
            <View style={styles.autoChip}>
              <Sparkle size={11} color={summarizing ? colors.accent : colors.muted} />
              <Text style={styles.autoText}>Auto</Text>
            </View>
          </View>

          <View style={styles.summaryList}>
            <KeyPointsCard points={keyPoints} />
            <DecisionCard text={decisionText} emphasis="14th" />
            <Card>
              <View style={styles.actionHead}>
                <View style={[styles.actionDot, { backgroundColor: colors.accent }]} />
                <Text style={styles.actionLabel}>ACTION ITEMS</Text>
              </View>
              <View style={{ gap: 13 }}>
                {actionItems.map((item) => (
                  <ActionItemRow
                    key={item.id}
                    item={item}
                    checked={checks[item.id]}
                    onToggle={() => toggle(item.id)}
                  />
                ))}
              </View>
            </Card>
          </View>
        </Reveal>
      </ScrollView>

      {/* Control bar */}
      <LinearGradient
        colors={['rgba(240,238,230,0)', colors.bgApp]}
        locations={[0, 0.3]}
        style={[styles.controlWrap, { paddingBottom: Math.max(insets.bottom, 18) + 12 }]}
      >
        <View style={styles.controlNote}>
          <Sparkle size={12} color={colors.muted} />
          <Text style={styles.controlNoteText}>
            Summarizing automatically · audio stays on this device
          </Text>
        </View>
        <View style={styles.controlBar}>
          <Tappable
            scaleTo={0.94}
            onPress={() => {
              setPaused((p) => !p);
              setStopped(false);
            }}
          >
            <View style={styles.pauseBtn}>
              {paused ? <Play size={14} /> : <Pause size={14} />}
              <Text style={styles.pauseLabel}>{paused ? 'Resume' : 'Pause'}</Text>
            </View>
          </Tappable>

          <View style={styles.statusMid}>
            <RecDot color={recDotColor} active={listening} size={7} />
            <Text style={styles.statusText} numberOfLines={1}>
              {statusText}
            </Text>
          </View>

          <Tappable
            scaleTo={0.88}
            onPress={() => {
              setStopped(true);
              router.push('/recap');
            }}
          >
            <View style={styles.stopBtn} accessibilityLabel="Stop session">
              <View style={styles.stopGlyph} />
            </View>
          </Tappable>
        </View>
      </LinearGradient>
    </View>
  );
}

/** Recording indicator dot with a soft pulsing halo when active. */
function RecDot({
  color,
  active,
  size = 9,
}: {
  color: string;
  active: boolean;
  size?: number;
}) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{ width: size, height: size, borderRadius: size, backgroundColor: color }}
      />
      {active ? (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size,
            borderWidth: 2,
            borderColor: color,
            opacity: 0.35,
            transform: [{ scale: 1.8 }],
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontFamily: serif('600'), fontSize: 18, letterSpacing: -0.1, color: colors.ink },
  dots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 4, backgroundColor: '#8A847B' },

  scroll: { flex: 1, paddingTop: 8 },
  hero: {
    marginHorizontal: 14,
    borderRadius: radii.hero,
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
    ...shadows.hero,
  },
  heroWatermark: {
    position: 'absolute',
    top: -46,
    right: -92,
    transform: [{ rotate: '-9deg' }],
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.58)',
    paddingVertical: 6,
    paddingLeft: 11,
    paddingRight: 12,
    borderRadius: radii.chip,
  },
  recLabel: { fontFamily: sans('700'), fontSize: 12, letterSpacing: 0.3, color: colors.warmText3 },
  elapsedLabel: {
    fontFamily: sans('700'),
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: colors.warmLabelOnPeach,
  },
  elapsedValue: {
    fontFamily: sans('700'),
    fontSize: 19,
    color: '#2A241F',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  heroTitle: {
    fontFamily: serif('600'),
    fontSize: 28,
    letterSpacing: -0.3,
    color: colors.inkDeep,
    marginTop: 16,
  },
  heroMeta: { fontFamily: sans('500'), fontSize: 12.5, color: colors.warmText, marginTop: 5 },
  heroWave: { height: 44, marginTop: 18 },

  subhead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginTop: 22, marginBottom: 10 },
  subheadLabel: { fontFamily: sans('800'), fontSize: 11.5, letterSpacing: 0.9, color: colors.mutedLabel },

  summaryHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginHorizontal: 18,
    marginTop: 24,
    marginBottom: 12,
  },
  summaryTitle: { fontFamily: serif('600'), fontSize: 21, letterSpacing: -0.2, color: colors.ink },
  summarySub: { fontFamily: sans('500'), fontSize: 11.5, color: colors.muted, marginTop: 2 },
  autoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(38,38,37,0.06)',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: radii.chip,
  },
  autoText: { fontFamily: sans('700'), fontSize: 11.5, color: '#6F665C', letterSpacing: 0.2 },
  summaryList: { marginHorizontal: 14, gap: 12 },

  actionHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 13 },
  actionDot: { width: 7, height: 7, borderRadius: 7 },
  actionLabel: { fontFamily: sans('800'), fontSize: 10.5, letterSpacing: 1, color: colors.mutedLabel },

  controlWrap: { paddingHorizontal: 14, paddingTop: 8 },
  controlNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 11 },
  controlNoteText: { fontFamily: sans('600'), fontSize: 11.5, color: colors.mutedDeep },
  controlBar: {
    backgroundColor: colors.dark,
    borderRadius: radii.control,
    paddingVertical: 9,
    paddingLeft: 10,
    paddingRight: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...shadows.control,
  },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radii.tab,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  pauseLabel: { fontFamily: sans('700'), fontSize: 14, color: colors.white },
  statusMid: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minWidth: 0 },
  statusText: { fontFamily: sans('600'), fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  stopBtn: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopGlyph: { width: 15, height: 15, borderRadius: 4, backgroundColor: colors.accent },
});
