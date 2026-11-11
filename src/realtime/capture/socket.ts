/**
 * The `/capture/audio` client: one microphone channel of an in-person meeting.
 *
 * Wire contract (mytheus-realtime `transcription_service/capture_in.py`):
 * 1. connect; the FIRST frame is `{"type":"init","token","channel":"mic","sample_rate":16000,
 *    "encoding":"pcm_s16le"}` (the credential travels in the frame, not a header);
 * 2. the server answers `{"type":"ready","meeting_id","channel"}`; only then is audio sent;
 * 3. binary s16le frames; `{"type":"stop"}` ends it gracefully;
 * 4. close 4401: the capture token is missing, invalid or expired -> mint a fresh one, reconnect.
 *
 * The token only gates connecting: a long recording keeps streaming past `expires_at`. Before any
 * (re)connect whose token expires within `REFRESH_MARGIN_S`, a fresh one is minted first. Any
 * other unexpected close reconnects with backoff (at most `MAX_RECONNECTS` in a row; a `ready`
 * resets the count). Frames recorded while not connected wait in a bounded buffer (the newest
 * `MAX_BUFFERED_FRAMES`, 30 s) and are sent after `ready`, so a short network drop loses nothing.
 *
 * The socket and the clock are injected, so the whole protocol is unit-tested with a fake socket.
 */

export const CAPTURE_ORIGIN = 'mytheus-mobile://capture';
export const CLOSE_TOKEN_REJECTED = 4401;
export const REFRESH_MARGIN_S = 60;
export const MAX_RECONNECTS = 5;
export const MAX_BUFFERED_FRAMES = 300;

export interface CaptureCredentials {
  token: string;
  expiresAt: number;
  ingestUrl: string;
}

export interface SocketLike {
  readyState: number;
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onclose: ((e: { code: number; reason?: string }) => void) | null;
}

export type SocketFactory = (url: string, headers: Record<string, string>) => SocketLike;

export type CapturePhase = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'stopping' | 'closed' | 'failed';

export interface CaptureSocketDeps {
  open: SocketFactory;
  refresh: () => Promise<CaptureCredentials>;
  onPhase: (phase: CapturePhase, detail?: string) => void;
  nowSeconds?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
}

const OPEN = 1;

export function initFrame(token: string): string {
  return JSON.stringify({ type: 'init', token, channel: 'mic', sample_rate: 16000, encoding: 'pcm_s16le' });
}

export function needsRefresh(expiresAt: number, nowSeconds: number, margin = REFRESH_MARGIN_S): boolean {
  return expiresAt - nowSeconds <= margin;
}

export function backoffMs(attempt: number): number {
  return Math.min(8000, 500 * 2 ** Math.max(0, attempt - 1));
}

export class CaptureSocket {
  private creds: CaptureCredentials;
  private ws: SocketLike | null = null;
  private phase: CapturePhase = 'idle';
  private ready = false;
  private attempts = 0;
  private buffer: ArrayBuffer[] = [];
  private timer: unknown = null;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (t: unknown) => void;

  constructor(initial: CaptureCredentials, private readonly deps: CaptureSocketDeps) {
    this.creds = initial;
    this.now = deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = deps.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  }

  get current(): CapturePhase {
    return this.phase;
  }

  get buffered(): number {
    return this.buffer.length;
  }

  start(): void {
    if (this.phase !== 'idle') return;
    void this.connect();
  }

  /** Queue one binary frame; sent at once when live, else buffered (oldest dropped first). */
  send(frame: ArrayBuffer): void {
    if (this.phase === 'stopping' || this.phase === 'closed' || this.phase === 'failed') return;
    if (this.ready && this.ws && this.ws.readyState === OPEN) {
      this.ws.send(frame);
      return;
    }
    this.buffer.push(frame);
    if (this.buffer.length > MAX_BUFFERED_FRAMES) this.buffer.shift();
  }

  /** Send what is buffered (when live), then `stop`, then close. */
  stop(): void {
    if (this.phase === 'closed' || this.phase === 'failed') return;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    const ws = this.ws;
    this.set('stopping');
    if (ws && ws.readyState === OPEN && this.ready) {
      for (const f of this.buffer) ws.send(f);
      this.buffer = [];
      ws.send(JSON.stringify({ type: 'stop' }));
      ws.close(1000, 'stopped');
    } else if (ws) {
      ws.close(1000, 'stopped');
    }
    this.ws = null;
    this.set('closed');
  }

  private stopped(): boolean {
    const p: CapturePhase = this.phase;
    return p === 'stopping' || p === 'closed' || p === 'failed';
  }

  private set(phase: CapturePhase, detail?: string): void {
    this.phase = phase;
    this.deps.onPhase(phase, detail);
  }

  private async connect(): Promise<void> {
    if (this.phase === 'stopping' || this.phase === 'closed' || this.phase === 'failed') return;
    this.set(this.attempts === 0 ? 'connecting' : 'reconnecting');
    if (needsRefresh(this.creds.expiresAt, this.now())) {
      try {
        this.creds = await this.deps.refresh();
      } catch {
        this.retryOrFail('refresh_failed');
        return;
      }
      // `stop()` may have run while the refresh was in flight (TS narrows `phase` too eagerly).
      if (this.stopped()) return;
    }
    let ws: SocketLike;
    try {
      ws = this.deps.open(this.creds.ingestUrl, { origin: CAPTURE_ORIGIN });
    } catch {
      this.retryOrFail('open_failed');
      return;
    }
    this.ws = ws;
    this.ready = false;
    ws.onopen = () => ws.send(initFrame(this.creds.token));
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      let msg: { type?: unknown } | null = null;
      try {
        msg = JSON.parse(e.data) as { type?: unknown };
      } catch {
        return;
      }
      if (msg?.type === 'ready' && this.ws === ws) {
        this.ready = true;
        this.attempts = 0;
        this.set('live');
        const queued = this.buffer;
        this.buffer = [];
        for (const f of queued) ws.send(f);
      }
    };
    ws.onerror = () => undefined; // the close that follows decides
    ws.onclose = (e) => {
      if (this.ws !== ws) return; // an old socket, or stopped on purpose
      this.ws = null;
      this.ready = false;
      if (this.phase === 'stopping' || this.phase === 'closed') return;
      if (e.code === CLOSE_TOKEN_REJECTED) {
        // Expired or rejected: the next connect mints a fresh token first.
        this.creds = { ...this.creds, expiresAt: 0 };
      }
      this.retryOrFail(e.code === CLOSE_TOKEN_REJECTED ? 'token_rejected' : `closed_${e.code}`);
    };
  }

  private retryOrFail(reason: string): void {
    if (this.phase === 'stopping' || this.phase === 'closed') return;
    this.attempts += 1;
    if (this.attempts > MAX_RECONNECTS) {
      this.set('failed', reason);
      return;
    }
    this.set('reconnecting', reason);
    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.connect();
    }, backoffMs(this.attempts));
  }
}
