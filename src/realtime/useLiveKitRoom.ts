/**
 * Connects one LiveKit `Room` for one meeting and keeps it connected. The mobile counterpart of
 * mytheus-ui `src/lib/realtime/useLiveKitRoom.ts`, with the same rules:
 *
 * - A FRESH TOKEN ON EVERY CONNECT. The token is minted by meeting-service
 *   (`POST /api/meetings/{id}/token`). livekit-client resumes a short drop by itself, but when it
 *   gives up the room goes `Disconnected` for good; a disconnect nobody asked for then re-mints and
 *   reconnects with backoff, and after `MAX_RECONNECT_ATTEMPTS` reports `error` with Try again.
 * - CONSENT. A 428 `CONSENT_REQUIRED` from the mint becomes `status: "consent"`; the room asks right
 *   there and `acceptConsent(version)` re-mints WITH `consent.version`, which meeting-service records
 *   once on the participant row before it mints.
 * - The server's `livekit_url` is always used: the phone holds no LiveKit configuration at all.
 *
 * Phone specifics: the native audio session is started before connecting and stopped on leave, so
 * the app holds a call audio session only while it is in a meeting.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectionState, DisconnectReason, Room, RoomEvent, type LocalParticipant, type RemoteParticipant } from 'livekit-client';
import { ApiError } from '@/api/client';
import type { TokenResponse } from '@/api/types';
import { MAX_RECONNECT_ATTEMPTS, backoffMs, type CallLink } from './connection';

export interface LiveKitDeps {
  /** Mint a token; `consent` is the notice version the person agreed to, or null. */
  mint: (consent: string | null) => Promise<TokenResponse>;
  /** Start and stop the native call audio session (no-ops in tests). */
  startAudio?: () => Promise<void>;
  stopAudio?: () => Promise<void>;
  createRoom?: () => Room;
  /** Consent the person gave on the pre-join screen, sent with the first mint. */
  initialConsent?: string | null;
  /** Join with the microphone on (the phone on the table is listening). */
  micOnJoin?: boolean;
}

export interface LiveKitRoomState {
  status: CallLink;
  room: Room | null;
  participants: (LocalParticipant | RemoteParticipant)[];
  error: string | null;
  startedAt: string | null;
  micOn: boolean;
  cameraOn: boolean;
  setMic: (on: boolean) => Promise<void>;
  setCamera: (on: boolean) => Promise<void>;
  retry: () => void;
  acceptConsent: (version: string) => void;
  leave: () => Promise<void>;
}

/** Failures another attempt cannot fix: stop and say why. */
export function isFinalMintError(code: string): boolean {
  return ['NOT_A_PARTICIPANT', 'NOT_FOUND', 'VERSION_CONFLICT', 'CONSENT_REQUIRED', 'VALIDATION_FAILED', 'EXTERNAL_MEETING', 'AUTH_REQUIRED'].includes(code);
}

/** A disconnect the user (or the meeting) chose: never reconnect after these. */
export function intendedDisconnect(reason: DisconnectReason | undefined): boolean {
  return (
    reason === DisconnectReason.CLIENT_INITIATED ||
    reason === DisconnectReason.ROOM_DELETED ||
    reason === DisconnectReason.PARTICIPANT_REMOVED ||
    reason === DisconnectReason.DUPLICATE_IDENTITY
  );
}

