import { AppState, Platform, type AppStateStatus } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

/**
 * Server state lives in TanStack Query, in memory. It is deliberately NOT persisted to disk:
 * AsyncStorage is unencrypted, and meeting notes and transcripts must not sit on a phone at rest
 * (CLAUDE.md: no transcript or agent content stored durably). Screens show the last good data
 * while they refetch, and say so when a refetch fails.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        // Only a network failure or a server error is worth repeating; a 4xx will say the same.
        retry: (count, error) => count < 2 && error instanceof ApiError && (error.isNetwork || error.status >= 500),
        refetchOnReconnect: true,
      },
      mutations: {
        // A mutation retried after a dropped connection reuses its Idempotency-Key (the key is part
        // of the variables), so a replay never applies twice.
        retry: (count, error) => count < 2 && error instanceof ApiError && error.isNetwork,
      },
    },
  });
}

/** Refetch stale screens when the app comes back to the foreground, as a browser tab does. */
export function wireAppFocus(): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });
  return () => sub.remove();
}
