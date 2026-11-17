/**
 * The app's public configuration. Only `EXPO_PUBLIC_*` values ship in the bundle, and only
 * publishable ones: the gateway origin, the realtime origin, the Clerk publishable key and the
 * optional Sentry client DSN. The
 * LiveKit URL arrives with every minted token (meeting-service `TokenResponse.livekit_url`), so it
 * is not configuration at all.
 *
 * There are deliberately no defaults, the same rule mytheus-ui `lib/api/client.ts` follows: a
 * wrong default would send a real session token to an unintended host. A build without them runs
 * in a clear "not connected to a workspace" state instead of guessing.
 *
 * `process.env.EXPO_PUBLIC_*` must be read with the literal member expression: Expo inlines only
 * that exact form at bundle time.
 */

export interface AppConfig {
  /** e.g. https://api.mytheus.cloud (REST: `/api/v1/*`, `/bff/*`, `/users`, `/notifications`). */
  apiGatewayUrl: string | null;
  /** e.g. wss://api.mytheus.cloud (Socket.io `/v1`). */
  realtimeUrl: string | null;
  clerkPublishableKey: string | null;
  /**
   * Sentry's client DSN (publishable by design: it only lets a client send events). Optional:
   * without it crash reporting is simply off (`src/observability/`), never a "not connected" state.
   */
  sentryDsn: string | null;
}

function clean(value: string | undefined): string | null {
  const v = (value ?? '').trim();
  return v ? v.replace(/\/+$/, '') : null;
}

export function readConfig(): AppConfig {
  return {
    apiGatewayUrl: clean(process.env.EXPO_PUBLIC_API_GATEWAY_URL),
    realtimeUrl: clean(process.env.EXPO_PUBLIC_REALTIME_WS_URL),
    clerkPublishableKey: clean(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY),
    sentryDsn: clean(process.env.EXPO_PUBLIC_SENTRY_DSN),
  };
}

export const config: AppConfig = readConfig();

/** The app can sign in and read data only with both of these. */
export function isConnected(c: AppConfig = config): boolean {
  return Boolean(c.apiGatewayUrl && c.clerkPublishableKey);
}
