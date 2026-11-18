import { mockFocus, mockRouter, resetMocks } from './helpers/mocks';
import React from 'react';
import { Pressable, RefreshControl, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { fakeApi, renderWithApi } from './helpers/render';
import MyteBriefScreen from '../app/(app)/myte/brief';
import Home from '../app/(app)/(tabs)/index';
import { BriefingPanel } from '@/components/feature/Briefing';
import type { Briefing } from '@/lib/briefing';

/* "Your Myte talks you through it" (`/myte/brief`, system.md N28) against the fake REST client and
   the fake voice (expo-audio stand-in, `POST /api/v1/voice/speech` from the table): it speaks on
   arrival in the Myte's voice, Stop and "again", a row opens its place, and leaving or Stop lets
   go of the player, the lock screen and background audio; the caption and lit row stay on the
   line being said through a refresh; one voice at a time with Home's briefing; it speaks to the
   end and lets go of background audio, and when both lists fail nothing is said. */

const SPEECH = 'POST /api/v1/voice/speech';
const MP3 = new ArrayBuffer(8);
type SpeechCall = { text: string; speed: number; language: string };
const spoken = (calls: { key: string; opts: { body?: unknown } }[]) =>
  calls.filter((c) => c.key === SPEECH).map((c) => (c.opts.body as SpeechCall).text);

const D1 = '0b6a3c43-2f5d-4f4b-9a8e-0a1b2c3d4e5f';
const T1 = '6c7d8e9f-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

const ME = {
  id: 'u1',
  agent_name: 'Nova',
  agent_avatar_seed: null,
  agent_personality: 'friendly',
  agent_instructions: null,
  display_name: 'Maya Rao',
  avatar_url: null,
  bio: null,
  email: 'maya@acme.test',
  created_at: recent,
};
const PREFS = { enabled: true, auto_play: false, length: 'standard', language: 'en', voice: null, server_voice: null, rate: 1, server_voice_connected: false, server_voices: [], languages: [] };
const DECISIONS = {
  items: [
    {
      id: D1,
      content: 'We move to annual billing',
      created_at: recent,
      meeting_id: 'm1',
      meeting_started_at: recent,
      meeting_title: 'Pricing review',
      status: 'confirmed',
    },
  ],
};
const TASKS = { items: [{ id: T1, assignee_id: 'u1', confidence: 1, content: 'Send the deck to Priya', created_at: recent, due_date: null, status: 'confirmed' }] };

function table(over: Record<string, unknown> = {}) {
  return {
    'GET /users/me': ME,
    'GET /api/v1/briefings/preferences': PREFS,
    'GET /api/v1/decisions': DECISIONS,
    'GET /api/v1/actions/mine': TASKS,
    [SPEECH]: MP3,
    ...over,
  };
}

type FakePlayer = {
  play: jest.Mock;
  pause: jest.Mock;
  remove: jest.Mock;
  clearLockScreenControls: jest.Mock;
  __emit: (s: unknown) => void;
};
const lastPlayer = () => (createAudioPlayer as jest.Mock).mock.results.at(-1)?.value as FakePlayer;

/** Whether a row is lit as the one being said (its body carries a background). */
const lit = (label: string) =>
  !!StyleSheet.flatten((screen.getByLabelText(label).children[0] as unknown as { props: { style?: StyleProp<ViewStyle> } }).props.style)?.backgroundColor;

const BRIEFING: Briefing = {
  id: '3a4b5c6d-7e8f-4a1b-9c2d-0a1b2c3d4e5f',
  trigger: 'meeting_end',
  status: 'ready',
  reason: null,
  meeting_id: 'm1',
  meeting_title: 'Pricing review',
  length: 'standard',
  language: 'en',
  agent: { name: 'Juniper', seed: null, personality: 'friendly' },
  segments: [{ id: 's1', kind: 'opening', text: "Hi Maya, it's Juniper.", link: null }],
  word_count: 4,
  duration_s: 2,
  audio: { status: 'none', voice: null },
  prompt_version: 'briefing@v1',
  created_at: recent,
  ready_at: recent,
  listened_at: null,
};

/** Home's briefing card with "Talk me through it" opening the talk screen over it. */
function HomeThenTalk() {
  const [talk, setTalk] = React.useState(false);
  return (
    <>
      <BriefingPanel briefing={BRIEFING} prefs={{ ...PREFS, length: 'standard' as const }} />
      {talk ? (
        <>
          <Pressable accessibilityLabel="Close the talk" onPress={() => setTalk(false)} />
          <MyteBriefScreen />
        </>
      ) : (
        <Pressable accessibilityLabel="Talk me through it" onPress={() => setTalk(true)} />
      )}
    </>
  );
}

beforeEach(() => {
  resetMocks();
  (createAudioPlayer as jest.Mock).mockClear();
  (setAudioModeAsync as jest.Mock).mockClear();
});

describe('the talk screen', () => {
  it('speaks on arrival in its own name, and Stop then "again" control it', async () => {
    const api = fakeApi(table());
    renderWithApi(<MyteBriefScreen />, api.client);
    expect(await screen.findByText('Talking you through your decisions and tasks')).toBeTruthy();
    expect(screen.getByText('Nova')).toBeTruthy();
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalled());
    expect(spoken(api.calls)[0]).toBe("Hi Maya, it's Nova.");
    // The friendly personality's pace, your language; the server applies your voice.
    expect(api.calls.find((c) => c.key === SPEECH)?.opts.body).toEqual({ text: "Hi Maya, it's Nova.", speed: 1, language: 'en' });
    expect(screen.getByText("Hi Maya, it's Nova.")).toBeTruthy();
    // Background audio is held while it speaks.
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true, shouldPlayInBackground: true });

    // Stop stops and lets go: the player (and its lock-screen session) and background audio.
    const first = lastPlayer();
    fireEvent.press(await screen.findByLabelText('Stop'));
    expect(first.pause).toHaveBeenCalled();
    expect(first.remove).toHaveBeenCalled();
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ playsInSilentMode: false, shouldPlayInBackground: false });
    expect(await screen.findByLabelText('Talk me through it again')).toBeTruthy();

    const players = (createAudioPlayer as jest.Mock).mock.calls.length;
    fireEvent.press(screen.getByLabelText('Talk me through it again'));
    await waitFor(() => expect((createAudioPlayer as jest.Mock).mock.calls.length).toBeGreaterThan(players));
    await waitFor(() => expect(lastPlayer().play).toHaveBeenCalled());
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ playsInSilentMode: true, shouldPlayInBackground: true });
    expect(await screen.findByLabelText('Stop')).toBeTruthy();
  });

  it('lists the decisions and tasks; a row opens its place, and leaving lets go of the audio', async () => {
    const api = fakeApi(table());
    renderWithApi(<MyteBriefScreen />, api.client);
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalled());
    expect(screen.getByText('Decisions')).toBeTruthy();
    expect(screen.getByText('Your tasks')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Decision: We move to annual billing'));
    expect(mockRouter.push).toHaveBeenCalledWith(`/decisions/${D1}`);
    const player = lastPlayer();
    expect(player.remove).not.toHaveBeenCalled();
    act(() => mockFocus.blur());
    // The screen is still mounted under the pushed one, but holds no audio: the voice stops, the
    // lock-screen player is cleared and released, and the background session is let go.
    expect(player.pause).toHaveBeenCalled();
    expect(player.clearLockScreenControls).toHaveBeenCalled();
    expect(player.remove).toHaveBeenCalled();
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ playsInSilentMode: false, shouldPlayInBackground: false });
    expect(await screen.findByLabelText('Talk me through it again')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Task: Send the deck to Priya'));
    expect(mockRouter.push).toHaveBeenCalledWith('/work?tab=tasks');
  });

  it('keeps the caption and the lit row on the line being said when a refresh changes the lists', async () => {
    const D2 = '1f2e3d4c-5b6a-4978-8f9e-0a1b2c3d4e5f';
    const later = { items: [{ ...DECISIONS.items[0], id: D2, content: 'We hire two engineers', meeting_title: 'Hiring' }, ...DECISIONS.items] };
    let reads = 0;
    const api = fakeApi(table({ 'GET /api/v1/decisions': () => (reads++ === 0 ? DECISIONS : later) }));
    renderWithApi(<MyteBriefScreen />, api.client);
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalled());
    const player = lastPlayer();
    for (let i = 1; i <= 2; i += 1) {
      await waitFor(() => expect(player.play).toHaveBeenCalledTimes(i));
      await act(async () => player.__emit({ playing: false, currentTime: 3, duration: 3, didJustFinish: true }));
    }
    await waitFor(() => expect(player.play).toHaveBeenCalledTimes(3));
    const said = 'From Pricing review: We move to annual billing.';
    expect(screen.getByText(said)).toBeTruthy();
    expect(lit('Decision: We move to annual billing')).toBe(true);
    expect(lit('Task: Send the deck to Priya')).toBe(false);

    // A refresh brings a new decision while the old script is still being said.
    act(() => screen.UNSAFE_getByType(RefreshControl).props.onRefresh());
    expect(await screen.findByLabelText('Decision: We hire two engineers')).toBeTruthy();
    expect(screen.getByText(said)).toBeTruthy();
    expect(screen.queryByText('Two decisions from the last two weeks.')).toBeNull();
    expect(lit('Decision: We move to annual billing')).toBe(true);
    expect(lit('Decision: We hire two engineers')).toBe(false);
  });

  it('one voice at a time: Home\'s briefing stops when the talk starts, and the talk lets go on leaving', async () => {
    const api = fakeApi(table({ 'POST /api/v1/briefings/{briefing_id}/listened': BRIEFING }));
    renderWithApi(<HomeThenTalk />, api.client);
    fireEvent.press(screen.getByLabelText('Play briefing'));
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalledTimes(1));
    const briefing = lastPlayer();
    expect(await screen.findByLabelText('Pause briefing')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Talk me through it'));
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalledTimes(2));
    const talk = lastPlayer();
    await waitFor(() => expect(talk.play).toHaveBeenCalled());
    expect(briefing.pause).toHaveBeenCalled();
    expect(await screen.findByLabelText('Play briefing')).toBeTruthy();
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ playsInSilentMode: true, shouldPlayInBackground: true });

    fireEvent.press(screen.getByLabelText('Close the talk'));
    await waitFor(() => expect(talk.remove).toHaveBeenCalled());
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ playsInSilentMode: false, shouldPlayInBackground: false });
  });

  it('speaks every line to the end, then lets go of background audio', async () => {
    const api = fakeApi(table());
    renderWithApi(<MyteBriefScreen />, api.client);
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalled());
    const player = lastPlayer();
    // The voice says a line's first sentence on its own, so the goodbye is two items.
    const lines = [
      "Hi Maya, it's Nova.",
      'One decision from the last two weeks.',
      'From Pricing review: We move to annual billing.',
      'You have one open task.',
      'Send the deck to Priya.',
      "That's everything.",
      'Tap any of them to open it.',
    ];
    for (let i = 1; i <= lines.length; i += 1) {
      await waitFor(() => expect(player.play).toHaveBeenCalledTimes(i));
      await act(async () => player.__emit({ playing: false, currentTime: 3, duration: 3, didJustFinish: true }));
    }
    expect(spoken(api.calls)).toEqual(lines);
    expect(await screen.findByLabelText('Talk me through it again')).toBeTruthy();
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ playsInSilentMode: false, shouldPlayInBackground: false });
  });

  it('with no name of its own it says "your Myte" and shows "Maya\'s Myte"', async () => {
    const api = fakeApi(table({ 'GET /users/me': { ...ME, agent_name: null } }));
    renderWithApi(<MyteBriefScreen />, api.client);
    expect(await screen.findByText("Maya's Myte")).toBeTruthy();
    await waitFor(() => expect(spoken(api.calls)[0]).toBe("Hi Maya, it's your Myte."));
  });

  it('one list failing is said; the other is still there', async () => {
    const { ApiError } = jest.requireActual('@/api/client') as typeof import('@/api/client');
    const api = fakeApi(table({ 'GET /api/v1/actions/mine': new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'down') }));
    renderWithApi(<MyteBriefScreen />, api.client);
    expect(await screen.findByText("I couldn't reach your tasks just now.")).toBeTruthy();
    expect(screen.getByLabelText('Decision: We move to annual billing')).toBeTruthy();
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalled());
  });

  it('when both lists fail it says nothing and offers to try again', async () => {
    const { ApiError } = jest.requireActual('@/api/client') as typeof import('@/api/client');
    const down = new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'down');
    const api = fakeApi(table({ 'GET /api/v1/decisions': down, 'GET /api/v1/actions/mine': down }));
    renderWithApi(<MyteBriefScreen />, api.client);
    expect(await screen.findByText('Your decisions and tasks could not be loaded')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Try again'));
    await waitFor(() => expect(api.calls.filter((c) => c.key === 'GET /api/v1/decisions').length).toBe(2));
    expect(spoken(api.calls)).toEqual([]);
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });

  it('says quietly when the voice is unavailable, and keeps the words', async () => {
    const { ApiError } = jest.requireActual('@/api/client') as typeof import('@/api/client');
    const api = fakeApi(table({ [SPEECH]: new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'voice_not_connected') }));
    renderWithApi(<MyteBriefScreen />, api.client);
    expect(await screen.findByText('Voice is unavailable right now. The words are all here.')).toBeTruthy();
    expect(screen.getByText("Hi Maya, it's Nova.")).toBeTruthy();
    expect(screen.getByLabelText('Talk me through it again')).toBeTruthy();
  });
});

describe('Home', () => {
  it('offers "Talk me through it" with your Myte', async () => {
    const api = fakeApi({ 'GET /users/me': ME, 'GET /notifications': { items: [] }, 'GET /api/v1/status-requests': { items: [] } });
    renderWithApi(<Home />, api.client);
    expect(await screen.findByText('Nova')).toBeTruthy();
    expect(screen.getByText('Your decisions and tasks, out loud')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Talk me through it'));
    expect(mockRouter.push).toHaveBeenCalledWith('/myte/brief');
  });
});
