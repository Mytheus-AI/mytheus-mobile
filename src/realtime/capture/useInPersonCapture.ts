import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@/api/ApiProvider';
import { ApiError } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import type { CaptureSession } from '@/api/types';
import { requestMicPermission, useMic } from './mic';
import { PcmFramer, level as levelOf } from './pcm';
import { CaptureSocket, type CaptureCredentials, type CapturePhase, type SocketLike } from './socket';

/**
 * Recording an in-person meeting on this phone, end to end:
 * consent -> microphone permission -> `POST /api/v1/capture/sessions` (creates the meeting and
 * mints a 15-minute capture token) -> `/capture/audio` (init, ready, PCM frames) -> Stop ->
 * `POST /api/v1/capture/sessions/{id}/end` (the meeting ends; minutes follow as for any meeting).
 */
export type CaptureStep =
  | 'ready' // consent not given yet
  | 'permission_denied'
  | 'not_connected'
  | 'starting'
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'stopping'
  | 'ended'
  | 'error';

export interface CaptureState {
  step: CaptureStep;
  meetingId: string | null;
  title: string | null;
  startedAt: number | null;
  level: number;
  error: string | null;
}

const INITIAL: CaptureState = { step: 'ready', meetingId: null, title: null, startedAt: null, level: 0, error: null };

function creds(s: CaptureSession): CaptureCredentials {
  return { token: s.capture_token, expiresAt: s.expires_at, ingestUrl: s.ingest_url };
}

function openSocket(url: string, headers: Record<string, string>): SocketLike {
  // React Native's WebSocket takes headers as a third argument (the DOM typing does not know it).
  const RNWebSocket = WebSocket as unknown as new (
    u: string,
    protocols: null,
    options: { headers: Record<string, string> },
  ) => WebSocket;
  const ws = new RNWebSocket(url, null, { headers });
  ws.binaryType = 'arraybuffer';
  return ws as unknown as SocketLike;
}

function stepFor(phase: CapturePhase): CaptureStep | null {
  if (phase === 'connecting') return 'connecting';
  if (phase === 'live') return 'live';
  if (phase === 'reconnecting') return 'reconnecting';
  if (phase === 'failed') return 'error';
  return null;
}

export function useInPersonCapture() {
  const api = useApi();
  const mic = useMic();
  const micRef = useRef(mic);
  micRef.current = mic;
  const [state, setState] = useState<CaptureState>(INITIAL);
  const socket = useRef<CaptureSocket | null>(null);
  const framer = useRef(new PcmFramer());
  const lastLevel = useRef(0);
  const consentAt = useRef<string | null>(null);

  const patch = useCallback((p: Partial<CaptureState>) => setState((s) => ({ ...s, ...p })), []);

  const start = useCallback(
    async (title: string) => {
      patch({ step: 'starting', error: null });
      if ((await requestMicPermission()) !== 'granted') {
        patch({ step: 'permission_denied' });
        return;
      }
      const at = new Date().toISOString();
      consentAt.current = at;
      let session: CaptureSession;
      try {
        session = await endpoints.startCapture(api, title.trim() || null, at);
      } catch (e) {
        if (e instanceof ApiError && e.status === 503) patch({ step: 'not_connected' });
        else patch({ step: 'error', error: 'The recording could not be started. Check your connection and try again.' });
        return;
      }
      patch({ meetingId: session.meeting_id, title: session.title, startedAt: Date.now() });
      const meetingId = session.meeting_id;
      const s = new CaptureSocket(creds(session), {
        open: openSocket,
        refresh: async () => creds(await endpoints.refreshCapture(api, meetingId, consentAt.current ?? at)),
        onPhase: (phase) => {
          const step = stepFor(phase);
          if (step === 'error') {
            patch({ step, error: 'The connection was lost and could not be restored. What was recorded so far is saved.' });
          } else if (step) {
            patch({ step });
          }
        },
      });
      socket.current = s;
      framer.current = new PcmFramer();
      s.start();
      try {
        await mic.start((bytes) => {
          for (const frame of framer.current.push(bytes)) {
            s.send(frame.buffer as ArrayBuffer);
          }
          const now = Date.now();
          if (now - lastLevel.current > 150) {
            lastLevel.current = now;
            patch({ level: levelOf(bytes) });
          }
        });
      } catch {
        s.stop();
        socket.current = null;
        await endpoints.endCapture(api, meetingId).catch(() => undefined);
        patch({ step: 'error', error: 'The microphone could not be started.' });
      }
    },
    [api, mic, patch],
  );

  const stop = useCallback(async () => {
    const s = socket.current;
    const meetingId = state.meetingId;
    patch({ step: 'stopping', level: 0 });
    await mic.stop().catch(() => undefined);
    const rest = framer.current.flush();
    if (s) {
      if (rest) s.send(rest.buffer as ArrayBuffer);
      s.stop();
    }
    socket.current = null;
    if (meetingId) {
      try {
        await endpoints.endCapture(api, meetingId);
      } catch {
        patch({ step: 'error', error: 'The recording stopped, but the meeting could not be closed. Open it to end it.' });
        return;
      }
    }
    patch({ step: 'ended' });
  }, [api, mic, patch, state.meetingId]);

  const reset = useCallback(() => setState(INITIAL), []);

  // Leaving the screen mid-recording stops the socket and the microphone.
  useEffect(
    () => () => {
      socket.current?.stop();
      void micRef.current.stop().catch(() => undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { state, start, stop, reset };
}
