import { mockParams, mockRouter, resetMocks } from './helpers/mocks';
import React from 'react';
import { createAudioPlayer } from 'expo-audio';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { fakeApi, renderWithApi } from './helpers/render';
import BriefingScreen from '../app/(app)/briefings/[briefingId]';
import { BriefingPanel } from '@/components/feature/Briefing';
import { appRoute } from '@/lib/routes';
import { pushRoute } from '@/lib/push-links';
import { agentSeed, momentLabel, momentRoute, nearestSpeed, segmentAt, segmentStarts, voiceTone, type Briefing } from '@/lib/briefing';

/* A briefing from your agent on the phone: the pure rules (moments, pace, the playhead, the push
   link), the card (play in your Myte's Kokoro voice, sentence by sentence; the text stays when the
   voice is unavailable; open the briefing; Brief me) and the full screen (auto-play, skip, speed
   saved, open the moment). */

const M = '0b6a3c43-2f5d-4f4b-9a8e-0a1b2c3d4e5f';
const B = '6c7d8e9f-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

const BRIEFING: Briefing = {
  id: B,
  trigger: 'meeting_end',
  status: 'ready',
  reason: null,
  meeting_id: M,
  meeting_title: 'Pricing review',
  length: 'standard',
  language: 'en',
  agent: { name: 'Juniper', seed: null, personality: 'friendly' },
  segments: [
    { id: 's1', kind: 'opening', text: "Hi Maya, it's Juniper.", link: null },
    { id: 's2', kind: 'changed', text: 'The base price goes up 8% from January.', link: { type: 'decision', meeting_id: M, id: 'd1', at_ms: 61000 } },
    { id: 's3', kind: 'promise', text: "You said you'd share the terms with legal.", link: { type: 'promise', meeting_id: M, id: 'c1', at_ms: null } },
  ],
  word_count: 22,
  duration_s: 9,
  audio: { status: 'none', voice: null },
  prompt_version: 'briefing@v1',
  created_at: '2026-11-11T10:00:00Z',
  ready_at: '2026-11-11T10:00:09Z',
  listened_at: null,
};

const PREFS = { enabled: true, auto_play: false, length: 'standard' as const, language: 'en', voice: null, server_voice: null, rate: 1 };

beforeEach(() => {
  resetMocks();
  (createAudioPlayer as jest.Mock).mockClear();
});

const MP3 = new ArrayBuffer(8);
const SPEECH = 'POST /api/v1/voice/speech';
type SpeechCall = { text: string; voice: string | null; speed: number; language: string };
const spoken = (calls: { key: string; opts: { body?: unknown } }[]) =>
  calls.filter((c) => c.key === SPEECH).map((c) => (c.opts.body as SpeechCall).text);

describe('briefing rules', () => {
  it('opens each point where it came from on the phone', () => {
    expect(momentRoute({ type: 'decision', meeting_id: M, id: 'd1', at_ms: 1 })).toBe('/decisions/d1');
    expect(momentRoute({ type: 'action', meeting_id: M, id: 'a1', at_ms: null })).toBe('/work?tab=tasks');
    expect(momentRoute({ type: 'promise', meeting_id: M, id: 'c1', at_ms: null })).toBe('/work?tab=promises');
    expect(momentRoute({ type: 'question', meeting_id: M, id: null, at_ms: null })).toBe(`/meetings/${M}`);
    expect(momentRoute(null)).toBeNull();
    expect(momentLabel({ type: 'promise', meeting_id: M, id: 'c1', at_ms: null })).toBe('Open your promises');
  });

  it('paces the voice by personality and finds the playhead', () => {
    expect(voiceTone('concise').rate).toBeGreaterThan(1);
    expect(nearestSpeed(1.4)).toBe(1.5);
    expect(agentSeed(null, 'u1')).not.toBe(agentSeed(null, 'u2'));
    const starts = segmentStarts(BRIEFING.segments);
    expect(segmentAt(starts, 0.99)).toBe(2);
  });

  it('a briefing push opens the briefing', () => {
    expect(appRoute(`/briefings/${B}`)).toBe(`/briefings/${B}`);
    expect(appRoute('/briefings')).toBe('/');
    expect(pushRoute({ link: `/briefings/${B}` })).toBe(`/briefings/${B}`);
  });
});

