/**
 * The single REST client to `api-gateway`. The mobile counterpart of mytheus-ui
 * `src/lib/api/client.ts`, with the same rules:
 *
 * - It knows one address (the gateway origin) and one credential (the Clerk session token).
 * - It NEVER sends `org_id`; there is no parameter for one. The gateway derives the tenant from
 *   the verified JWT.
 * - Errors are RFC 7807 and callers branch on the stable `code`, never on prose or status text.
 * - Every POST, PATCH and PUT carries an `Idempotency-Key`. A retry of the same mutation reuses the
 *   key it was first sent with (see `useApiMutation`), so a flaky network never double-applies.
 *
 * What differs from the web: there is no server in between, so the token comes from Clerk on the
 * device, and a 401 `TOKEN_EXPIRED` is retried once with a freshly minted token (Clerk session
 * tokens live about a minute; a phone that slept between screens should not show an error).
 */

import type { Body, Method, Op, PathParams, PathsWith, QueryParams, Success } from './spec';
import type { ErrorCode, Problem } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly traceId: string | null;

  constructor(status: number, code: ErrorCode, message: string, traceId: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }

  get isAuthFailure(): boolean {
    return this.code === 'AUTH_REQUIRED' || this.code === 'TOKEN_EXPIRED';
  }

  /** Nothing reached the server, or nothing came back: worth a retry. */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export type GetToken = (opts?: { fresh?: boolean }) => Promise<string | null>;

/**
 * The one streamed route (Ask Myte, ADR-0047 D8): rag-service's `POST /api/rag/myte` through the
 * gateway. It has no OpenAPI document yet (mytheus-ui hand-writes its types too), so it is pinned
 * here by name rather than through the generated route table.
 */
export type StreamPath = '/api/rag/myte';

/** What a streamed response must offer: `expo/fetch`'s Response does; RN's global fetch does not
    (its body is not a ReadableStream), which is why the stream has its own fetch. */
export interface StreamResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
  json(): Promise<unknown>;
}

export type StreamFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<StreamResponse>;

export interface ApiClientOptions {
  baseUrl: string;
  getToken: GetToken;
  fetchImpl?: typeof fetch;
  /** A fetch whose response body streams (`fetch` from 'expo/fetch' in the app; a fake in tests). */
  streamFetch?: StreamFetch;
  /** Reads give up after this long, so a stuck backend degrades one panel, not the app. */
  readTimeoutMs?: number;
  newKey?: () => string;
}

export interface RequestOptions<O> {
  path?: PathParams<O>;
  query?: QueryParams<O>;
  body?: Body<O>;
  idempotencyKey?: string;
  /** Mint a new session token for this call instead of using Clerk's cached one. */
  freshToken?: boolean;
  /**
   * Give up after this long, for this call only, writes included. By default reads use the
   * client's read timeout and writes are never aborted (see `send`); Ask Myte's save sets one
   * because its web route does (`gatewayJson`: 6 s reads, 15 s writes), and a stalled save must
   * end as "unsaved" rather than hold the composer forever.
   */
  timeoutMs?: number;
}

export interface ApiClient {
  request<M extends Method, P extends PathsWith<M>>(
    method: M,
    path: P,
    options?: RequestOptions<Op<P, M>>,
  ): Promise<Success<Op<P, M>>>;
  /** The same call for a route that answers with bytes (the voice's `audio/mpeg`), not JSON. */
  requestBytes<M extends Method, P extends PathsWith<M>>(
    method: M,
    path: P,
    options?: RequestOptions<Op<P, M>>,
  ): Promise<ArrayBuffer>;
  /**
   * A server-sent-events POST, returned unread for the caller to parse. Always a freshly minted
   * token (an answer may run 45 s of tool time on a ~60 s token), no timeout (the caller owns the
   * abort), and no Idempotency-Key: it reads, it creates nothing. Never an org id.
   */
  stream(path: StreamPath, body: unknown, signal?: AbortSignal): Promise<StreamResponse>;
}

const MUTATING = new Set<Method>(['post', 'patch', 'put']);

