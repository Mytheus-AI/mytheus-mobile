import { mockRouter, resetMocks } from './helpers/mocks';
import React from 'react';
import { createAudioPlayer } from 'expo-audio';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { fakeApi, renderWithApi } from './helpers/render';
import VoiceScreen from '../app/(app)/voice';
import Settings from '../app/(app)/settings';
import { previewLine, voiceMeta } from '@/components/feature/VoicePicker';
import type { VoicesView } from '@/api/types';

/* Your Myte's voice (ADR-0050): the picker lists the Kokoro voices with description, accent and
   gender, marks the one speaking now, previews an in-character line through the server voice,
   saves a choice (or "Match my Myte's personality") with PUT, and says so when the voice is off.
   Settings shows the voice and opens the picker. */

const VOICES: VoicesView = {
  connected: true,
  voices: [
    { id: 'af_heart', name: 'Heart', description: 'Warm and natural', accent: 'American', gender: 'female' },
    { id: 'am_michael', name: 'Michael', description: 'Calm and steady', accent: 'American', gender: 'male' },
    { id: 'bf_emma', name: 'Emma', description: 'Clear and bright', accent: 'British', gender: 'female' },
  ],
  chosen: null,
  selected: 'af_heart',
};

const ME = { id: 'u1', role: 'Product', agent_name: 'Juniper', listen_for: [] };

beforeEach(() => {
  resetMocks();
  (createAudioPlayer as jest.Mock).mockClear();
});

describe('the voice picker', () => {
  it('lists the voices, marks the current one and the personality match', async () => {
    const api = fakeApi({ 'GET /api/v1/voice/voices': VOICES, 'GET /users/me': ME });
    renderWithApi(<VoiceScreen />, api.client);
    expect(await screen.findByText('Warm and natural')).toBeTruthy();
    expect(screen.getByText('Calm and steady')).toBeTruthy();
    expect(screen.getByText('British · Female')).toBeTruthy();
    expect(screen.getByText('Current')).toBeTruthy();
    expect(await screen.findByText("Juniper's personality picks Heart.")).toBeTruthy();
    expect(screen.getByLabelText("Match my Myte's personality").props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText(/^Heart, Warm and natural, American · Female, current voice/).props.accessibilityState.checked).toBe(false);
  });

  it('saves a choice with PUT and marks it', async () => {
    const api = fakeApi({
      'GET /api/v1/voice/voices': VOICES,
      'GET /users/me': ME,
      'PUT /api/v1/voice/preference': ({ body }: { body?: unknown }) => ({
        ...VOICES,
        chosen: (body as { voice: string | null }).voice,
        selected: (body as { voice: string | null }).voice ?? 'af_heart',
      }),
    });
    renderWithApi(<VoiceScreen />, api.client);
    fireEvent.press(await screen.findByLabelText(/^Michael,/));
    await waitFor(() => expect(api.calls.map((c) => c.key)).toContain('PUT /api/v1/voice/preference'));
    const put = api.calls.find((c) => c.key === 'PUT /api/v1/voice/preference');
    expect(put?.opts.body).toEqual({ voice: 'am_michael' });
    expect((put?.opts as { idempotencyKey?: string }).idempotencyKey).toBeTruthy();
    expect(await screen.findByText('Juniper speaks as Michael now')).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText(/^Michael,.*current voice/).props.accessibilityState.checked).toBe(true));

    fireEvent.press(screen.getByLabelText("Match my Myte's personality"));
    await waitFor(() => expect(api.calls.filter((c) => c.key === 'PUT /api/v1/voice/preference')).toHaveLength(2));
    expect(api.calls.filter((c) => c.key === 'PUT /api/v1/voice/preference')[1]?.opts.body).toEqual({ voice: null });
    expect(await screen.findByText("Juniper's personality picked Heart")).toBeTruthy();
  });

  it('previews an in-character line in that voice, and stops it', async () => {
    const api = fakeApi({ 'GET /api/v1/voice/voices': VOICES, 'GET /users/me': ME, 'POST /api/v1/voice/speech': new ArrayBuffer(4) });
    renderWithApi(<VoiceScreen />, api.client);
    await screen.findByText("Juniper's personality picks Heart.");
    fireEvent.press(screen.getByLabelText('Preview Emma'));
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalled());
    expect(api.calls.find((c) => c.key === 'POST /api/v1/voice/speech')?.opts.body).toEqual({
      text: previewLine('Juniper'),
      voice: 'bf_emma',
      speed: 1,
      language: 'en',
    });
    // Previewing never saves.
    expect(api.calls.map((c) => c.key)).not.toContain('PUT /api/v1/voice/preference');
    const player = (createAudioPlayer as jest.Mock).mock.results[0]?.value as { pause: jest.Mock };
    fireEvent.press(screen.getByLabelText('Stop the Emma preview'));
    expect(player.pause).toHaveBeenCalled();
    expect(screen.getByLabelText('Preview Emma')).toBeTruthy();
  });

  it('a preview that cannot be spoken says so quietly', async () => {
    const { ApiError } = jest.requireActual('@/api/client') as typeof import('@/api/client');
    const api = fakeApi({
      'GET /api/v1/voice/voices': VOICES,
      'GET /users/me': ME,
      'POST /api/v1/voice/speech': new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'voice_not_connected'),
    });
    renderWithApi(<VoiceScreen />, api.client);
    fireEvent.press(await screen.findByLabelText('Preview Heart'));
    expect(await screen.findByText('Voice is unavailable right now')).toBeTruthy();
    expect(screen.getByLabelText('Preview Heart')).toBeTruthy();
  });

  it('says when the voice is not connected on this server', async () => {
    const api = fakeApi({ 'GET /api/v1/voice/voices': { ...VOICES, connected: false }, 'GET /users/me': ME });
    renderWithApi(<VoiceScreen />, api.client);
    expect(await screen.findByText("Your Myte's voice is not connected on this server")).toBeTruthy();
    expect(screen.queryByLabelText('Preview Heart')).toBeNull();
  });

  it('formats accent and gender', () => {
    expect(voiceMeta({ accent: 'American', gender: 'male' })).toBe('American · Male');
    expect(voiceMeta({ accent: '', gender: 'female' })).toBe('Female');
  });
});

describe('settings', () => {
  it('shows the voice and opens the picker; no device voice is offered', async () => {
    const api = fakeApi({
      'GET /api/v1/voice/voices': VOICES,
      'GET /users/me': ME,
      'GET /notifications/push-devices': { push_configured: false, items: [] },
    });
    renderWithApi(<Settings />, api.client);
    expect(await screen.findByText('Heart, matched to its personality')).toBeTruthy();
    expect(screen.getByText('Change its name and topics on the web.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Voice: Heart, matched to its personality'));
    expect(mockRouter.push).toHaveBeenCalledWith('/voice');
  });
});
