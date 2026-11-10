import { base64ToBytes, floatToPcm16, FRAME_BYTES, level, PcmFramer } from '@/realtime/capture/pcm';
import {
  backoffMs,
  CAPTURE_ORIGIN,
  CaptureSocket,
  initFrame,
  MAX_BUFFERED_FRAMES,
  MAX_RECONNECTS,
  needsRefresh,
  type CaptureCredentials,
  type CapturePhase,
  type SocketLike,
} from '@/realtime/capture/socket';
import { elapsed, elapsedSpoken } from '@/lib/capture-copy';
import { parseStoredDevice, pushRoute } from '@/lib/push-links';

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');

describe('pcm: base64 chunks to s16le frames', () => {
  it('decodes base64 like Buffer does, with or without padding', () => {
    for (const bytes of [[], [1], [1, 2], [1, 2, 3], [255, 0, 128, 7, 9]]) {
      expect(Array.from(base64ToBytes(b64(bytes)))).toEqual(bytes);
      expect(Array.from(base64ToBytes(b64(bytes).replace(/=+$/, '')))).toEqual(bytes);
    }
    expect(() => base64ToBytes('a*b')).toThrow();
  });

  it('frames arbitrary chunks into whole 100 ms frames and flushes whole samples', () => {
    expect(FRAME_BYTES).toBe(3200);
    const f = new PcmFramer(4);
    expect(f.push(new Uint8Array([1, 2, 3]))).toEqual([]);
    expect(f.push(new Uint8Array([4, 5, 6, 7, 8, 9])).map((x) => Array.from(x))).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    f.push(new Uint8Array([10, 11]));
    expect(Array.from(f.flush() ?? [])).toEqual([9, 10]); // byte 11 is half a sample: dropped
    expect(f.flush()).toBeNull();
    expect(() => new PcmFramer(3)).toThrow();
  });

  it('converts float samples to little-endian 16-bit and measures loudness', () => {
    const out = floatToPcm16(new Float32Array([0, 1, -1, 2]));
    const view = new DataView(out.buffer);
    expect([0, 1, 2, 3].map((i) => view.getInt16(i * 2, true))).toEqual([0, 32767, -32768, 32767]);
    expect(level(new Uint8Array(0))).toBe(0);
    expect(level(new Uint8Array(320))).toBe(0);
    expect(level(out)).toBeGreaterThan(0.9);
  });
});

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: Array<string | ArrayBuffer> = [];
  closed: { code?: number } | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onclose: ((e: { code: number; reason?: string }) => void) | null = null;
  constructor(
    readonly url: string,
    readonly headers: Record<string, string>,
  ) {}
  send(d: string | ArrayBuffer) {
    this.sent.push(d);
  }
  close(code?: number) {
    this.closed = { code };
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  ready() {
    this.onmessage?.({ data: JSON.stringify({ type: 'ready', meeting_id: 'm', channel: 'mic' }) });
  }
  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

function harness(initial: Partial<CaptureCredentials> = {}, now = 1000) {
  const sockets: FakeSocket[] = [];
  const phases: CapturePhase[] = [];
  const timers: Array<() => void> = [];
  let clock = now;
  let refreshes = 0;
  const refresh = jest.fn(async (): Promise<CaptureCredentials> => ({ token: `fresh${++refreshes}`, expiresAt: clock + 900, ingestUrl: 'wss://x/capture/audio' }));
  const s = new CaptureSocket(
    { token: 'tok', expiresAt: now + 900, ingestUrl: 'wss://x/capture/audio', ...initial },
    {
      open: (url, headers) => {
        const ws = new FakeSocket(url, headers);
        sockets.push(ws);
        return ws;
      },
      refresh,
      onPhase: (p) => phases.push(p),
      nowSeconds: () => clock,
      setTimer: (fn) => {
        timers.push(fn);
        return timers.length;
      },
      clearTimer: () => undefined,
    },
  );
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { s, sockets, phases, timers, refresh, flush, tick: (sec: number) => (clock += sec) };
}

const frame = (n: number) => new Uint8Array([n, 0]).buffer;

describe('capture socket: the /capture/audio protocol', () => {
  it('sends init first, buffers audio until ready, then streams binary frames and stops cleanly', async () => {
    const h = harness();
    h.s.start();
    await h.flush();
    const ws = h.sockets[0];
    expect(ws.url).toBe('wss://x/capture/audio');
    expect(ws.headers).toEqual({ origin: CAPTURE_ORIGIN });
    h.s.send(frame(1));
    ws.open();
    expect(JSON.parse(ws.sent[0] as string)).toEqual({ type: 'init', token: 'tok', channel: 'mic', sample_rate: 16000, encoding: 'pcm_s16le' });
    expect(ws.sent).toHaveLength(1); // nothing before ready
    ws.ready();
    expect(h.s.current).toBe('live');
    expect(ws.sent).toHaveLength(2);
    h.s.send(frame(2));
    expect(ws.sent).toHaveLength(3);
    h.s.stop();
    expect(JSON.parse(ws.sent[3] as string)).toEqual({ type: 'stop' });
    expect(ws.closed?.code).toBe(1000);
    expect(h.phases).toEqual(['connecting', 'live', 'stopping', 'closed']);
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('4401 mints a fresh token, then reconnects and resends what was recorded meanwhile', async () => {
    const h = harness();
    h.s.start();
    await h.flush();
    h.sockets[0].open();
    h.sockets[0].ready();
    h.sockets[0].drop(4401);
    expect(h.s.current).toBe('reconnecting');
    h.s.send(frame(9));
    h.timers.shift()!();
    await h.flush();
    expect(h.refresh).toHaveBeenCalledTimes(1);
    const ws = h.sockets[1];
    ws.open();
    expect(JSON.parse(ws.sent[0] as string).token).toBe('fresh1');
    ws.ready();
    expect(ws.sent).toHaveLength(2);
    expect(h.s.buffered).toBe(0);
  });

  it('refreshes before connecting when the token is about to expire, and not otherwise', async () => {
    expect(needsRefresh(1060, 1000)).toBe(true);
    expect(needsRefresh(1061, 1000)).toBe(false);
    const h = harness({ expiresAt: 1030 });
    h.s.start();
    await h.flush();
    expect(h.refresh).toHaveBeenCalledTimes(1);
    h.sockets[0].open();
    expect(JSON.parse(h.sockets[0].sent[0] as string).token).toBe('fresh1');
  });

  it('reconnects with backoff on a dropped network and gives up after a run of failures', async () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(backoffMs)).toEqual([500, 1000, 2000, 4000, 8000, 8000, 8000]);
    const h = harness();
    h.s.start();
    await h.flush();
    for (let i = 0; i < MAX_RECONNECTS; i++) {
      h.sockets[i].drop(1006);
      h.timers.shift()!();
      await h.flush();
    }
    h.sockets[MAX_RECONNECTS].drop(1006);
    expect(h.s.current).toBe('failed');
    expect(h.timers).toHaveLength(0);
  });

  it('keeps only the newest frames while disconnected', () => {
    const h = harness();
    for (let i = 0; i < MAX_BUFFERED_FRAMES + 5; i++) h.s.send(frame(i % 255));
    expect(h.s.buffered).toBe(MAX_BUFFERED_FRAMES);
  });

  it('a stop while reconnecting closes without reconnecting', async () => {
    const h = harness();
    h.s.start();
    await h.flush();
    h.sockets[0].drop(1006);
    h.s.stop();
    expect(h.s.current).toBe('closed');
    h.timers.forEach((t) => t());
    await h.flush();
    expect(h.sockets).toHaveLength(1);
    expect(initFrame('t')).toContain('"channel":"mic"');
  });
});

describe('capture copy', () => {
  it.each([
    [0, '0:00', '0 seconds'],
    [65_400, '1:05', '1 minute 5 seconds'],
    [3_725_000, '1:02:05', '1 hour 2 minutes 5 seconds'],
  ])('%s ms', (ms, short, spoken) => {
    expect(elapsed(ms)).toBe(short);
    expect(elapsedSpoken(ms)).toBe(spoken);
  });
});

describe('push links', () => {
  const UUID = '0b6a3c43-2f5d-4f4b-9a8e-0a1b2c3d4e5f';
  it('opens what the inbox row opens, else the inbox', () => {
    expect(pushRoute({ notification_id: 'n', link: `/meetings/${UUID}` })).toBe(`/meetings/${UUID}`);
    expect(pushRoute({ link: '/work/updates' })).toBe('/work?tab=updates');
    expect(pushRoute({ link: '/settings/usage' })).toBe('/inbox');
    expect(pushRoute({ link: 'https://evil.test' })).toBe('/inbox');
    expect(pushRoute(null)).toBe('/inbox');
    expect(pushRoute({})).toBe('/inbox');
  });
  it('reads back only a well-formed stored registration', () => {
    expect(parseStoredDevice(JSON.stringify({ id: 'd', scope: 'u:o' }))).toEqual({ id: 'd', scope: 'u:o' });
    expect(parseStoredDevice('{')).toBeNull();
    expect(parseStoredDevice(JSON.stringify({ id: 1 }))).toBeNull();
    expect(parseStoredDevice(null)).toBeNull();
  });
});
