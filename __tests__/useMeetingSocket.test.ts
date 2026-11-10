import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Socket } from 'socket.io-client';
import { REAUTH_MS, useMeetingSocket, type Hydrators } from '@/realtime/useMeetingSocket';
import { orderedCandidates } from '@/realtime/candidates';
import { MAX_RECONNECT_ATTEMPTS } from '@/realtime/connection';

const MEETING = '0b6a3c43-2f5d-4f4b-9a8e-0a1b2c3d4e5f';
const D1 = '5d2e8f10-7a1b-4c3d-9e8f-0a1b2c3d4e5f';
type Handler = (...args: unknown[]) => void;

class FakeSocket {
  handlers = new Map<string, Handler[]>();
  connected = false;
  active = true;
  emitted: { event: string; payload: unknown }[] = [];
  handshakes: string[] = [];
  joinAck: unknown = { ok: true, presence: ['u1'] };
  ack: (event: string, payload: unknown) => unknown = () => ({ ok: true });
  constructor(public url: string, public opts: { auth: (cb: (d: { token: string }) => void) => void }) {}
  on(ev: string, fn: Handler) {
    this.handlers.set(ev, [...(this.handlers.get(ev) ?? []), fn]);
    return this;
  }
  fire(ev: string, ...args: unknown[]) {
    for (const fn of this.handlers.get(ev) ?? []) fn(...args);
  }
  emit(event: string, payload: unknown, ack?: (a: unknown) => void) {
    this.emitted.push({ event, payload });
    if (event === 'join') ack?.(this.joinAck);
    return this;
  }
  timeout() {
    return {
      emitWithAck: async (event: string, payload: unknown) => {
        this.emitted.push({ event, payload });
        return this.ack(event, payload);
      },
    };
  }
  /** What socket.io does on (re)connect: ask `auth` for credentials, then connect. */
  async handshake() {
    const token = await new Promise<string>((resolve) => this.opts.auth((d) => resolve(d.token)));
    this.handshakes.push(token);
    this.connected = true;
    this.fire('connect');
  }
  connect() {
    void this.handshake();
    return this;
  }
  disconnect() {
    this.connected = false;
    return this;
  }
  removeAllListeners() {
    this.handlers.clear();
    return this;
  }
}

function setup(over: Partial<Hydrators> = {}) {
  const sockets: FakeSocket[] = [];
  let n = 0;
  const getToken = jest.fn(async () => `token-${++n}`);
  const hydrate: Hydrators = {
    transcript: jest.fn(async () => [{ chunkId: 'c0', speakerId: '0', startMs: 0, endMs: 900, text: 'Earlier line', isFinal: true }]),
    notes: jest.fn(async () => [{ windowId: `${MEETING}:0`, content: 'A saved note' }]),
    candidates: jest.fn(async () => ({ decisions: [], actions: [] })),
    agenda: jest.fn(async () => []),
    ...over,
  };
  const connect = (url: string, opts: unknown) => {
    const s = new FakeSocket(url, opts as FakeSocket['opts']);
    sockets.push(s);
    return s as unknown as Socket;
  };
  const hook = renderHook(() =>
    useMeetingSocket(MEETING, { url: 'wss://rt.example.test', getToken, meId: 'me', hydrate, connect }),
  );
  return { hook, sockets, getToken, hydrate };
}

const wrap = (payload: unknown) => ({ meetingId: MEETING, payload });