describe('the briefing card', () => {
  it("plays in your Myte's voice, sentence by sentence, and opens the briefing", async () => {
    const api = fakeApi({
      'POST /api/v1/briefings/{briefing_id}/listened': { ...BRIEFING, listened_at: '2026-11-11T10:01:00Z' },
      [SPEECH]: MP3,
    });
    renderWithApi(<BriefingPanel briefing={BRIEFING} prefs={PREFS} meetingId={M} />, api.client);
    expect(screen.getByText('A briefing from Juniper')).toBeTruthy();
    expect(screen.getByText('After Pricing review')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Play briefing'));
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalled());
    const first = api.calls.find((c) => c.key === SPEECH)?.opts.body as SpeechCall;
    // The person's chosen voice is the server's to apply: the phone names none.
    expect(first).toEqual({ text: "Hi Maya, it's Juniper.", language: 'en', speed: 1 });
    // The next point is fetched while the first plays.
    await waitFor(() => expect(spoken(api.calls)).toEqual(["Hi Maya, it's Juniper.", 'The base price goes up 8% from January.']));
    expect(await screen.findByLabelText('Pause briefing')).toBeTruthy();
    await waitFor(() => expect(api.calls.map((c) => c.key)).toContain('POST /api/v1/briefings/{briefing_id}/listened'));
    fireEvent.press(screen.getByLabelText('Open the briefing'));
    expect(mockRouter.push).toHaveBeenCalledWith(`/briefings/${B}`);
  });

  it('says quietly when the voice is unavailable, and keeps the words', async () => {
    const { ApiError } = jest.requireActual('@/api/client') as typeof import('@/api/client');
    const api = fakeApi({
      'POST /api/v1/briefings/{briefing_id}/listened': BRIEFING,
      [SPEECH]: new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'voice_not_connected'),
    });
    renderWithApi(<BriefingPanel briefing={BRIEFING} prefs={PREFS} meetingId={M} />, api.client);
    fireEvent.press(screen.getByLabelText('Play briefing'));
    expect(await screen.findByText('Voice is unavailable right now. The words are all here.')).toBeTruthy();
    expect(screen.getByText("Hi Maya, it's Juniper.")).toBeTruthy();
    expect(screen.getByLabelText('Play briefing')).toBeTruthy();
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });

  it('nothing yet: Brief me asks the agent and shows it being written', async () => {
    const api = fakeApi({ 'POST /api/v1/briefings': { ...BRIEFING, status: 'pending', segments: [] } });
    renderWithApi(<BriefingPanel briefing={null} prefs={PREFS} meetingId={M} />, api.client);
    fireEvent.press(screen.getByLabelText('Brief me'));
    await waitFor(() => expect(api.calls.map((c) => c.key)).toContain('POST /api/v1/briefings'));
    const call = api.calls.find((c) => c.key === 'POST /api/v1/briefings');
    expect(call?.opts.body).toEqual({ meeting_id: M });
    expect((call?.opts as { idempotencyKey?: string }).idempotencyKey).toBeTruthy();
  });

  it('draws being written, nothing to say and could not be written', () => {
    const api = fakeApi({});
    const a = renderWithApi(<BriefingPanel briefing={{ ...BRIEFING, status: 'composing', segments: [] }} prefs={PREFS} />, api.client);
    expect(screen.getByText('Juniper is writing your briefing')).toBeTruthy();
    a.unmount();
    const b = renderWithApi(<BriefingPanel briefing={{ ...BRIEFING, status: 'empty', segments: [] }} prefs={PREFS} />, api.client);
    expect(screen.getByText('Nothing needs you right now')).toBeTruthy();
    b.unmount();
    renderWithApi(<BriefingPanel briefing={{ ...BRIEFING, status: 'unavailable', reason: 'budget', segments: [] }} prefs={PREFS} />, api.client);
    expect(screen.getByText('Your briefing could not be written')).toBeTruthy();
    expect(screen.getByLabelText('Try again')).toBeTruthy();
  });
});

describe('the briefing screen', () => {
  it('auto-plays a new briefing, skips, saves the speed and opens the moment', async () => {
    mockParams.current = { briefingId: B };
    const api = fakeApi({
      'GET /api/v1/briefings/{briefing_id}': BRIEFING,
      'GET /api/v1/briefings/preferences': { ...PREFS, auto_play: true, server_voice_connected: false, server_voices: [], languages: [] },
      'POST /api/v1/briefings/{briefing_id}/listened': { ...BRIEFING, listened_at: '2026-11-11T10:01:00Z' },
      'PUT /api/v1/briefings/preferences': { ...PREFS, rate: 1.5, server_voice_connected: false, server_voices: [], languages: [] },
      [SPEECH]: MP3,
    });
    renderWithApi(<BriefingScreen />, api.client);
    expect(await screen.findByText('A briefing from Juniper')).toBeTruthy();
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalled());
    const player = (createAudioPlayer as jest.Mock).mock.results[0]?.value as { replace: jest.Mock; setPlaybackRate: jest.Mock };
    fireEvent.press(screen.getByLabelText('Next point'));
    await waitFor(() => expect(player.replace).toHaveBeenCalled());
    fireEvent.press(screen.getByLabelText('Speed 1.5x'));
    await waitFor(() => expect(api.calls.map((c) => c.key)).toContain('PUT /api/v1/briefings/preferences'));
    expect((api.calls.find((c) => c.key === 'PUT /api/v1/briefings/preferences')?.opts.body as { rate: number }).rate).toBe(1.5);
    expect(await screen.findByText('Speed saved')).toBeTruthy();
    // Speed is the playback rate: no new request, pitch kept.
    await waitFor(() => expect(player.setPlaybackRate).toHaveBeenLastCalledWith(1.5, 'high'));
    fireEvent.press(screen.getByText('Open the decision'));
    expect(mockRouter.push).toHaveBeenCalledWith('/decisions/d1');
  });

  it('a briefing that is gone says so', async () => {
    mockParams.current = { briefingId: B };
    const { ApiError } = jest.requireActual('@/api/client') as typeof import('@/api/client');
    const api = fakeApi({
      'GET /api/v1/briefings/{briefing_id}': new ApiError(404, 'NOT_FOUND', 'gone'),
      'GET /api/v1/briefings/preferences': { ...PREFS, server_voice_connected: false, server_voices: [], languages: [] },
    });
    renderWithApi(<BriefingScreen />, api.client);
    expect(await screen.findByText('This briefing is not available')).toBeTruthy();
  });
});
