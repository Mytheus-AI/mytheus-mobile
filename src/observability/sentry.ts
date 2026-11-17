/**
 * The one place the app touches the Sentry SDK. Without `EXPO_PUBLIC_SENTRY_DSN` every function
 * here is a no-op: the SDK is never initialised and nothing is sent.
 */
import * as Sentry from '@sentry/react-native';
import { config } from '@/lib/config';
import { buildSentryOptions } from './options';

let started = false;

/** Starts crash reporting once, if this build has a DSN. Returns whether it is on. */
export function initObservability(dsn: string | null = config.sentryDsn, dev: boolean = __DEV__): boolean {
  if (started) return true;
  const options = buildSentryOptions({ dsn, dev });
  if (!options) return false;
  Sentry.init(options);
  started = true;
  return true;
}

export function isObservabilityOn(): boolean {
  return started;
}

/**
 * Ties later reports to the signed-in person by their Clerk user id only (never email, never the
 * org: tenancy is server-derived). `null` on sign-out.
 */
export function identifyUser(clerkUserId: string | null): void {
  if (!started) return;
  Sentry.setUser(clerkUserId ? { id: clerkUserId } : null);
}

/** Reports a handled error. A no-op without a DSN. */
export function reportError(error: unknown): void {
  if (!started) return;
  Sentry.captureException(error);
}

/** Test seam: forget that the SDK was started. */
export function resetObservabilityForTests(): void {
  started = false;
}
