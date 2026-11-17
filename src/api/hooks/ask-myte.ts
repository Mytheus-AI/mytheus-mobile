import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../ApiProvider';
import { runAskMyte } from '../ask-myte';
import { ApiError } from '../client';
import { endpoints } from '../endpoints';
import { qk } from '../queryKeys';
import {
  failAnswer,
  fromStored,
  historyFrom,
  newAnswer,
  reduceAnswer,
  stopAnswer,
  type Answer,
  type Message,
  type Question,
} from '@/lib/ask-myte/reducer';
import type { AskPage, AskScope, StreamEvent, Thread } from '@/lib/ask-myte/types';

/* One Ask Myte conversation on the phone: a trimmed port of mytheus-ui
   `src/components/ask-myte/useAskMyte.ts` (main @ 093129f) over `runAskMyte` instead of the web's
   `/api/ask-myte` route. Change both together.

   - The conversation lives in React state only, and threads in the in-memory query cache: no
     AsyncStorage, nothing on disk (CLAUDE.md: no meeting content at rest).
   - Stop aborts the stream and keeps what streamed; nothing is stored for a stopped answer.
   - One answer runs at a time. Unmounting stops it. Ask is a tab and stays mounted across tab
     switches and a pushed source screen, so the screen stops a still-streaming answer when it
     loses focus (app/(app)/(tabs)/ask.tsx), as the web stops it on a route change.
   - Not ported in Phase A: proposal marks and their stored states, feedback, voice, attachments. */

let seq = 0;
const nextKey = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** The device's IANA zone, which sets "today" for the Myte (null when the runtime cannot say). */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** A thread as core-api returns it (`MyteThreadDetail`), read as the shared Thread shape. */
type ThreadDetail = Awaited<ReturnType<typeof endpoints.myteThread>>;
export const asThread = (detail: ThreadDetail): Thread => detail as unknown as Thread;

export interface AskMyteState {
  threadId: string | null;
  title: string | null;
  messages: Message[];
  /** an answer is being written (Stop shows) */
  streaming: boolean;
  /** an answer is running, including the save after it (Send waits) */
  busy: boolean;
  /** ticks once a second while streaming, for the "Still looking" line */
  now: number;
  send: (question: string, scope: AskScope, page?: AskPage | null) => void;
  stop: () => void;
  retry: (answerKey: string) => void;
  reset: () => void;
  load: (thread: Thread | null) => void;
}

