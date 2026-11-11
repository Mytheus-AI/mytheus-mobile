/**
 * A briefing from your agent on the phone: the pure rules the card, the full screen and the tests
 * share (the same rules as mytheus-ui `src/lib/briefing.ts`, with the phone's own routes).
 *
 * - Where "open the moment" goes (`momentRoute`): this app has no transcript screen, so a moment
 *   opens its meeting; a decision its record; a task or promise My work.
 * - Which voice speaks it (`pickVoice`, expo-speech voices): the remembered one when the phone
 *   has it, else a stable pick for this agent among the enhanced voices of the language.
 * - The persona's pace and pitch (`voiceTone`), and where the playhead is (`segmentStarts`).
 */

import type { components } from '@/api/generated/core-api';
import { defaultDoodleSeed, isDoodleSeed } from './doodle';

type Schemas = components['schemas'];
export type Briefing = Schemas['Briefing'];
export type BriefingSegment = Schemas['BriefingSegment'];
export type BriefingLink = Schemas['BriefingLink'];
export type BriefingSettings = Schemas['BriefingSettings'];
export type BriefingPreferences = Schemas['BriefingPreferences'];

export const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
export const POLL_MS = 2500;

export function isWriting(b: Pick<Briefing, 'status'> | null | undefined): boolean {
  return b?.status === 'pending' || b?.status === 'composing';
}

export function speedLabel(rate: number): string {
  return `${Number.isInteger(rate) ? rate.toFixed(0) : String(rate)}x`;
}

export function nearestSpeed(rate: number | null | undefined): number {
  const r = typeof rate === 'number' && Number.isFinite(rate) ? rate : 1;
  return SPEEDS.reduce((best, s) => (Math.abs(s - r) < Math.abs(best - r) ? s : best), 1);
}

export function momentRoute(link: BriefingLink | null | undefined): string | null {
  if (!link) return null;
  if (link.type === 'decision' && link.id) return `/decisions/${link.id}`;
  if (link.type === 'action') return '/work?tab=tasks';
  if (link.type === 'promise') return '/work?tab=promises';
  return `/meetings/${link.meeting_id}`;
}

export function momentLabel(link: BriefingLink | null | undefined): string {
  if (!link) return '';
  switch (link.type) {
    case 'decision':
      return 'Open the decision';
    case 'action':
      return 'Open the task';
    case 'promise':
      return 'Open your promises';
    default:
      return 'Open the meeting';
  }
}

/** The parts of an expo-speech Voice the choice reads. */
export interface VoiceLike {
  identifier: string;
  name: string;
  language: string;
  quality?: string;
}

const NOVELTY = /(whisper|bells|bad news|good news|bubbles|cellos|zarvox|trinoids|jester|organ|superstar|boing|albert|bahh|wobble|deranged|hysterical|fred|junior|ralph)/i;

function langOf(code: string | null | undefined): string {
  return (code ?? '').toLowerCase().split(/[-_]/)[0] ?? '';
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function voicesFor<T extends VoiceLike>(voices: readonly T[], language: string): T[] {
  const want = langOf(language) || 'en';
  return voices
    .filter((v) => langOf(v.language) === want && !NOVELTY.test(v.name))
    .sort(
      (a, b) =>
        Number(b.quality === 'Enhanced') - Number(a.quality === 'Enhanced') || a.name.localeCompare(b.name),
    );
}

export function pickVoice<T extends VoiceLike>(
  voices: readonly T[],
  opts: { language: string; seed: string; preferred?: string | null },
): T | null {
  const usable = voicesFor(voices, opts.language);
  if (usable.length === 0) return null;
  if (opts.preferred) {
    const chosen = usable.find((v) => v.name === opts.preferred || v.identifier === opts.preferred);
    if (chosen) return chosen;
  }
  const best = usable.filter((v) => v.quality === 'Enhanced');
  const pool = best.length > 0 ? best : usable;
  return pool[hash(`voice:${opts.seed}`) % pool.length] ?? null;
}

export function voiceTone(personality: string | null | undefined): { rate: number; pitch: number } {
  switch (personality) {
    case 'concise':
      return { rate: 1.08, pitch: 1 };
    case 'direct':
      return { rate: 1.05, pitch: 0.94 };
    case 'detailed':
      return { rate: 0.96, pitch: 1 };
    case 'friendly':
      return { rate: 1, pitch: 1.08 };
    default:
      return { rate: 1, pitch: 1 };
  }
}

export function agentSeed(seed: string | null | undefined, ownerKey: string): string {
  return isDoodleSeed(seed) ? seed : defaultDoodleSeed(`agent:${ownerKey || 'someone'}`);
}

export function segmentStarts(segments: readonly Pick<BriefingSegment, 'text'>[]): number[] {
  const lengths = segments.map((s) => Math.max(1, s.text.length + 2));
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const out: number[] = [];
  let at = 0;
  for (const n of lengths) {
    out.push(at / total);
    at += n;
  }
  out.push(1);
  return out;
}

export function segmentAt(starts: readonly number[], fraction: number): number {
  const f = Math.min(Math.max(fraction, 0), 0.999999);
  for (let i = starts.length - 2; i >= 0; i -= 1) {
    if (f >= (starts[i] ?? 0)) return i;
  }
  return 0;
}

export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function coverLine(b: Pick<Briefing, 'meeting_title' | 'trigger'>): string {
  if (b.meeting_title) return `After ${b.meeting_title}`;
  return b.trigger === 'on_demand' ? 'Since your last briefing' : 'Your latest meetings';
}

export function unavailableCopy(reason: Briefing['reason']): string {
  switch (reason) {
    case 'budget':
      return 'Your workspace has used its agent budget for now, so this briefing was not written.';
    case 'timeout':
      return 'Your agent could not be reached in time. Nothing was lost; ask again.';
    default:
      return 'Something went wrong while it was being written. Nothing was lost; ask again.';
  }
}

export const KIND_LABEL: Record<BriefingSegment['kind'], string> = {
  opening: 'Hello',
  changed: 'What changed',
  waiting: 'Waiting on you',
  promise: 'Your promise',
  question: 'Still open',
  closing: "That's all",
};
