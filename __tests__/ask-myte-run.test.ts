import { ApiError, type ApiClient, type StreamResponse } from '@/api/client';
import { ANSWER_TIMEOUT_MS, runAskMyte } from '@/api/ask-myte';
import { encodeSse } from '@/lib/ask-myte/sse';
import type { AskRequest, StreamEvent } from '@/lib/ask-myte/types';
import { ALL_SCOPE } from '@/lib/ask-myte/types';

const T1 = '11111111-1111-4111-8111-111111111111';
const M = '22222222-2222-4222-8222-222222222222';

type Opts = { path?: Record<string, string>; query?: Record<string, unknown>; body?: unknown; idempotencyKey?: string; freshToken?: boolean; timeoutMs?: number };
type Handler = (opts: Opts) => unknown;

const bytes = (s: string) => new TextEncoder().encode(s);

/** An upstream SSE body delivered in the given chunks; an abort errors it, as expo/fetch does. */
function sseBody(chunks: string[], opts: { hang?: boolean; signal?: AbortSignal } = {}): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(bytes(ch));
      if (!opts.hang) c.close();
      opts.signal?.addEventListener('abort', () => c.error(new Error('aborted')));
    },
  });
}

function sse(status: number, body: ReadableStream<Uint8Array> | null, type = 'text/event-stream; charset=utf-8', problem: unknown = null): StreamResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? type : null) },
    body,
    json: async () => {
      if (problem === null) throw new Error('not json');
      return problem;
    },
  };
}

const wire = (...evs: StreamEvent[]) => evs.map(encodeSse).join('');

const DONE: StreamEvent = { event: 'done', data: { abstained: false, degraded: false, cited: [1] } };

function fakeClient(table: Record<string, Handler | unknown>, stream: (body: unknown, signal?: AbortSignal) => StreamResponse | Promise<StreamResponse>) {
  const calls: { key: string; opts: Opts }[] = [];
  const streamed: { path: string; body: unknown }[] = [];
  const client = {
    async request(method: string, path: string, opts?: Opts) {
      const key = `${method.toUpperCase()} ${path}`;
      calls.push({ key, opts: opts ?? {} });
      if (!(key in table)) throw new Error(`unexpected call ${key}`);
      const h = table[key];
      const v = typeof h === 'function' ? (h as Handler)(opts ?? {}) : h;
      if (v instanceof Error) throw v;
      return v;
    },
    async requestBytes() {
      throw new Error('not used');
    },
    async stream(path: string, body: unknown, signal?: AbortSignal) {
      streamed.push({ path, body });
      return stream(body, signal);
    },
  };
  return { client: client as unknown as ApiClient, calls, streamed };
}

const baseTable = (over: Record<string, Handler | unknown> = {}) => ({
  'GET /users/me': { agent_name: null, display_name: 'Maya Rao', agent_personality: 'concise', agent_instructions: '  Be brief.  ' },
  'GET /api/v1/myte/memories': { items: [{ id: 'mem1', text: 'I lead the backend team.' }] },
  'POST /api/v1/myte/threads': { id: T1, title: 'x' },
  'POST /api/v1/myte/threads/{thread_id}/messages': { items: [{ id: 'u1' }, { id: 'a1' }] },
  ...over,
});

const ask = (over: Partial<AskRequest> = {}): AskRequest => ({ question: 'What did we decide?', scope: ALL_SCOPE, page: null, timezone: 'Europe/London', ...over });

async function run(client: ApiClient, req: AskRequest, signal?: AbortSignal) {
  const events: StreamEvent[] = [];
  await runAskMyte({ api: client, newKey: () => 'k' }, req, (e) => events.push(e), signal);
  return events;
}

