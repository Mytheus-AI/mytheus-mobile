/**
 * The single base fetch wrapper. Plan 1-2 section 7 step 2.
 *
 * It knows exactly one address, `EXPO_PUBLIC_API_GATEWAY_URL`, and one credential, the Clerk
 * bearer token. Everything else about a request is derived.
 *
 * IT NEVER SENDS `org_id`. Not as a header, not as a query parameter, not in a body. The
 * gateway derives the tenant from the verified JWT and resolves it through
 * `organizations.clerk_org_id`; a client-supplied tenant would be a value the server must
 * either ignore or trust, and trusting it is a cross-tenant read. There is deliberately no
 * parameter here through which a caller could pass one.
 *
 * Errors are RFC 7807 `application/problem+json`, and callers branch on the stable `code`
 * enum rather than on a message string or a bare status. `403` and `404` mean genuinely
 * different things and must not be collapsed: `404` is what a cross-tenant fetch returns,
 * because tenant existence is confidential.
 */

/** The frozen server-side enum (`libs/shared/errors.py: ErrorCode`). Kept in sync by hand
 *  until the generated client lands; a value here with no counterpart there is a bug. */
export type ErrorCode =
  | 'MALFORMED_BODY'
  | 'INVALID_CURSOR'
  | 'AUTH_REQUIRED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN_ROLE'
  | 'CROSS_TENANT_DENIED'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'VERSION_CONFLICT'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'INTERNAL'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'NOT_IMPLEMENTED';

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail?: string;
  instance?: string;
  errors?: { loc: string[]; msg: string; type: string }[];
}

/**
 * A typed API failure. Carries the parsed `code` so a screen can branch on it, and never
 * surfaces a raw server string to the UI without the caller choosing to.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly problem: Problem | null;

  constructor(status: number, code: ErrorCode, message: string, problem: Problem | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.problem = problem;
  }

  /** Session is gone or invalid: the caller should send the user back to sign-in. */
  get isAuthFailure(): boolean {
    return this.code === 'AUTH_REQUIRED' || this.code === 'TOKEN_EXPIRED';
  }

  /** Worth retrying. A dependency outage or a rate limit is transient; a 422 is not. */
  get isRetryable(): boolean {
    return this.code === 'DEPENDENCY_UNAVAILABLE' || this.code === 'RATE_LIMITED';
  }
}

/** Returns the current Clerk session token, or null when signed out. */
export type TokenProvider = () => Promise<string | null>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Replay protection for mutations. Generated automatically when omitted. */
  idempotencyKey?: string;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined>;
}

const MUTATING = new Set(['POST', 'PATCH', 'PUT']);

function baseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_GATEWAY_URL;
  if (!url) {
    throw new Error(
      'EXPO_PUBLIC_API_GATEWAY_URL is not set. The client must not fall back to a default ' +
        'host: a wrong default silently sends real bearer tokens somewhere unintended.'
    );
  }
  return url.replace(/\/+$/, '');
}

/**
 * A random idempotency key. Not a UUID library: the value only has to be unique per logical
 * attempt, and adding a dependency for that is not worth it. `Math.random` is fine because
 * this is a de-duplication token, never a secret.
 */
function generateIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    // `undefined` means "not specified" and must be omitted, not sent as the string
    // "undefined", which the server would reject as a validation error.
    if (value !== undefined) params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseProblem(response: Response): Promise<ApiError> {
  let problem: Problem | null = null;
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === 'object' && typeof parsed.code === 'string') {
      problem = parsed as Problem;
    }
  } catch {
    // A non-JSON body from a proxy, a gateway timeout page, or a truncated response. Falling
    // through to the status-derived code is deliberate: the request still failed, and the
    // caller needs a usable `code` rather than a parse exception on top of the real error.
  }

  if (problem) {
    return new ApiError(response.status, problem.code, problem.detail ?? problem.title, problem);
  }

  const fallback: ErrorCode =
    response.status === 401
      ? 'AUTH_REQUIRED'
      : response.status === 403
        ? 'FORBIDDEN_ROLE'
        : response.status === 404
          ? 'NOT_FOUND'
          : response.status >= 500
            ? 'INTERNAL'
            : 'MALFORMED_BODY';
  return new ApiError(response.status, fallback, `HTTP ${response.status}`, null);
}

/**
 * Create a request function bound to a token provider.
 *
 * A factory rather than a module-level singleton so the token provider is injected. That
 * makes the whole thing testable without Clerk, and it keeps the client from reaching into
 * React context from non-React code.
 */
export function createApiClient(getToken: TokenProvider) {
  return async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const token = await getToken();

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (MUTATING.has(method)) {
      // Every mutation carries one, generated if the caller did not supply it. A retry on a
      // flaky mobile connection is the normal case, not the exceptional one, and without a
      // key it creates a second meeting.
      headers['Idempotency-Key'] = options.idempotencyKey ?? generateIdempotencyKey();
    }

    const response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });

    if (!response.ok) throw await parseProblem(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
