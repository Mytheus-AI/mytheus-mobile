/* The signed-in shell builds the one REST client. These pin what the screens below rely on:
   Ask Myte's stream reads through `expo/fetch` (whose body is a ReadableStream fed as bytes
   arrive; RN's global fetch buffers the whole body), every other call goes through the global
   fetch, and a workspace switch builds a new client (which drops an Ask Myte conversation). */
import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@/api/client';
import { ASK_MYTE_STREAM } from '@/api/endpoints';
// babel-jest hoists the jest.mock calls below above every import, so the layout loads mocked.
import AppLayout from '../app/(app)/_layout';

const mockAuth = { orgId: 'org_1' };
const mockClients: ApiClient[] = [];
const mockStreamingFetch = jest.fn(async () => ({
  ok: true,
  status: 200,
  headers: { get: () => 'text/event-stream' },
  body: null,
  json: async () => ({}),
}));

jest.mock('expo/fetch', () => ({ fetch: (...args: unknown[]) => (mockStreamingFetch as (...a: unknown[]) => unknown)(...args) }));
jest.mock('@clerk/expo', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    orgId: mockAuth.orgId,
    userId: 'clerk_me',
    getToken: mockGetToken,
    signOut: jest.fn(),
  }),
  useOrganizationList: () => ({ isLoaded: true, userMemberships: { data: [] }, setActive: jest.fn() }),
}));
const mockGetToken = jest.fn(async (o?: { skipCache?: boolean }) => (o?.skipCache ? 'fresh' : 'cached'));
jest.mock('expo-router', () => {
  const Stack = Object.assign(() => null, { Screen: () => null });
  return { Redirect: () => null, Stack };
});
jest.mock('@/push/usePushRegistration', () => ({ usePushRegistration: jest.fn() }));
jest.mock('@/lib/config', () => ({ config: { apiGatewayUrl: 'https://gw.test', realtimeUrl: null, clerkPublishableKey: 'pk', sentryDsn: null } }));
jest.mock('@/api/ApiProvider', () => ({
  ApiProvider: ({ client, children }: { client: ApiClient; children: React.ReactNode }) => {
    mockClients.push(client);
    return children;
  },
}));


function renderLayout() {
  const qc = new QueryClient();
  const ui = () => (
    <QueryClientProvider client={qc}>
      <AppLayout />
    </QueryClientProvider>
  );
  const r = render(ui());
  return { rerender: () => r.rerender(ui()) };
}

beforeEach(() => {
  mockClients.length = 0;
  mockAuth.orgId = 'org_1';
  mockStreamingFetch.mockClear();
  mockGetToken.mockClear();
});

describe('the signed-in shell (app/(app)/_layout.tsx)', () => {
  it('streams Ask Myte through expo/fetch with a freshly minted token, at the gateway origin', async () => {
    renderLayout();
    const client = mockClients[mockClients.length - 1];
    const stop = new AbortController();
    await client.stream(ASK_MYTE_STREAM, { question: 'Hi' }, stop.signal);
    expect(mockStreamingFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockStreamingFetch.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string>; signal: AbortSignal }];
    expect(url).toBe('https://gw.test/api/rag/myte');
    expect(init.method).toBe('POST');
    expect(init.signal).toBe(stop.signal);
    expect(init.headers.Authorization).toBe('Bearer fresh');
    expect(mockGetToken).toHaveBeenCalledWith({ skipCache: true });
  });

  it('reads everything else through the global fetch, never expo/fetch', async () => {
    const global = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"items":[]}', { status: 200 }));
    try {
      renderLayout();
      await mockClients[mockClients.length - 1].request('get', '/api/v1/myte/memories');
      expect(global).toHaveBeenCalledTimes(1);
      expect(mockStreamingFetch).not.toHaveBeenCalled();
    } finally {
      global.mockRestore();
    }
  });

  it('keeps one client while the workspace stays, and builds a new one on a workspace switch', () => {
    const r = renderLayout();
    r.rerender();
    const first = mockClients[0];
    expect(mockClients[mockClients.length - 1]).toBe(first);
    mockAuth.orgId = 'org_2';
    r.rerender();
    expect(mockClients[mockClients.length - 1]).not.toBe(first);
  });
});