describe('useMeetingSocket', () => {
  it('connects to /v1 with a fresh token, joins, and re-hydrates from REST', async () => {
    const { hook, sockets, hydrate } = setup();
    const s = sockets[0];
    expect(s.url).toBe('wss://rt.example.test/v1');
    await act(async () => s.handshake());
    expect(s.handshakes).toEqual(['token-1']);
    expect(s.emitted[0]).toEqual({ event: 'join', payload: { meetingId: MEETING } });
    await waitFor(() => expect(hook.result.current.status).toBe('joined'));
    expect(hook.result.current.presence).toEqual(['u1']);
    expect(hydrate.transcript).toHaveBeenCalled();
    await waitFor(() => expect(hook.result.current.captions.lines).toHaveLength(1));
  });

  it('asks for a NEW token on every reconnect and re-joins', async () => {
    const { hook, sockets, hydrate } = setup();
    const s = sockets[0];
    await act(async () => s.handshake());
    act(() => s.fire('disconnect', 'transport close'));
    expect(hook.result.current.status).toBe('reconnecting');
    await act(async () => s.handshake());
    expect(s.handshakes).toEqual(['token-1', 'token-2']);
    expect(s.emitted.filter((e) => e.event === 'join')).toHaveLength(2);
    expect(hydrate.notes).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(hook.result.current.status).toBe('joined'));
  });

  it('keeps the gateway token fresh with reauth while connected', async () => {
    jest.useFakeTimers();
    try {
      const { sockets } = setup();
      const s = sockets[0];
      await act(async () => s.handshake());
      await act(async () => {
        jest.advanceTimersByTime(REAUTH_MS);
      });
      const reauth = s.emitted.find((e) => e.event === 'reauth');
      expect(reauth?.payload).toEqual({ token: expect.stringMatching(/^token-/) });
    } finally {
      jest.useRealTimers();
    }
  });

  it('reduces captions, notes and the shared candidate ledger, for this meeting only', async () => {
    const { hook, sockets } = setup();
    const s = sockets[0];
    await act(async () => s.handshake());
    act(() => {
      s.fire('caption', wrap({ chunkId: 'c1', speakerId: '1', startMs: 1000, endMs: 1500, text: 'Ship it', isFinal: false }));
      s.fire('caption', wrap({ chunkId: 'c1', speakerId: '1', startMs: 1000, endMs: 1600, text: 'Ship it Friday', isFinal: true }));
      s.fire('caption', { meetingId: 'other', payload: { chunkId: 'x', speakerId: '1', startMs: 0, endMs: 1, text: 'leak', isFinal: true } });
      s.fire('agent-delta', wrap({ windowId: `${MEETING}:30000`, seq: 0, delta: 'Draft', done: false }));
      s.fire('agent-candidate', wrap({ windowId: `${MEETING}:30000`, agent: 'decision', kind: 'decision_candidate', candidates: [{ id: D1, content: 'Ship Friday', confidence: 0.9 }] }));
    });
    const st = hook.result.current;
    expect(st.captions.lines.map((l) => l.text)).toContain('Ship it Friday');
    expect(st.captions.lines.map((l) => l.text)).not.toContain('leak');
    expect(st.notes.byWindow[`${MEETING}:30000`]?.text).toBe('Draft');
    expect(st.notes.byWindow[`${MEETING}:30000`]?.final).toBe(false);
    expect(orderedCandidates(st.candidates).map((c) => c.id)).toEqual([D1]);

    act(() => {
      s.fire('candidate-lock', wrap({ candidateId: D1, byUserId: 'maya', until: Date.now() + 60_000 }));
    });
    expect(hook.result.current.candidates.locks[D1]?.byUserId).toBe('maya');

    act(() => {
      s.fire(
        'candidate-resolution',
        wrap({ candidateId: D1, kind: 'decision', outcome: 'confirmed', byUserId: 'maya', at: '2026-11-11T10:00:00Z', row: { status: 'confirmed', content: 'Ship Friday', rationale: null, assigneeId: null, dueDate: null, confirmedBy: 'maya' } }),
      );
    });
    const after = hook.result.current.candidates;
    expect(after.resolved[D1]).toBe('confirmed');
    expect(after.settled[D1]?.byUserId).toBe('maya');
  });

  it('announces a confirm after refreshing its token, and applies hands, reactions, agenda and the end', async () => {
    const { hook, sockets } = setup();
    const s = sockets[0];
    await act(async () => s.handshake());
    await waitFor(() => expect(hook.result.current.status).toBe('joined'));

    await act(async () => {
      await hook.result.current.announceCandidate('d1', 'confirmed');
    });
    const events = s.emitted.map((e) => e.event);
    const i = events.lastIndexOf('candidate-resolved');
    expect(events[i - 1]).toBe('reauth');
    expect(s.emitted[i].payload).toEqual({ meetingId: MEETING, candidateId: 'd1', outcome: 'confirmed' });

    await act(async () => {
      await hook.result.current.setHand(true);
      await hook.result.current.react('clap');
      await hook.result.current.announceEnd();
    });
    expect(s.emitted.map((e) => e.event)).toEqual(expect.arrayContaining(['hand', 'reaction', 'end-meeting']));

    act(() => {
      s.fire('room-state', wrap({ locks: [], hands: [{ userId: 'raj', at: '2026-11-11T10:00:00Z' }] }));
      s.fire('hand', wrap({ userId: 'maya', raised: true, at: '2026-11-11T10:01:00Z' }));
      s.fire('reaction', wrap({ id: 'r1', userId: 'maya', reaction: 'clap', at: '2026-11-11T10:01:00Z' }));
      s.fire('meeting-ended', wrap({ byUserId: 'maya', at: '2026-11-11T10:30:00Z' }));
    });
    const st = hook.result.current;
    expect(Object.keys(st.hands.raised).sort()).toEqual(['maya', 'raj']);
    expect(st.reactions).toHaveLength(1);
    expect(st.ended).toEqual({ byUserId: 'maya', at: '2026-11-11T10:30:00Z' });
  });

  it('reports forbidden when the gateway refuses the join', async () => {
    const { hook, sockets } = setup();
    sockets[0].joinAck = { ok: false, error: 'FORBIDDEN' };
    await act(async () => sockets[0].handshake());
    expect(hook.result.current.status).toBe('forbidden');
  });

  it('gives up after repeated refused handshakes and says so, then can start over', async () => {
    jest.useFakeTimers();
    try {
      const { hook, sockets } = setup();
      const s = sockets[0];
      s.active = true;
      for (let k = 0; k < MAX_RECONNECT_ATTEMPTS; k += 1) {
        act(() => s.fire('connect_error', new Error('refused')));
      }
      expect(hook.result.current.status).toBe('error');
      act(() => hook.result.current.retry());
      expect(sockets).toHaveLength(2);
      expect(hook.result.current.status).toBe('connecting');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not emit while not joined', async () => {
    const { hook } = setup();
    const ack = await hook.result.current.setHand(true);
    expect(ack).toEqual({ ok: false, error: 'NOT_CONNECTED' });
  });
});
