/**
 * Wires the API client to Clerk's session and exposes it through context.
 *
 * The token comes from `useAuth().getToken()` on every request rather than being captured
 * once: Clerk rotates short-lived session tokens, so a captured token starts failing with a
 * 401 after a few minutes and the user appears to be randomly signed out.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ApiError, createApiClient, type ApiClient } from './client';

const ApiContext = createContext<ApiClient | null>(null);

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Mobile networks drop requests constantly, so retrying is the default. But retrying
        // a 401 or a 422 is pointless and, for auth failures, actively harmful: it delays
        // sending the user to sign-in by however long the backoff takes.
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            if (error.isAuthFailure || !error.isRetryable) return false;
          }
          return failureCount < 2;
        },
        staleTime: 30_000,
        // Reads are stale-while-revalidate. Durable truth is never invented client-side: the
        // owning service is always the write authority, and this cache only affects what is
        // painted while a fresh read is in flight.
        refetchOnReconnect: true,
      },
    },
  });
}

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  const client = useMemo(() => createApiClient(() => getToken()), [getToken]);
  const queryClient = useMemo(makeQueryClient, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={client}>{children}</ApiContext.Provider>
    </QueryClientProvider>
  );
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) {
    throw new Error('useApi must be used inside <ApiProvider>. Check app/_layout.tsx.');
  }
  return client;
}