export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/** Fill `{name}` segments from `params`, encoded. An unfilled segment is a programming error. */
export function fillPath(template: string, params?: Record<string, unknown>): string {
  return template.replace(/\{([a-z_]+)\}/g, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing path parameter "${name}" for ${template}`);
    }
    return encodeURIComponent(String(value));
  });
}

export function buildQuery(query?: Record<string, unknown>): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    // `undefined`/`null` mean "unspecified" and are omitted, never sent as text.
    if (value === undefined || value === null) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

const CODES: ReadonlySet<string> = new Set<ErrorCode>([
  'MALFORMED_BODY',
  'INVALID_CURSOR',
  'AUTH_REQUIRED',
  'TOKEN_EXPIRED',
  'FORBIDDEN_ROLE',
  'CROSS_TENANT_DENIED',
  'NOT_FOUND',
  'IDEMPOTENCY_KEY_REUSED',
  'VERSION_CONFLICT',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'QUOTA_EXCEEDED',
  'INTERNAL',
  'DEPENDENCY_UNAVAILABLE',
  'NOT_IMPLEMENTED',
  'NOT_A_PARTICIPANT',
  'CONSENT_REQUIRED',
  'EXTERNAL_MEETING',
  'PROVIDER_NOT_CONFIGURED',
  'PM_ALREADY_CONNECTED',
  'ACCOUNT_CONNECTED_ELSEWHERE',
]);

function fallbackCode(status: number): ErrorCode {
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 403) return 'FORBIDDEN_ROLE';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'VERSION_CONFLICT';
  if (status === 422) return 'VALIDATION_FAILED';
  if (status === 428) return 'CONSENT_REQUIRED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'DEPENDENCY_UNAVAILABLE';
  if (status >= 500) return 'INTERNAL';
  return 'MALFORMED_BODY';
}

export async function toApiError(response: Response): Promise<ApiError> {
  try {
    const parsed = (await response.json()) as Partial<Problem>;
    if (parsed && typeof parsed.code === 'string' && CODES.has(parsed.code)) {
      return new ApiError(
        response.status,
        parsed.code as ErrorCode,
        parsed.detail ?? parsed.title ?? `HTTP ${response.status}`,
        typeof parsed.trace_id === 'string' ? parsed.trace_id : null,
      );
    }
  } catch {
    // A proxy error page or a truncated body: the request still failed with this status.
  }
  return new ApiError(response.status, fallbackCode(response.status), `HTTP ${response.status}`);
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const base = options.baseUrl.replace(/\/+$/, '');
  const doFetch = options.fetchImpl ?? fetch;
  const readTimeout = options.readTimeoutMs ?? 10_000;
  const makeKey = options.newKey ?? newIdempotencyKey;

  async function send(
    method: Method,
    url: string,
    body: unknown,
    key: string | undefined,
    fresh: boolean,
    accept: string,
    timeoutMs: number | undefined,
  ): Promise<Response> {
    const token = await options.getToken(fresh ? { fresh: true } : undefined);
    const headers: Record<string, string> = { Accept: accept };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (key) headers['Idempotency-Key'] = key;

    const controller = new AbortController();
    // Writes are not aborted unless the caller asks (`timeoutMs`): aborting would not undo one on
    // the server, so only a caller that retries with the same Idempotency-Key bounds a write.
    const limit = timeoutMs ?? (MUTATING.has(method) ? null : readTimeout);
    const timer = limit === null ? null : setTimeout(() => controller.abort(), limit);
    try {
      return await doFetch(url, {
        method: method.toUpperCase(),
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(0, 'DEPENDENCY_UNAVAILABLE', 'The server could not be reached');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function call(method: Method, path: string, opts: unknown, accept: string): Promise<Response> {
    const o = (opts ?? {}) as {
      path?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: unknown;
      idempotencyKey?: string;
      freshToken?: boolean;
      timeoutMs?: number;
    };
    const url = `${base}${fillPath(path, o.path)}${buildQuery(o.query)}`;
    const key = MUTATING.has(method) ? (o.idempotencyKey ?? makeKey()) : undefined;

    let response = await send(method, url, o.body, key, o.freshToken === true, accept, o.timeoutMs);
    if (response.status === 401) {
      const err = await toApiError(response);
      if (err.code !== 'TOKEN_EXPIRED') throw err;
      // The same key on the retry: the server has not applied the first attempt.
      response = await send(method, url, o.body, key, true, accept, o.timeoutMs);
    }
    if (!response.ok) throw await toApiError(response);
    return response;
  }

  return {
    async request(method, path, opts) {
      const response = await call(method, path, opts, 'application/json');
      if (response.status === 204) return undefined as never;
      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as never;
    },
    async requestBytes(method, path, opts) {
      const response = await call(method, path, opts, 'audio/mpeg, application/problem+json');
      try {
        return await response.arrayBuffer();
      } catch {
        throw new ApiError(0, 'DEPENDENCY_UNAVAILABLE', 'The response was cut off');
      }
    },
    async stream(path, body, signal) {
      if (!options.streamFetch) throw new ApiError(0, 'DEPENDENCY_UNAVAILABLE', 'Streaming is not available');
      const token = await options.getToken({ fresh: true });
      const headers: Record<string, string> = { Accept: 'text/event-stream', 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      try {
        return await options.streamFetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal });
      } catch {
        throw new ApiError(0, 'DEPENDENCY_UNAVAILABLE', 'The server could not be reached');
      }
    },
  };
}