export function useAskMyte(): AskMyteState {
  const api = useApi();
  const queryClient = useQueryClient();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveKey, setLiveKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const abort = useRef<AbortController | null>(null);
  const live = useRef<string | null>(null);
  const threadRef = useRef(threadId);
  threadRef.current = threadId;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const busy = liveKey !== null;
  const liveAnswer = liveKey ? messages.find((m): m is Answer => m.role === 'myte' && m.key === liveKey) : undefined;
  const streaming = liveAnswer?.status === 'streaming';

  useEffect(() => {
    if (!streaming) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [streaming]);

  const patch = useCallback((key: string, fn: (a: Answer) => Answer) => {
    setMessages((list) => list.map((m) => (m.role === 'myte' && m.key === key ? fn(m) : m)));
  }, []);

  const finish = useCallback(() => {
    abort.current = null;
    live.current = null;
    setLiveKey(null);
  }, []);

  // Unmounting stops a running answer (losing focus is the screen's call, see above).
  useEffect(() => () => abort.current?.abort(), []);

  // A new REST client means a new session or workspace: the last one's conversation goes.
  const firstApi = useRef(api);
  useEffect(() => {
    if (firstApi.current === api) return;
    firstApi.current = api;
    abort.current?.abort();
    finish();
    setThreadId(null);
    setTitle(null);
    setMessages([]);
  }, [api, finish]);

  const run = useCallback(
    async (question: string, scope: AskScope, page: AskPage | null, base: Message[]) => {
      const q: Question = { key: nextKey('q'), role: 'user', id: null, text: question, scope: scope.kind === 'all' ? null : scope };
      const answer = newAnswer(nextKey('a'), Date.now());
      setMessages([...base, q, answer]);
      live.current = answer.key;
      setLiveKey(answer.key);

      const controller = new AbortController();
      abort.current = controller;
      let streamTitle: string | null = null;
      const apply = (ev: StreamEvent) => {
        if (ev.event === 'title') streamTitle = ev.data.text;
        if (ev.event === 'saved') {
          setThreadId(ev.data.thread_id);
          if (streamTitle) setTitle(streamTitle);
          void queryClient.invalidateQueries({ queryKey: qk.myteThreads });
          void queryClient.invalidateQueries({ queryKey: qk.myteThread(ev.data.thread_id) });
        }
        patch(answer.key, (a) => reduceAnswer(a, ev, Date.now()));
      };

      try {
        await runAskMyte(
          { api },
          {
            thread_id: threadRef.current,
            question,
            scope,
            page,
            history: threadRef.current ? undefined : historyFrom(base),
            timezone: deviceTimeZone(),
          },
          apply,
          controller.signal,
        );
        // A stream that closed without settling broke on the way (a no-op once settled).
        if (!controller.signal.aborted) patch(answer.key, (a) => failAnswer(a, 'unavailable'));
      } finally {
        if (abort.current === controller) finish();
      }
    },
    [api, queryClient, patch, finish],
  );

  const send = useCallback(
    (question: string, scope: AskScope, page: AskPage | null = null) => {
      const text = question.trim();
      if (!text || live.current) return;
      void run(text, scope, page, messagesRef.current);
    },
    [run],
  );

  const stop = useCallback(() => {
    const key = live.current;
    if (!key) return;
    abort.current?.abort();
    patch(key, stopAnswer);
    finish();
  }, [patch, finish]);

  const retry = useCallback(
    (answerKey: string) => {
      if (live.current) return;
      const list = messagesRef.current;
      const at = list.findIndex((m) => m.key === answerKey);
      const q = at > 0 ? list[at - 1] : null;
      if (!q || q.role !== 'user') return;
      const scope: AskScope = q.scope ?? { kind: 'all', meeting_id: null, person_id: null, as_of: null };
      void run(q.text, scope, null, [...list.slice(0, at - 1), ...list.slice(at + 1)]);
    },
    [run],
  );

  const reset = useCallback(() => {
    abort.current?.abort();
    finish();
    setThreadId(null);
    setTitle(null);
    setMessages([]);
  }, [finish]);

  const load = useCallback(
    (thread: Thread | null) => {
      abort.current?.abort();
      finish();
      setThreadId(thread?.id ?? null);
      setTitle(thread?.title ?? null);
      setMessages(thread ? thread.messages.map(fromStored) : []);
    },
    [finish],
  );

  return { threadId, title, messages, streaming, busy, now, send, stop, retry, reset, load };
}

/** Your Ask Myte conversations, pinned first then the most recent (the server's order). */
export function useMyteThreads(enabled = true) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: qk.myteThreads,
    queryFn: ({ pageParam }) => endpoints.myteThreads(api, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? null,
    enabled,
  });
}

/** Opens one conversation: read through the in-memory cache, as the shared Thread shape. */
export function useOpenMyteThread() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useCallback(
    async (id: string): Promise<Thread> =>
      asThread(await queryClient.fetchQuery({ queryKey: qk.myteThread(id), queryFn: () => endpoints.myteThread(api, id), staleTime: 0 })),
    [api, queryClient],
  );
}

/**
 * Deletes a conversation for good (`DELETE /api/v1/myte/threads/{id}`). No Idempotency-Key: the
 * client keys only POST/PATCH/PUT. A 404 (deleted on another device, or a repeated delete) is
 * success, as on the web (`deleteMyteThread`: "Already gone is what was asked for"), so the row
 * leaves the list and an open copy closes.
 */
export function useDeleteMyteThread() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await endpoints.deleteMyteThread(api, id);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) throw err;
      }
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: qk.myteThread(id) });
      void queryClient.invalidateQueries({ queryKey: qk.myteThreads });
    },
  });
}