describe('runAskMyte (the web route, on the device)', () => {
  it('streams across split chunks and CRLF, ignores unknown events, then stores the turn with one key', async () => {
    const text =
      wire(
        { event: 'step', data: { id: 's1', label: 'Looking through your meetings', state: 'running' } },
        { event: 'source', data: { n: 1, kind: 'decision', title: 'Ship on Friday', text: 'Ship on Friday', meeting_id: M } },
      ) +
      'event: mystery\r\ndata: {"x":1}\r\n\r\n: keep-alive\r\n' +
      wire({ event: 'delta', data: { text: 'We ship on Friday [1].' } }, { event: 'title', data: { text: 'Ship date' } }, DONE);
    // Cut the wire at awkward places, including inside a CRLF pair.
    const chunks = [text.slice(0, 7), text.slice(7, 61), text.slice(61, 130), text.slice(130)];
    const f = fakeClient(baseTable(), () => sse(200, sseBody(chunks)));

    const events = await run(f.client, ask());

    expect(events.map((e) => e.event)).toEqual(['step', 'source', 'delta', 'title', 'done', 'saved']);
    expect(events[events.length - 1]).toEqual({ event: 'saved', data: { thread_id: T1, message_ids: ['u1', 'a1'] } });

    // The stream: the shared upstream body, with persona and memories, and no org id anywhere.
    expect(f.streamed).toHaveLength(1);
    expect(f.streamed[0].path).toBe('/api/rag/myte');
    const body = f.streamed[0].body as Record<string, unknown>;
    expect(body).toMatchObject({
      question: 'What did we decide?',
      history: [],
      persona: { name: "Maya's Myte", personality: 'concise', instructions: 'Be brief.' },
      memories: [{ id: 'mem1', text: 'I lead the backend team.' }],
      want_title: true,
      timezone: 'Europe/London',
      mode: 'ask',
    });
    expect(JSON.stringify(body)).not.toMatch(/org/i);

    // The save: thread titled from the stream, then the turn, `${key}-thread` / `${key}-messages`.
    const writes = f.calls.filter((c) => c.key.startsWith('POST'));
    expect(writes.map((c) => [c.key, c.opts.idempotencyKey])).toEqual([
      ['POST /api/v1/myte/threads', 'k-thread'],
      ['POST /api/v1/myte/threads/{thread_id}/messages', 'k-messages'],
    ]);
    expect(writes[0].opts.freshToken).toBe(true);
    // Bounded as the web route's gatewayJson: 15 s per write, 6 s per read before the stream.
    expect(writes.map((c) => c.opts.timeoutMs)).toEqual([15_000, 15_000]);
    expect(f.calls.filter((c) => c.key.startsWith('GET')).map((c) => [c.key, c.opts.timeoutMs])).toEqual([
      ['GET /users/me', 6000],
      ['GET /api/v1/myte/memories', 6000],
    ]);
    expect(writes[0].opts.body).toEqual({ title: 'Ship date', scope: { kind: 'all', meeting_id: null, person_id: null, as_of: null } });
    expect(writes[1].opts.path).toEqual({ thread_id: T1 });
    const stored = (writes[1].opts.body as { messages: { role: string; content: string; payload: Record<string, unknown> }[] }).messages;
    expect(stored.map((m) => [m.role, m.content])).toEqual([
      ['user', 'What did we decide?'],
      ['myte', 'We ship on Friday [1].'],
    ]);
    expect(stored[1].payload).toMatchObject({ abstained: false, degraded: false, sources: [{ n: 1 }] });
    expect(JSON.stringify(f.calls.map((c) => c.opts))).not.toMatch(/org_id/);
  });

  it('reads a stored thread (its last 12 turns) and appends to it without creating one', async () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, thread_id: T1, role: i % 2 ? 'myte' : 'user', content: `turn ${i}`, payload: null, feedback: 0, feedback_reason: null, created_at: '' }));
    const f = fakeClient(baseTable({ 'GET /api/v1/myte/threads/{thread_id}': { id: T1, title: 't', messages } }), () => sse(200, sseBody([wire(DONE)])));
    const events = await run(f.client, ask({ thread_id: T1, history: [{ role: 'user', content: 'ignored' }] }));
    const body = f.streamed[0].body as { history: { content: string }[]; want_title: boolean };
    expect(body.history).toHaveLength(12);
    expect(body.history[11].content).toBe('turn 19');
    expect(body.want_title).toBe(false);
    expect(f.calls.map((c) => c.key)).not.toContain('POST /api/v1/myte/threads');
    expect(events[events.length - 1]).toMatchObject({ event: 'saved', data: { thread_id: T1 } });
  });

  it('a thread deleted elsewhere (404) starts a new one with no history', async () => {
    const f = fakeClient(baseTable({ 'GET /api/v1/myte/threads/{thread_id}': new ApiError(404, 'NOT_FOUND', 'gone') }), () => sse(200, sseBody([wire(DONE)])));
    await run(f.client, ask({ thread_id: T1, question: 'Where were we?' }));
    expect((f.streamed[0].body as { history: unknown[] }).history).toEqual([]);
    const create = f.calls.find((c) => c.key === 'POST /api/v1/myte/threads');
    expect(create?.opts.body).toMatchObject({ title: 'Where were we?' });
  });

  it('sends at most 30 memories, and none when they cannot be read; a failed profile uses the defaults', async () => {
    const many = { items: Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, text: `fact ${i}` })) };
    const f1 = fakeClient(baseTable({ 'GET /api/v1/myte/memories': many }), () => sse(200, sseBody([wire(DONE)])));
    await run(f1.client, ask());
    expect((f1.streamed[0].body as { memories: unknown[] }).memories).toHaveLength(30);

    const f2 = fakeClient(
      baseTable({ 'GET /api/v1/myte/memories': new ApiError(500, 'INTERNAL', 'x'), 'GET /users/me': new ApiError(0, 'DEPENDENCY_UNAVAILABLE', 'x') }),
      () => sse(200, sseBody([wire(DONE)])),
    );
    await run(f2.client, ask());
    expect(f2.streamed[0].body).toMatchObject({ memories: [], persona: { name: 'Your Myte', personality: 'balanced', instructions: null } });
  });

  it('retries the save once with the SAME key on a 5xx or a network error', async () => {
    let n = 0;
    const append = jest.fn(() => {
      n += 1;
      return n === 1 ? new ApiError(0, 'DEPENDENCY_UNAVAILABLE', 'offline') : { items: [{ id: 'u1' }, { id: 'a1' }] };
    });
    const f = fakeClient(baseTable({ 'POST /api/v1/myte/threads/{thread_id}/messages': append }), () => sse(200, sseBody([wire(DONE)])));
    const events = await run(f.client, ask());
    const saves = f.calls.filter((c) => c.key.endsWith('/messages'));
    expect(saves.map((c) => c.opts.idempotencyKey)).toEqual(['k-messages', 'k-messages']);
    expect(saves[1].opts.freshToken).toBe(true);
    expect(events[events.length - 1].event).toBe('saved');
  });

  it('says unsaved when the save fails twice, and never retries a 4xx', async () => {
    const f1 = fakeClient(baseTable({ 'POST /api/v1/myte/threads/{thread_id}/messages': new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'x') }), () => sse(200, sseBody([wire(DONE)])));
    const e1 = await run(f1.client, ask());
    expect(f1.calls.filter((c) => c.key.endsWith('/messages'))).toHaveLength(2);
    expect(e1[e1.length - 1]).toEqual({ event: 'unsaved', data: { message: "This answer couldn't be saved to your history." } });

    const f2 = fakeClient(baseTable({ 'POST /api/v1/myte/threads/{thread_id}/messages': new ApiError(422, 'VALIDATION_FAILED', 'x') }), () => sse(200, sseBody([wire(DONE)])));
    const e2 = await run(f2.client, ask());
    expect(f2.calls.filter((c) => c.key.endsWith('/messages'))).toHaveLength(1);
    expect(e2[e2.length - 1].event).toBe('unsaved');
  });

  it('a save that times out (a network failure) is retried once with the same key, then unsaved', async () => {
    const stalled = new ApiError(0, 'DEPENDENCY_UNAVAILABLE', 'The server could not be reached');
    const f = fakeClient(baseTable({ 'POST /api/v1/myte/threads/{thread_id}/messages': stalled }), () => sse(200, sseBody([wire(DONE)])));
    const events = await run(f.client, ask());
    const saves = f.calls.filter((c) => c.key.endsWith('/messages'));
    expect(saves.map((c) => [c.opts.idempotencyKey, c.opts.timeoutMs])).toEqual([
      ['k-messages', 15_000],
      ['k-messages', 15_000],
    ]);
    expect(events[events.length - 1].event).toBe('unsaved');
  });

  it('a new thread that cannot be created is unsaved, and nothing is appended', async () => {
    const f = fakeClient(baseTable({ 'POST /api/v1/myte/threads': new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'x') }), () => sse(200, sseBody([wire(DONE)])));
    const events = await run(f.client, ask());
    expect(f.calls.filter((c) => c.key.startsWith('POST')).map((c) => c.key)).toEqual(['POST /api/v1/myte/threads']);
    expect(events.map((e) => e.event)).toEqual(['done', 'unsaved']);
  });

  it('an answer still running at the outer bound (ANSWER_TIMEOUT_MS) is unavailable, and is not stored', async () => {
    expect(ANSWER_TIMEOUT_MS).toBe(120_000);
    jest.useFakeTimers();
    try {
      let upstreamSignal: AbortSignal | undefined;
      const f = fakeClient(baseTable(), (_body, signal) => {
        upstreamSignal = signal;
        return sse(200, sseBody([wire({ event: 'delta', data: { text: 'Still going' } })], { hang: true, signal }));
      });
      const events: StreamEvent[] = [];
      const done = runAskMyte({ api: f.client, newKey: () => 'k' }, ask(), (e) => events.push(e));
      await jest.advanceTimersByTimeAsync(ANSWER_TIMEOUT_MS - 1);
      expect(upstreamSignal?.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await done;
      expect(upstreamSignal?.aborted).toBe(true);
      expect(events.map((e) => e.event)).toEqual(['delta', 'error']);
      expect(events[1]).toEqual({ event: 'error', data: { reason: 'unavailable', message: '' } });
      expect(f.calls.filter((c) => c.key.startsWith('POST'))).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('Stop aborts the stream: nothing more is said and nothing is stored', async () => {
    const stop = new AbortController();
    let upstreamSignal: AbortSignal | undefined;
    const f = fakeClient(baseTable(), (_body, signal) => {
      upstreamSignal = signal;
      return sse(200, sseBody([wire({ event: 'delta', data: { text: 'So far' } })], { hang: true, signal }));
    });
    const events: StreamEvent[] = [];
    const done = runAskMyte({ api: f.client, newKey: () => 'k' }, ask(), (e) => {
      events.push(e);
      if (e.event === 'delta') stop.abort();
    }, stop.signal);
    await done;
    expect(upstreamSignal?.aborted).toBe(true);
    expect(events.map((e) => e.event)).toEqual(['delta']);
    expect(f.calls.filter((c) => c.key.startsWith('POST'))).toEqual([]);
  });

  it('a stream that ends without done or error is unavailable, and is not stored', async () => {
    const f = fakeClient(baseTable(), () => sse(200, sseBody([wire({ event: 'delta', data: { text: 'Half' } })])));
    const events = await run(f.client, ask());
    expect(events[events.length - 1]).toEqual({ event: 'error', data: { reason: 'unavailable', message: '' } });
    expect(f.calls.filter((c) => c.key.startsWith('POST'))).toEqual([]);
  });

  it('an upstream error event ends the answer without storing, and upstream saved events are ignored', async () => {
    const f = fakeClient(baseTable(), () =>
      sse(200, sseBody([wire({ event: 'saved', data: { thread_id: 'fake', message_ids: [] } }, { event: 'error', data: { reason: 'budget', message: 'Back on Dec 1' } })])),
    );
    const events = await run(f.client, ask());
    expect(events).toEqual([{ event: 'error', data: { reason: 'budget', message: 'Back on Dec 1' } }]);
    expect(f.calls.filter((c) => c.key.startsWith('POST'))).toEqual([]);
  });

  it.each([
    [402, 'application/problem+json', { code: 'QUOTA_EXCEEDED', detail: 'Back on Dec 1' }, { reason: 'budget', message: 'Back on Dec 1' }],
    [503, 'application/problem+json', { reason: 'ask_not_connected' }, { reason: 'not_connected', message: '' }],
    [404, 'text/html', null, { reason: 'not_connected', message: '' }],
    [401, 'application/problem+json', { code: 'TOKEN_EXPIRED' }, { reason: 'session', message: '' }],
    [200, 'application/json', {}, { reason: 'unavailable', message: '' }],
  ])('a %i %s answer becomes one error event', async (status, type, problem, expected) => {
    const f = fakeClient(baseTable(), () => sse(status, null, type, problem));
    expect(await run(f.client, ask())).toEqual([{ event: 'error', data: expected }]);
  });

  it('a network failure on the stream is unavailable; a bad question is invalid and calls nothing', async () => {
    const f1 = fakeClient(baseTable(), () => {
      throw new ApiError(0, 'DEPENDENCY_UNAVAILABLE', 'x');
    });
    expect(await run(f1.client, ask())).toEqual([{ event: 'error', data: { reason: 'unavailable', message: '' } }]);

    const f2 = fakeClient(baseTable(), () => sse(200, sseBody([wire(DONE)])));
    const e2 = await run(f2.client, ask({ question: '   ' }));
    expect(e2).toEqual([{ event: 'error', data: { reason: 'invalid', message: 'Type a question first.' } }]);
    expect(f2.calls).toEqual([]);
    expect(f2.streamed).toEqual([]);
  });

  it('drops a client-sent org_id from what goes upstream', async () => {
    const f = fakeClient(baseTable(), () => sse(200, sseBody([wire(DONE)])));
    await run(f.client, { ...ask(), org_id: 'org_evil' } as AskRequest);
    expect(JSON.stringify(f.streamed[0].body)).not.toMatch(/org/);
  });
});
