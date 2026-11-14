import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useChooseVoice, useVoices } from '@/api/hooks/voice';
import type { VoiceOption } from '@/api/types';
import { Card, Chip, ErrorState, Skeleton, T, useToast } from '@/components/ui';
import { Check, Sparkle, Square } from '@/components/Icon';
import { useVoiceEngine } from '@/voice/useVoice';
import { VOICE_UNAVAILABLE } from '@/voice/engine';
import { radii, TOUCH, useTheme } from '@/theme';
import Svg, { Path } from 'react-native-svg';

/* Your Myte's voice (ADR-0050): the curated Kokoro voices, each with its description, accent and
   gender and a short in-character Preview; the one your Myte speaks with now is marked; "Match my
   Myte's personality" hands the choice back to the server. A tap saves (PUT), and the same voice
   speaks on the web and on every phone. There is no device voice to pick any more. */

const MATCH = '__match__';

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function voiceMeta(v: Pick<VoiceOption, 'accent' | 'gender'>): string {
  return [cap(v.accent), cap(v.gender)].filter(Boolean).join(' · ');
}

/** What a voice says when you preview it: a line your Myte would actually say. */
export function previewLine(agentName: string): string {
  return `Hi, I'm ${agentName}. Here is what changed for you since your last meeting.`;
}

function PlayIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 256 256" accessible={false}>
      <Path fill={color} d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z" />
    </Svg>
  );
}

function Radio({ on }: { on: boolean }) {
  const p = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: radii.full,
        borderWidth: on ? 0 : 1.5,
        borderColor: p.line2,
        backgroundColor: on ? p.signal : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on ? <Check size={14} color="#ffffff" /> : null}
    </View>
  );
}

export function VoicePicker({ agentName }: { agentName: string }) {
  const p = useTheme();
  const toast = useToast();
  const voices = useVoices();
  const choose = useChooseVoice();
  const engine = useVoiceEngine();
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  useEffect(() => () => engine.stop(), [engine]);

  if (voices.isPending) return <Skeleton lines={6} />;
  if (voices.isError || !voices.data) return <ErrorState title="Voices could not be loaded" onRetry={() => void voices.refetch()} />;

  const view = voices.data;
  if (!view.connected) {
    return (
      <Card style={{ gap: 6 }}>
        <T variant="body" tone="ink" weight="600">
          Your Myte&apos;s voice is not connected on this server
        </T>
        <T variant="secondary">
          {agentName}&apos;s words still show as text everywhere. It starts speaking once your workspace turns the voice on.
        </T>
      </Card>
    );
  }

  const current = view.chosen ?? MATCH;
  const matched = view.voices.find((v) => v.id === view.selected);

  const pick = (id: string | null) => {
    if ((id ?? MATCH) === current || choose.isPending) return;
    const name = id ? view.voices.find((v) => v.id === id)?.name : null;
    void choose.run(id).then(
      (next) => {
        const now = next.voices.find((v) => v.id === next.selected)?.name;
        toast({ text: name ? `${agentName} speaks as ${name} now` : now ? `${agentName}'s personality picked ${now}` : 'Voice saved' });
      },
      () => toast({ text: 'Your voice could not be saved. Try again.' }),
    );
  };

  const preview = (v: VoiceOption) => {
    if (previewing === v.id) {
      engine.stop();
      setPreviewing(null);
      setLoadingPreview(null);
      return;
    }
    setPreviewing(v.id);
    engine.speak(
      [{ text: previewLine(agentName) }],
      { voice: v.id, language: 'en' },
      {
        onLoading: (l) => setLoadingPreview(l ? v.id : null),
        onDone: () => setPreviewing((cur) => (cur === v.id ? null : cur)),
        onError: () => {
          setPreviewing(null);
          toast({ text: VOICE_UNAVAILABLE });
        },
      },
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <Card padded={false}>
        <View accessibilityRole="radiogroup" accessibilityLabel={`${agentName}'s voice`}>
          <Pressable
            onPress={() => pick(null)}
            accessibilityRole="radio"
            accessibilityState={{ checked: current === MATCH, busy: choose.isPending && choose.variables?.input === null }}
            accessibilityLabel="Match my Myte's personality"
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: p.bg2 }]}
          >
            <Radio on={current === MATCH} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sparkle size={16} color={p.ink2} />
                <T variant="body" tone="ink" weight="600">
                  Match my Myte&apos;s personality
                </T>
              </View>
              <T variant="secondary">
                {current === MATCH && matched
                  ? `${agentName}'s personality picks ${matched.name}.`
                  : `${agentName}'s personality picks the voice that suits it.`}
              </T>
            </View>
          </Pressable>

          {view.voices.map((v) => {
            const on = current === v.id;
            const speaking = view.selected === v.id;
            const isPreview = previewing === v.id;
            return (
              <View key={v.id} style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.line }]}>
                <Pressable
                  onPress={() => pick(v.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, busy: choose.isPending && choose.variables?.input === v.id }}
                  accessibilityLabel={`${v.name}, ${v.description}, ${voiceMeta(v)}${speaking ? ', current voice' : ''}`}
                  style={({ pressed }) => [{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: TOUCH }, pressed && { opacity: 0.7 }]}
                >
                  <Radio on={on} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <T variant="body" tone="ink" weight="600">
                        {v.name}
                      </T>
                      {speaking ? <Chip label="Current" tone="signal" /> : null}
                    </View>
                    <T variant="secondary">{v.description}</T>
                    <T variant="meta">{voiceMeta(v)}</T>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => preview(v)}
                  accessibilityRole="button"
                  accessibilityLabel={isPreview ? `Stop the ${v.name} preview` : `Preview ${v.name}`}
                  accessibilityState={{ busy: loadingPreview === v.id }}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.preview,
                    { borderColor: p.line2, backgroundColor: isPreview ? p.signalSoft : pressed ? p.bg2 : p.surface },
                  ]}
                >
                  {isPreview ? <Square size={14} color={p.signalInk} /> : <PlayIcon color={p.ink2} />}
                  <T variant="secondary" weight="600" style={{ color: isPreview ? p.signalInk : p.ink2 }}>
                    {isPreview ? (loadingPreview === v.id ? 'Loading' : 'Stop') : 'Preview'}
                  </T>
                </Pressable>
              </View>
            );
          })}
        </View>
      </Card>
      <T variant="meta">
        {agentName} speaks with this voice everywhere: your briefings on this phone, and on the web.
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
