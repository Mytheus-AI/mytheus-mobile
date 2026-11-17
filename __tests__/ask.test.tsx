import { mockFocus, mockRouter, mockSignOut, resetMocks } from './helpers/mocks';
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { fakeApi, renderWithApi, type Handler } from './helpers/render';
import Ask from '../app/(app)/(tabs)/ask';
import { ApiError, type StreamResponse } from '@/api/client';
import { encodeSse } from '@/lib/ask-myte/sse';
import type { StreamEvent } from '@/lib/ask-myte/types';

const M = '0b6a3c43-2f5d-4f4b-9a8e-0a1b2c3d4e5f';
const D = '5d2e8f10-7a1b-4c3d-9e8f-0a1b2c3d4e5f';
const T1 = '11111111-1111-4111-8111-111111111111';

/** An upstream SSE body the test writes to as it goes; an abort errors it, as expo/fetch does. */
function liveStream() {
  let ctl!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      ctl = c;
    },
  });
  const signals: (AbortSignal | undefined)[] = [];
  return {
    respond(signal?: AbortSignal): StreamResponse {
      signals.push(signal);
      signal?.addEventListener('abort', () => ctl.error(new Error('aborted')));
      return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, body, json: async () => ({}) };
    },
    send: (...evs: StreamEvent[]) => act(async () => ctl.enqueue(new TextEncoder().encode(evs.map(encodeSse).join('')))),
    signals,
  };
}

function setup(table: Record<string, Handler | unknown>, stream: (signal?: AbortSignal) => StreamResponse) {
  const api = fakeApi({
    'GET /api/v1/meetings': { items: [] },
    'GET /users/me': { agent_name: 'Pip', display_name: 'Maya Rao', agent_personality: 'balanced', agent_instructions: null },
    'GET /api/v1/myte/memories': { items: [] },
    ...table,
  });
  const streamed: unknown[] = [];
  Object.assign(api.client, {
    stream: async (_path: string, body: unknown, signal?: AbortSignal) => {
      streamed.push(body);
      return stream(signal);
    },
  });
  renderWithApi(<Ask />, api.client);
  return { ...api, streamed };
}

beforeEach(() => resetMocks());

