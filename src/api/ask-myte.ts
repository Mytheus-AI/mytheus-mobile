/**
 * Ask Myte on the device: the port of mytheus-ui `src/app/api/ask-myte/route.ts` (main @ 093129f).
 * Change both together.
 *
 * The web runs these steps in a Next.js route between the browser and rag-service. The phone has
 * no server of its own, so it runs the same steps itself, through the same gateway, with the same
 * keys and fallbacks (system.md N-entry "Ask Myte orchestration runs on the device"):
 *
 * 1. Checks the question with the shared `checkAskBody` (1..2000 characters, a clean scope; an
 *    `org_id` or anything else unknown is dropped, and none is ever added).
 * 2. In parallel: the thread's last 12 messages when it has a `thread_id` (a thread deleted
 *    elsewhere, 404, starts a new one), the Myte persona from `GET /users/me` (tone only; a failed
 *    read uses the defaults), and up to 30 memories (a failed read sends none).
 * 3. Streams `POST /api/rag/myte` with a freshly minted token (`ApiClient.stream`) and hands every
 *    event on as it arrives, while folding them through the shared reducer to build what it stores.
 *    A non-stream answer is read as an RFC 7807 problem and becomes a D8 `error` event, so the
 *    screen has one failure path. A stream that ends without `done` or `error` is `unavailable`.
 * 4. On `done` only: creates the thread if it is new (titled from the `title` event, else the
 *    question) and appends the question and the answer, with ANOTHER fresh token and ONE base
 *    Idempotency-Key per answer (`${key}-thread`, `${key}-messages`); the append is retried once on
 *    a network error, a timeout or a 5xx with the same key. Each write gives up after 15 s and each
 *    read before the stream after 6 s, as the web route's `gatewayJson`. Then a synthetic `saved`
 *    {thread_id, message_ids}, or `unsaved` when storing failed (the answer still stands on screen).
 * 5. Stop (`signal`) aborts the upstream request; nothing is stored for a stopped answer, and no
 *    event reaches the caller after it stopped listening. An outer 120 s bound ends a stuck answer.
 *
 * What this does not send (Phase A): `mode: peer_answer`, `peer`, `channel: voice`, `attachments`,
 * `thread_title`. No React, no storage: the caller keeps the answer in memory only.
 */

import { ApiError, newIdempotencyKey, type ApiClient } from './client';
import { ASK_MYTE_STREAM, endpoints, type AppendMyteMessagesBody } from './endpoints';
import { agentDisplayName, asPersonality } from '@/lib/ask-myte/persona';
import { fallbackTitle, historyFrom, newAnswer, reduceAnswer, titleFrom, toPayload, type Answer } from '@/lib/ask-myte/reducer';
import { createSseParser } from '@/lib/ask-myte/sse';
import { checkAskBody, memoriesFor, upstreamBody, upstreamError, type CheckedAsk } from '@/lib/ask-myte/upstream';
import type { AskRequest, ErrorEvent, HistoryItem, MemoryRef, Persona, StoredMessage, StreamEvent } from '@/lib/ask-myte/types';

/** rag-service gives up at 8 rounds and 45 s of tool time; this bounds the whole answer. */
export const ANSWER_TIMEOUT_MS = 120_000;
/** The web route's `gatewayJson` bounds: 6 s for each read before the stream, 15 s for each save
    write. A write that times out reads as a network failure (status 0): one same-key retry, then
    `unsaved`, so a stalled save never holds the composer. */
export const READ_TIMEOUT_MS = 6000;
export const WRITE_TIMEOUT_MS = 15_000;

export interface AskMyteDeps {
  api: ApiClient;
  now?: () => number;
  newKey?: () => string;
  timeoutMs?: number;
}

const statusOf = (err: unknown): number | undefined => (err instanceof ApiError ? err.status : undefined);

async function loadHistory(api: ApiClient, ask: CheckedAsk): Promise<{ threadId: string | null; history: HistoryItem[] }> {
  if (!ask.threadId) return { threadId: null, history: ask.history };
  try {
    const thread = await endpoints.myteThread(api, ask.threadId, READ_TIMEOUT_MS);
    const messages = (Array.isArray(thread?.messages) ? thread.messages : []) as unknown as StoredMessage[];
    return { threadId: ask.threadId, history: historyFrom(messages) };
  } catch (err) {
    // A thread that is gone (deleted on another device) starts a new one rather than failing.
    if (statusOf(err) === 404) return { threadId: null, history: [] };
    throw err;
  }
}

async function loadPersona(api: ApiClient): Promise<Persona> {
  const profile = await endpoints.me(api, READ_TIMEOUT_MS).catch(() => null);
  return {
    name: agentDisplayName(profile?.agent_name ?? null, profile?.display_name ?? ''),
    personality: asPersonality(profile?.agent_personality),
    instructions: profile?.agent_instructions?.trim() ? profile.agent_instructions.trim().slice(0, 1000) : null,
  };
}

/** ADR-0049 F4: up to 30 of the person's memories go with every ask. A failed read sends none. */
async function loadMemories(api: ApiClient): Promise<MemoryRef[]> {
  try {
    return memoriesFor(await endpoints.myteMemories(api, READ_TIMEOUT_MS));
  } catch {
    return [];
  }
}

