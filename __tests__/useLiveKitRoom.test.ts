import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ConnectionState, DisconnectReason, RoomEvent, type Room } from 'livekit-client';
import { ApiError } from '@/api/client';
import type { TokenResponse } from '@/api/types';
import { useLiveKitRoom } from '@/realtime/useLiveKitRoom';

type Handler = (...args: unknown[]) => void;

class FakeRoom {
  handlers = new Map<string, Handler[]>();
  state = ConnectionState.Disconnected;
  connects: { url: string; token: string }[] = [];
  failNext = 0;
  remoteParticipants = new Map();
  localParticipant = {
    identity: 'me',
    isMicrophoneEnabled: false,
    isCameraEnabled: false,
    setMicrophoneEnabled: jest.fn(async (on: boolean) => {
      this.localParticipant.isMicrophoneEnabled = on;
    }),
    setCameraEnabled: jest.fn(async (on: boolean) => {
      this.localParticipant.isCameraEnabled = on;
    }),
  };
  on(ev: string, fn: Handler) {
    this.handlers.set(ev, [...(this.handlers.get(ev) ?? []), fn]);
    return this;
  }
  fire(ev: string, ...args: unknown[]) {
    for (const fn of this.handlers.get(ev) ?? []) fn(...args);
  }
  async connect(url: string, token: string) {
    this.connects.push({ url, token });
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error('ws failed');
    }
    this.state = ConnectionState.Connected;
  }
  disconnect = jest.fn(async () => {
    this.state = ConnectionState.Disconnected;
  });
  removeAllListeners() {
    this.handlers.clear();
  }
}

function minted(n: number): TokenResponse {
  return { token: `lk-${n}`, room: 'room', livekit_url: 'wss://sfu.example.test', started_at: '2026-11-11T10:00:00Z' };
}

function setup(mintImpl?: (consent: string | null, n: number) => Promise<TokenResponse>, initialConsent: string | null = null) {
  const rooms: FakeRoom[] = [];
  let n = 0;
  const mint = jest.fn((consent: string | null) => {
    n += 1;
    return mintImpl ? mintImpl(consent, n) : Promise.resolve(minted(n));
  });
  const startAudio = jest.fn(async () => undefined);
  const stopAudio = jest.fn(async () => undefined);
  const hook = renderHook(() =>
    useLiveKitRoom('m1', {
      mint,
      startAudio,
      stopAudio,
      initialConsent,
      createRoom: () => {
        const r = new FakeRoom();
        rooms.push(r);
        return r as unknown as Room;
      },
    }),
  );
  return { hook, rooms, mint, startAudio, stopAudio };
}

describe('useLiveKitRoom', () => {
  it('mints, connects to the server-given SFU, and turns the mic on', async () => {
    const { hook, rooms, mint, startAudio } = setup(undefined, 'room-notice-2026-11-11');
    await waitFor(() => expect(hook.result.current.status).toBe('connected'));
    expect(mint).toHaveBeenCalledWith('room-notice-2026-11-11');
    expect(rooms[0].connects[0]).toEqual({ url: 'wss://sfu.example.test', token: 'lk-1' });
    expect(startAudio).toHaveBeenCalled();
    expect(hook.result.current.micOn).toBe(true);
    expect(hook.result.current.startedAt).toBe('2026-11-11T10:00:00Z');
  });

  it('asks for consent on a 428 and re-mints with the version', async () => {
    const { hook, mint } = setup((consent, n) =>
      consent ? Promise.resolve(minted(n)) : Promise.reject(new ApiError(428, 'CONSENT_REQUIRED', 'consent')),
    );
    await waitFor(() => expect(hook.result.current.status).toBe('consent'));
    act(() => hook.result.current.acceptConsent('room-notice-2026-11-11'));
    await waitFor(() => expect(hook.result.current.status).toBe('connected'));
    expect(mint).toHaveBeenLastCalledWith('room-notice-2026-11-11');
  });

  it('stops with the reason when the server says no for good', async () => {
    const { hook } = setup(() => Promise.reject(new ApiError(403, 'NOT_A_PARTICIPANT', 'no')));
    await waitFor(() => expect(hook.result.current.status).toBe('error'));
    expect(hook.result.current.error).toBe('NOT_A_PARTICIPANT');
  });

  it('re-mints a fresh token and reconnects after an unexpected disconnect', async () => {
    jest.useFakeTimers();
    try {
      const { hook, rooms, mint } = setup();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(hook.result.current.status).toBe('connected'));
      act(() => rooms[0].fire(RoomEvent.Disconnected, DisconnectReason.SIGNAL_CLOSE));
      expect(hook.result.current.status).toBe('reconnecting');
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      await waitFor(() => expect(hook.result.current.status).toBe('connected'));
      expect(mint).toHaveBeenCalledTimes(2);
      expect(rooms[0].connects.map((c) => c.token)).toEqual(['lk-1', 'lk-2']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not reconnect after you leave, and releases the audio session', async () => {
    const { hook, rooms, mint, stopAudio } = setup();
    await waitFor(() => expect(hook.result.current.status).toBe('connected'));
    await act(async () => {
      await hook.result.current.leave();
    });
    act(() => rooms[0].fire(RoomEvent.Disconnected, DisconnectReason.CLIENT_INITIATED));
    expect(mint).toHaveBeenCalledTimes(1);
    expect(stopAudio).toHaveBeenCalled();
  });

  it('shows reconnecting while LiveKit resumes on its own', async () => {
    const { hook, rooms } = setup();
    await waitFor(() => expect(hook.result.current.status).toBe('connected'));
    act(() => rooms[0].fire(RoomEvent.ConnectionStateChanged, ConnectionState.Reconnecting));
    expect(hook.result.current.status).toBe('reconnecting');
    act(() => rooms[0].fire(RoomEvent.ConnectionStateChanged, ConnectionState.Connected));
    expect(hook.result.current.status).toBe('connected');
  });
});