describe('Ask Myte', () => {
  it('shows the answer as it streams, then its sources, and keeps the conversation', async () => {
    const live = liveStream();
    const append = jest.fn(() => ({ items: [{ id: 'u1' }, { id: 'a1' }] }));
    const api = setup(
      { 'POST /api/v1/myte/threads': { id: T1, title: 'Ship date' }, 'POST /api/v1/myte/threads/{thread_id}/messages': append },
      (signal) => live.respond(signal),
    );

    fireEvent.changeText(screen.getByLabelText('Your question'), 'When do we ship?');
    fireEvent.press(screen.getByLabelText('Ask'));
    await waitFor(() => expect(api.streamed).toHaveLength(1));
    expect(api.streamed[0]).toMatchObject({ question: 'When do we ship?', scope: { kind: 'all' }, persona: { name: 'Pip' } });

    await live.send({ event: 'step', data: { id: 's1', label: 'Checking your decisions', state: 'running' } });
    expect(await screen.findByText('Checking your decisions')).toBeTruthy();
    expect(screen.getByLabelText('Stop')).toBeTruthy();

    await live.send({ event: 'source', data: { n: 1, kind: 'decision', title: 'Ship on Friday', text: 'We agreed to ship on Friday.', meeting_id: M, decision_id: D } });
    await live.send({ event: 'delta', data: { text: 'We ship on' } });
    expect(await screen.findByText(/We ship on/)).toBeTruthy();
    await live.send({ event: 'delta', data: { text: ' Friday [1].' } });
    expect(await screen.findByText(/We ship on Friday/)).toBeTruthy();

    await live.send(
      { event: 'followups', data: { items: ['Who owns the launch?'] } },
      { event: 'title', data: { text: 'Ship date' } },
      { event: 'done', data: { abstained: false, degraded: false, cited: [1] } },
    );
    await waitFor(() => expect(append).toHaveBeenCalledTimes(1));
    const save = api.calls.find((c) => c.key === 'POST /api/v1/myte/threads/{thread_id}/messages');
    expect((save?.opts as { idempotencyKey?: string }).idempotencyKey).toMatch(/-messages$/);
    expect(await screen.findByText('Ship date')).toBeTruthy();
    expect(screen.queryByLabelText('Stop')).toBeNull();

    // A source opens its screen in the app: the decision.
    fireEvent.press(screen.getByLabelText(/^Source 1\./));
    expect(mockRouter.push).toHaveBeenCalledWith(`/decisions/${D}`);
    expect(screen.getByLabelText('Ask: Who owns the launch?')).toBeTruthy();
  });

  it('Stop keeps what streamed, stores nothing, and offers Retry', async () => {
    const live = liveStream();
    const api = setup({}, (signal) => live.respond(signal));
    fireEvent.press(screen.getByLabelText('Ask: What did I agree to do this week?'));
    await waitFor(() => expect(api.streamed).toHaveLength(1));
    await live.send({ event: 'delta', data: { text: 'You agreed to' } });
    expect(await screen.findByText(/You agreed to/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Stop'));
    expect(await screen.findByText('Stopped.')).toBeTruthy();
    expect(live.signals[0]?.aborted).toBe(true);
    expect(screen.getByText(/You agreed to/)).toBeTruthy();
    expect(screen.getByLabelText('Retry')).toBeTruthy();
    expect(api.calls.filter((c) => c.key.startsWith('POST'))).toEqual([]);
  });

  it('says plainly when the workspace is out of AI budget', async () => {
    setup({}, () => ({ ok: false, status: 402, headers: { get: () => 'application/problem+json' }, body: null, json: async () => ({ code: 'QUOTA_EXCEEDED' }) }));
    fireEvent.press(screen.getByLabelText('Ask: What was decided in my last meeting?'));
    expect(await screen.findByText('Your workspace reached its AI limit.')).toBeTruthy();
    expect(screen.queryByLabelText('Retry')).toBeNull();
  });

  it('lays the text out as the web does: bold, lists, and a marker with no source dropped', async () => {
    const live = liveStream();
    setup({ 'POST /api/v1/myte/threads': { id: T1, title: 't' }, 'POST /api/v1/myte/threads/{thread_id}/messages': { items: [] } }, (signal) => live.respond(signal));
    fireEvent.press(screen.getByLabelText('Ask: What did I agree to do this week?'));
    await waitFor(() => expect(screen.getByLabelText('Stop')).toBeTruthy());
    await live.send(
      { event: 'source', data: { n: 1, kind: 'decision', title: 'Ship on Friday', text: 'Ship on Friday', meeting_id: M } },
      { event: 'delta', data: { text: 'You agreed to ship on **Friday** [1] and [3].\n\n- Write the notes [1]\n- Book the room\n\n1) First\n2) Second' } },
      { event: 'done', data: { abstained: false, degraded: false, cited: [1] } },
    );
    expect(await screen.findByText('Friday')).toBeTruthy();
    expect(screen.queryByText(/\*\*/)).toBeNull();
    // [1] has a source and is drawn as a marker; [3] has none and is gone.
    expect(screen.getAllByLabelText('source 1')).toHaveLength(2);
    expect(screen.queryByText(/\[3\]/)).toBeNull();
    expect(screen.getByText('Book the room')).toBeTruthy();
    // The list marks are drawn but hidden from screen readers, as the web's ::marker is.
    expect(screen.getAllByText('•', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('2.', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText(/^- /)).toBeNull();
  });

  it('shows "Nothing found" for an abstained answer, and says when it could not be saved', async () => {
    const live = liveStream();
    setup(
      { 'POST /api/v1/myte/threads': { id: T1, title: 't' }, 'POST /api/v1/myte/threads/{thread_id}/messages': new ApiError(422, 'VALIDATION_FAILED', 'x') },
      (signal) => live.respond(signal),
    );
    fireEvent.press(screen.getByLabelText('Ask: What did I agree to do this week?'));
    await waitFor(() => expect(screen.getByLabelText('Stop')).toBeTruthy());
    await live.send({ event: 'delta', data: { text: "I couldn't find that in your meetings." } }, { event: 'done', data: { abstained: true, degraded: false, cited: [] } });
    expect(await screen.findByText('Nothing found')).toBeTruthy();
    expect(await screen.findByText("This answer couldn't be saved to your history.")).toBeTruthy();
    // Send is free again: the save is over.
    fireEvent.changeText(screen.getByLabelText('Your question'), 'And next week?');
    expect(screen.getByLabelText('Ask').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('an expired session offers Sign in again, which signs out to the sign-in screen', async () => {
    setup({}, () => ({ ok: false, status: 401, headers: { get: () => 'application/problem+json' }, body: null, json: async () => ({ code: 'TOKEN_EXPIRED' }) }));
    fireEvent.press(screen.getByLabelText('Ask: What did I agree to do this week?'));
    expect(await screen.findByText('Your session expired.')).toBeTruthy();
    expect(screen.queryByLabelText('Retry')).toBeNull();
    fireEvent.press(screen.getByLabelText('Sign in again'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  });

  it('leaving the tab stops an answer still being written, and stores nothing', async () => {
    const live = liveStream();
    const api = setup({}, (signal) => live.respond(signal));
    fireEvent.press(screen.getByLabelText('Ask: What did I agree to do this week?'));
    await waitFor(() => expect(api.streamed).toHaveLength(1));
    await live.send({ event: 'delta', data: { text: 'You agreed to' } });
    expect(await screen.findByText(/You agreed to/)).toBeTruthy();

    await act(async () => mockFocus.blur());
    expect(await screen.findByText('Stopped.')).toBeTruthy();
    expect(live.signals[0]?.aborted).toBe(true);
    expect(api.calls.filter((c) => c.key.startsWith('POST'))).toEqual([]);
  });

  it('leaving the tab after the answer is done lets its save finish', async () => {
    const live = liveStream();
    let release!: (v: unknown) => void;
    const pending = new Promise((r) => {
      release = r;
    });
    const api = setup(
      { 'POST /api/v1/myte/threads': { id: T1, title: 't' }, 'POST /api/v1/myte/threads/{thread_id}/messages': () => pending },
      (signal) => live.respond(signal),
    );
    fireEvent.press(screen.getByLabelText('Ask: What did I agree to do this week?'));
    await waitFor(() => expect(api.streamed).toHaveLength(1));
    await live.send(
      { event: 'delta', data: { text: 'Done answer.' } },
      { event: 'title', data: { text: 'This week' } },
      { event: 'done', data: { abstained: false, degraded: false, cited: [] } },
    );
    await waitFor(() => expect(api.calls.some((c) => c.key.endsWith('/messages'))).toBe(true));

    await act(async () => mockFocus.blur());
    await act(async () => release({ items: [{ id: 'u1' }, { id: 'a1' }] }));
    expect(await screen.findByText('This week')).toBeTruthy();
    expect(screen.queryByText('Stopped.')).toBeNull();
  });

  it('deleting a conversation that is already gone (404) is done: the row goes and it closes', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const listed = { id: T1, title: 'Ship date', pinned: false, created_at: '2026-11-10T10:00:00Z', last_message_at: '2026-11-10T10:00:00Z' };
    let list = [listed];
    setup(
      {
        'GET /api/v1/myte/threads': () => ({ items: list, next_cursor: null }),
        'GET /api/v1/myte/threads/{thread_id}': {
          id: T1,
          title: 'Ship date',
          pinned: false,
          messages: [
            { id: 'u1', thread_id: T1, role: 'user', content: 'When do we ship?', payload: null, feedback: 0, created_at: '' },
            { id: 'a1', thread_id: T1, role: 'myte', content: 'On Friday.', payload: { sources: [] }, feedback: 0, created_at: '' },
          ],
        },
        // Deleted on another device: the server no longer has it.
        'DELETE /api/v1/myte/threads/{thread_id}': () => {
          list = [];
          return new ApiError(404, 'NOT_FOUND', 'gone');
        },
      },
      () => {
        throw new Error('no stream expected');
      },
    );
    fireEvent.press(screen.getByLabelText('History'));
    fireEvent.press(await screen.findByLabelText('Open conversation: Ship date'));
    expect(await screen.findByText('On Friday.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('History'));
    fireEvent.press(await screen.findByLabelText('Delete conversation: Ship date'));
    expect(await screen.findByText('Conversation deleted')).toBeTruthy();
    expect(screen.queryByText("That conversation couldn't be deleted.")).toBeNull();
    await waitFor(() => expect(screen.queryByText('On Friday.')).toBeNull());
    await waitFor(() => expect(screen.queryByLabelText('Open conversation: Ship date')).toBeNull());
    alert.mockRestore();
  });

  it('opens a past conversation from History, and deletes one after a confirm', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const del = jest.fn(() => undefined);
    const api = setup(
      {
        'GET /api/v1/myte/threads': {
          items: [
            { id: T1, title: 'Ship date', pinned: true, created_at: '2026-11-10T10:00:00Z', last_message_at: '2026-11-10T10:00:00Z' },
            { id: 'old', title: 'Hiring plan', pinned: false, created_at: '2026-11-01T10:00:00Z', last_message_at: '2026-11-01T10:00:00Z' },
          ],
          next_cursor: null,
        },
        'GET /api/v1/myte/threads/{thread_id}': {
          id: T1,
          title: 'Ship date',
          pinned: true,
          messages: [
            { id: 'u1', thread_id: T1, role: 'user', content: 'When do we ship?', payload: { scope: { kind: 'all' } }, feedback: 0, created_at: '' },
            { id: 'a1', thread_id: T1, role: 'myte', content: 'On Friday.', payload: { sources: [] }, feedback: 0, created_at: '' },
          ],
        },
        'DELETE /api/v1/myte/threads/{thread_id}': del,
      },
      () => {
        throw new Error('no stream expected');
      },
    );

    fireEvent.press(screen.getByLabelText('History'));
    fireEvent.press(await screen.findByLabelText('Open conversation: Ship date'));
    expect(await screen.findByText('On Friday.')).toBeTruthy();
    expect(screen.getByText('When do we ship?')).toBeTruthy();
    expect(api.calls.find((c) => c.key === 'GET /api/v1/myte/threads/{thread_id}')?.opts.path).toEqual({ thread_id: T1 });

    fireEvent.press(screen.getByLabelText('History'));
    fireEvent.press(await screen.findByLabelText('Delete conversation: Ship date'));
    await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
    expect(api.calls.find((c) => c.key === 'DELETE /api/v1/myte/threads/{thread_id}')?.opts.path).toEqual({ thread_id: T1 });
    expect(await screen.findByText('Conversation deleted')).toBeTruthy();
    // The open conversation was the deleted one: it is closed.
    await waitFor(() => expect(screen.queryByText('On Friday.')).toBeNull());
    alert.mockRestore();
  });
});