async function persist(
  api: ApiClient,
  ask: CheckedAsk,
  threadId: string | null,
  answer: Answer,
  events: StreamEvent[],
  key: string,
): Promise<{ thread_id: string; message_ids: string[] }> {
  let id = threadId;
  // The first write mints a new token (the stream's may be near its minute); a TOKEN_EXPIRED
  // later is retried by the client with another.
  let fresh = true;
  if (!id) {
    const created = await endpoints.createMyteThread(
      api,
      { title: ask.threadTitle ?? titleFrom(events) ?? fallbackTitle(ask.question), scope: ask.scope },
      `${key}-thread`,
      { freshToken: true, timeoutMs: WRITE_TIMEOUT_MS },
    );
    id = created.id;
    fresh = false;
  }
  const body = {
    messages: [
      {
        role: 'user',
        content: ask.question,
        // Attachments are not stored beyond their names (ADR-0049 F7); Phase A sends none.
        payload: {
          scope: { ...ask.scope, label: ask.scopeLabel },
          page: ask.page,
          ...(ask.attachments.length ? { attachments: ask.attachments.map((a) => a.name) } : {}),
        },
      },
      { role: 'myte', content: answer.text, payload: toPayload(answer) },
    ],
  } as unknown as AppendMyteMessagesBody;
  // One retry on a network failure or a 5xx, with the same key, so a blip never stores it twice.
  let saved: { items: { id: string }[] } | null = null;
  for (let attempt = 0; attempt < 2 && !saved; attempt++) {
    try {
      saved = await endpoints.appendMyteMessages(api, id, body, `${key}-messages`, {
        freshToken: fresh || attempt > 0,
        timeoutMs: WRITE_TIMEOUT_MS,
      });
    } catch (err) {
      const status = statusOf(err);
      if (attempt === 1 || (status !== undefined && status !== 0 && status < 500)) throw err;
    }
  }
  return { thread_id: id, message_ids: (saved?.items ?? []).map((m) => m.id).filter((x) => typeof x === 'string') };
}

/**
 * Ask one question and stream its answer to `onEvent`. Resolves when the answer is settled (and
 * stored, or not), or silently once `signal` aborts. Never throws: every failure is an `error`.
 */
export async function runAskMyte(
  deps: AskMyteDeps,
  request: AskRequest,
  onEvent: (ev: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { api } = deps;
  const now = deps.now ?? Date.now;
  const listening = () => !signal?.aborted;
  // After Stop (or a new chat) the caller hears nothing more, as a browser that left the page.
  const send = (ev: StreamEvent) => {
    if (listening()) onEvent(ev);
  };
  const fail = (err: ErrorEvent) => send({ event: 'error', data: err });

  const checked = checkAskBody(request);
  if (!checked.ok) {
    fail({ reason: 'invalid', message: checked.message });
    return;
  }
  const ask = checked.value;
  if (!listening()) return;

  const upstreamAbort = new AbortController();
  const onStop = () => upstreamAbort.abort();
  signal?.addEventListener('abort', onStop);
  const timeout = setTimeout(() => upstreamAbort.abort(), deps.timeoutMs ?? ANSWER_TIMEOUT_MS);
  // One base key per answer: `-thread` and `-messages` derive from it, as on the web.
  const key = (deps.newKey ?? newIdempotencyKey)();

  try {
    const [{ threadId, history }, persona, memories] = await Promise.all([loadHistory(api, ask), loadPersona(api), loadMemories(api)]);
    if (!listening()) return;

    const upstream = await api.stream(ASK_MYTE_STREAM, upstreamBody(ask, persona, history, memories), upstreamAbort.signal);
    const type = upstream.headers.get('content-type') ?? '';
    if (!upstream.ok || !type.includes('text/event-stream') || !upstream.body) {
      let problem: { reason?: unknown; code?: unknown; detail?: unknown } | null = null;
      try {
        problem = (await upstream.json()) as typeof problem;
      } catch {
        problem = null;
      }
      fail(upstreamError(upstream.ok ? 502 : upstream.status, problem));
      return;
    }

    const parser = createSseParser();
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();
    const events: StreamEvent[] = [];
    let answer = newAnswer(key, now());
    let settled = false;

    const take = (evs: StreamEvent[]) => {
      for (const ev of evs) {
        if (settled) continue;
        // `saved`/`unsaved` are this module's own; an upstream that sent them is ignored.
        if (ev.event === 'saved' || ev.event === 'unsaved') continue;
        events.push(ev);
        answer = reduceAnswer(answer, ev, now());
        send(ev);
        if (ev.event === 'done' || ev.event === 'error') settled = true;
      }
    };

    for (;;) {
      if (!listening()) break;
      const { done, value } = await reader.read();
      if (done) break;
      take(parser.feed(decoder.decode(value, { stream: true })));
      if (settled) break;
    }
    if (!listening() && !settled) {
      // Stopped mid-answer: nobody is listening, and nothing is stored.
      reader.cancel().catch(() => undefined);
      return;
    }
    take(parser.feed(decoder.decode()));
    take(parser.end());
    reader.cancel().catch(() => undefined);

    if (!settled) {
      // The stream ended without `done` or `error`: rag-service went away mid-answer.
      fail({ reason: 'unavailable', message: '' });
      return;
    }
    if (answer.status !== 'done') return;

    try {
      const saved = await persist(api, ask, threadId, answer, events, key);
      send({ event: 'saved', data: saved });
    } catch {
      send({ event: 'unsaved', data: { message: "This answer couldn't be saved to your history." } });
    }
  } catch (err) {
    // The person stopped the answer: nothing is stored and nothing more is said.
    if (!listening()) return;
    if (upstreamAbort.signal.aborted) fail({ reason: 'unavailable', message: '' });
    else if (statusOf(err) === 401) fail({ reason: 'session', message: '' });
    else fail({ reason: 'unavailable', message: '' });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onStop);
  }
}