export function useLiveKitRoom(meetingId: string, deps: LiveKitDeps): LiveKitRoomState {
  const [status, setStatus] = useState<CallLink>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<(LocalParticipant | RemoteParticipant)[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [generation, setGeneration] = useState(0);
  const consentRef = useRef<string | null>(deps.initialConsent ?? null);
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const roomRef = useRef<Room | null>(null);

  const sync = useCallback((r: Room) => {
    // A new array every time: LiveKit mutates participants in place.
    setParticipants([r.localParticipant, ...Array.from(r.remoteParticipants.values())]);
    setMicOn(r.localParticipant.isMicrophoneEnabled);
    setCameraOn(r.localParticipant.isCameraEnabled);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const d = depsRef.current;
    const r = d.createRoom ? d.createRoom() : new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = r;
    setRoom(r);
    setStatus('connecting');
    setError(null);

    const onChange = () => {
      if (!cancelled) sync(r);
    };

    const connect = async (): Promise<void> => {
      try {
        // Always a fresh token: a full disconnect cannot reuse the one it connected with.
        const minted = await depsRef.current.mint(consentRef.current);
        if (cancelled) return;
        if (minted.started_at) setStartedAt(minted.started_at);
        await depsRef.current.startAudio?.();
        await r.connect(minted.livekit_url, minted.token);
        if (cancelled) return;
        attempt = 0;
        setError(null);
        setStatus('connected');
        if (depsRef.current.micOnJoin !== false && !r.localParticipant.isMicrophoneEnabled) {
          try {
            await r.localParticipant.setMicrophoneEnabled(true);
          } catch {
            // Permission refused: stay in the call, muted. The control says so.
          }
        }
        sync(r);
      } catch (err) {
        if (cancelled) return;
        const code = err instanceof ApiError ? err.code : 'CONNECT_FAILED';
        if (code === 'CONSENT_REQUIRED') {
          setStatus('consent');
          return;
        }
        if (isFinalMintError(code) || attempt >= MAX_RECONNECT_ATTEMPTS) {
          setError(code);
          setStatus('error');
          return;
        }
        setStatus(attempt === 0 && r.state !== ConnectionState.Disconnected ? 'connecting' : 'reconnecting');
        timer = setTimeout(() => void connect(), backoffMs(attempt));
        attempt += 1;
      }
    };

    r.on(RoomEvent.ParticipantConnected, onChange)
      .on(RoomEvent.ParticipantDisconnected, onChange)
      .on(RoomEvent.TrackSubscribed, onChange)
      .on(RoomEvent.TrackUnsubscribed, onChange)
      .on(RoomEvent.TrackMuted, onChange)
      .on(RoomEvent.TrackUnmuted, onChange)
      .on(RoomEvent.LocalTrackPublished, onChange)
      .on(RoomEvent.LocalTrackUnpublished, onChange)
      .on(RoomEvent.ActiveSpeakersChanged, onChange)
      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (cancelled) return;
        if (state === ConnectionState.Connected) setStatus('connected');
        else if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) {
          setStatus('reconnecting');
        }
      })
      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        if (cancelled) return;
        setParticipants([]);
        if (intendedDisconnect(reason)) return;
        // LiveKit gave up resuming: start again from a fresh token, with backoff.
        setStatus('reconnecting');
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void connect(), backoffMs(attempt));
        attempt += 1;
      });

    void connect();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      r.removeAllListeners();
      void r.disconnect();
      void depsRef.current.stopAudio?.();
      roomRef.current = null;
      setRoom(null);
    };
  }, [meetingId, sync, generation]);

  const retry = useCallback(() => setGeneration((g) => g + 1), []);
  const acceptConsent = useCallback((version: string) => {
    consentRef.current = version;
    setGeneration((g) => g + 1);
  }, []);

  const setMic = useCallback(
    async (on: boolean) => {
      const r = roomRef.current;
      if (!r) return;
      try {
        await r.localParticipant.setMicrophoneEnabled(on);
      } finally {
        sync(r);
      }
    },
    [sync],
  );
  const setCamera = useCallback(
    async (on: boolean) => {
      const r = roomRef.current;
      if (!r) return;
      try {
        await r.localParticipant.setCameraEnabled(on);
      } finally {
        sync(r);
      }
    },
    [sync],
  );
  const leave = useCallback(async () => {
    const r = roomRef.current;
    if (r) await r.disconnect();
    await depsRef.current.stopAudio?.();
  }, []);

  return { status, room, participants, error, startedAt, micOn, cameraOn, setMic, setCamera, retry, acceptConsent, leave };
}
