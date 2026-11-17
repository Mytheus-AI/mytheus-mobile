/**
 * Crash reporting options, as pure functions so they are unit-tested without the native SDK.
 *
 * Sentry is the platform observability stack (ADR-0015; system.md §14). The phone reports only
 * when the build carries `EXPO_PUBLIC_SENTRY_DSN`; without it nothing is initialised and nothing
 * leaves the device. A client DSN is publishable (it can only submit events), so it may ship in the
 * bundle like the other `EXPO_PUBLIC_*` values. A legacy DSN carrying a secret key is refused.
 *
 * What may leave the device is narrow on purpose: no tenant identifier (`org_id` is server-derived
 * only), no request bodies or headers (bearer tokens, meeting content), no console output (it can
 * hold transcript or agent text), and no query strings on recorded URLs.
 */
import type { Breadcrumb, ErrorEvent, ReactNativeOptions } from '@sentry/react-native';

/** `https://<public key>@<host>/<project id>`; anything else (including a secret key) is refused. */
export function parseDsn(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const m = /^https:\/\/([A-Za-z0-9]+)(:[^@]*)?@([A-Za-z0-9.-]+(?::\d+)?)\/(?:[A-Za-z0-9._~-]+\/)*(\d+)$/.exec(value);
  if (!m) return null;
  // A `public:secret@` DSN is the legacy server form; its secret must never ship in a bundle.
  if (m[2] !== undefined) return null;
  return value;
}

const TENANT_KEYS = new Set(['org_id', 'orgid', 'organization_id', 'organizationid']);

function isTenantKey(key: string): boolean {
  return TENANT_KEYS.has(key.toLowerCase().replace(/-/g, '_'));
}

/** A copy of `value` with every tenant key removed at any depth. */
export function stripTenantKeys<T>(value: T, depth = 0): T {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stripTenantKeys(v, depth + 1)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isTenantKey(k)) continue;
    out[k] = stripTenantKeys(v, depth + 1);
  }
  return out as T;
}

/** The URL without its query string and fragment. */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/** `beforeSend`: keep the crash, drop anything that could carry a token, tenant or meeting content. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const next: ErrorEvent = { ...event };
  if (next.request) {
    const { url } = next.request;
    next.request = { method: next.request.method, ...(url ? { url: stripQuery(url) } : {}) };
  }
  if (next.user) next.user = next.user.id !== undefined ? { id: next.user.id } : {};
  if (next.tags) next.tags = stripTenantKeys(next.tags);
  if (next.extra) next.extra = stripTenantKeys(next.extra);
  if (next.contexts) next.contexts = stripTenantKeys(next.contexts);
  if (next.breadcrumbs) {
    next.breadcrumbs = next.breadcrumbs
      .map((b) => scrubBreadcrumb(b))
      .filter((b): b is Breadcrumb => b !== null);
  }
  return next;
}

/** `beforeBreadcrumb`: console lines are dropped; network breadcrumbs keep method, status and path. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null;
  if (!breadcrumb.data) return breadcrumb;
  const data = stripTenantKeys({ ...breadcrumb.data });
  if (typeof data.url === 'string') data.url = stripQuery(data.url);
  return { ...breadcrumb, data };
}

export interface SentryInputs {
  dsn: string | null | undefined;
  /** `__DEV__` at runtime. */
  dev: boolean;
}

/** The SDK options, or null when crash reporting is off for this build. */
export function buildSentryOptions({ dsn, dev }: SentryInputs): ReactNativeOptions | null {
  const parsed = parseDsn(dsn);
  if (!parsed) return null;
  return {
    dsn: parsed,
    environment: dev ? 'development' : 'production',
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  };
}
