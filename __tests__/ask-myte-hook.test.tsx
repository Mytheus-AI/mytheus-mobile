/* useAskMyte across a workspace switch: the shell builds a new REST client per person and
   workspace (app/(app)/_layout.tsx), and the conversation built on the last one must go with it,
   running answer included. */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiProvider } from '@/api/ApiProvider';
import type { ApiClient, StreamResponse } from '@/api/client';
import { useAskMyte } from '@/api/hooks/ask-myte';
import { encodeSse } from '@/lib/ask-myte/sse';
import { ALL_SCOPE } from '@/lib/ask-myte/types';

function client(name: string, signals: AbortSignal[]): ApiClient {
  const table: Record<string, unknown> = {
    'GET /users/me': { agent_name: name, display_name: 'Maya', agent_personality: 'balanced', agent_instructions: null },
    'GET /api/v1/myte/memories': { items: [] },
  };
  return {
    request: async (method: string, path: string) => table[`${method.toUpperCase()} ${path}`],
    requestBytes: async () => new ArrayBuffer(0),
    stream: async (_path: string, _body: unknown, signal?: AbortSignal): Promise<StreamResponse> => {
      if (signal) signals.push(signal);
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode(encodeSse({ event: 'delta', data: { text: 'Partly' } })));
          signal?.addEventListener('abort', () => c.error(new Error('aborted')));
        },
      });
      return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, body, json: async () => ({}) };
    },
  } as unknown as ApiClient;
}

describe('useAskMyte', () => {
  it('drops the conversation, and stops its running answer, when the client is rebuilt (a workspace switch)', async () => {
    const signals: AbortSignal[] = [];
    const qc = new QueryClient();
    let api = client('Acme Myte', signals);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>
        <ApiProvider client={api}>{children}</ApiProvider>
      </QueryClientProvider>
    );
    const { result, rerender } = renderHook(() => useAskMyte(), { wrapper });

    act(() => result.current.send('What changed?', ALL_SCOPE));
    await waitFor(() => expect(result.current.messages.some((m) => m.role === 'myte' && m.text === 'Partly')).toBe(true));
    expect(result.current.busy).toBe(true);

    // The same client on a new render: nothing changes.
    rerender({});
    expect(result.current.messages).toHaveLength(2);

    api = client('Globex Myte', signals);
    rerender({});
    await waitFor(() => expect(result.current.messages).toEqual([]));
    expect(result.current.threadId).toBeNull();
    expect(result.current.title).toBeNull();
    expect(result.current.busy).toBe(false);
    expect(signals[0].aborted).toBe(true);
  });
});
