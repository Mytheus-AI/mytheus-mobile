import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiProvider } from '@/api/ApiProvider';
import type { ApiClient } from '@/api/client';
import { ToastProvider } from '@/components/ui';

export type Handler = (opts: { path?: Record<string, string>; query?: Record<string, unknown>; body?: unknown }) => unknown;

/** A REST client that answers from a table keyed by "METHOD /path/{template}", and records calls. */
export function fakeApi(table: Record<string, Handler | unknown>) {
  const calls: { key: string; opts: Parameters<Handler>[0] }[] = [];
  const client: { request: (m: string, p: string, o?: Parameters<Handler>[0]) => Promise<unknown> } & Record<string, unknown> = {
    async request(method: string, path: string, opts?: Parameters<Handler>[0]) {
      const key = `${method.toUpperCase()} ${path}`;
      calls.push({ key, opts: opts ?? {} });
      if (!(key in table)) throw new Error(`unexpected call ${key}`);
      const h = table[key];
      const v = typeof h === 'function' ? (h as Handler)(opts ?? {}) : h;
      return v instanceof Error ? Promise.reject(v) : v;
    },
    // Bytes routes (the voice's MP3) answer from the same table.
    async requestBytes(method: string, path: string, opts?: Parameters<Handler>[0]) {
      return client.request(method, path, opts);
    },
  };
  return { client: client as unknown as ApiClient, calls };
}

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

export function renderWithApi(ui: React.ReactElement, client: ApiClient) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={qc}>
        <ApiProvider client={client}>
          <ToastProvider>{ui}</ToastProvider>
        </ApiProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}
