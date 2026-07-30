/**
 * The base client's contract. Plan section 7 acceptance: bearer injection and RFC 7807 parsing.
 *
 * Plain jest with ts-jest rather than jest-expo: the client imports nothing from React Native,
 * and jest-expo's preset requires a React version this app is not on. Pulling React forward to
 * satisfy a test harness would be changing the app to suit its tests.
 */

import { ApiError, createApiClient } from '../src/api/client';

const GATEWAY = 'https://gateway.test';

function mockFetch(response: Partial<Response> & { jsonBody?: unknown }) {
  const fn = jest.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => {
      if ('jsonBody' in response) return response.jsonBody;
      throw new Error('no json body');
    },
  });
  (globalThis as unknown as { fetch: unknown }).fetch = fn;
  return fn;
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_GATEWAY_URL = GATEWAY;
  jest.restoreAllMocks();
});

describe('bearer injection', () => {
  it('attaches the Clerk token to every request', async () => {
    const fetchMock = mockFetch({ jsonBody: { ok: true } });
    const api = createApiClient(async () => 'tok_abc');

    await api('/bff/dashboard');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer tok_abc');
  });

  it('omits the header entirely when signed out, rather than sending "Bearer null"', async () => {
    const fetchMock = mockFetch({ jsonBody: {} });
    const api = createApiClient(async () => null);

    await api('/bff/dashboard');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('re-reads the token per request, because Clerk rotates short-lived sessions', async () => {
    const fetchMock = mockFetch({ jsonBody: {} });
    let n = 0;
    const api = createApiClient(async () => `tok_${++n}`);

    await api('/a');
    await api('/b');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok_1');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tok_2');
  });
});

describe('org_id is never sent', () => {
  it('sends no org_id in the url, headers or body', async () => {
    const fetchMock = mockFetch({ jsonBody: {} });
    const api = createApiClient(async () => 'tok');

    await api('/api/v1/meetings', { method: 'POST', body: { title: 'Standup' } });

    const [url, init] = fetchMock.mock.calls[0];
    const serialized = `${url} ${JSON.stringify(init.headers)} ${init.body ?? ''}`.toLowerCase();
    expect(serialized).not.toContain('org_id');
    expect(serialized).not.toContain('org-id');
  });
});

describe('idempotency', () => {
  it('generates a key for mutations when the caller supplies none', async () => {
    const fetchMock = mockFetch({ jsonBody: {} });
    const api = createApiClient(async () => 'tok');

    await api('/api/v1/meetings', { method: 'POST', body: {} });

    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBeTruthy();
  });

  it('honours a caller-supplied key, so an offline retry reuses it', async () => {
    const fetchMock = mockFetch({ jsonBody: {} });
    const api = createApiClient(async () => 'tok');

    await api('/api/v1/meetings', { method: 'POST', body: {}, idempotencyKey: 'retry-me' });

    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe('retry-me');
  });

  it('sends no key on a GET, which is already idempotent', async () => {
    const fetchMock = mockFetch({ jsonBody: {} });
    const api = createApiClient(async () => 'tok');

    await api('/bff/dashboard');

    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBeUndefined();
  });
});

describe('RFC 7807 parsing', () => {
  it('surfaces the stable code, not the http status text', async () => {
    mockFetch({
      ok: false,
      status: 403,
      jsonBody: {
        type: 'https://api.mytheus.ai/errors/FORBIDDEN_ROLE',
        title: 'Forbidden Role',
        status: 403,
        code: 'FORBIDDEN_ROLE',
        detail: 'This action requires the admin role or above',
      },
    });
    const api = createApiClient(async () => 'tok');

    await expect(api('/api/v1/teams', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'FORBIDDEN_ROLE',
      status: 403,
    });
  });

  it('distinguishes a cross-tenant 404 from a role 403', async () => {
    mockFetch({
      ok: false,
      status: 404,
      jsonBody: { type: 't', title: 'Not Found', status: 404, code: 'NOT_FOUND' },
    });
    const api = createApiClient(async () => 'tok');

    // Collapsing these would lose the reason the backend returns 404 for another tenant's
    // resource: existence is tenant-confidential, and 403 would confirm the id is real.
    await expect(api('/api/v1/meetings/x')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('classifies auth failures so a screen can route to sign-in', async () => {
    mockFetch({
      ok: false,
      status: 401,
      jsonBody: { type: 't', title: 'Token Expired', status: 401, code: 'TOKEN_EXPIRED' },
    });
    const api = createApiClient(async () => 'tok');

    expect.assertions(3);
    try {
      await api('/bff/dashboard');
    } catch (err) {
      const e = err as ApiError;
      expect(e).toBeInstanceOf(ApiError);
      expect(e.isAuthFailure).toBe(true);
      expect(e.isRetryable).toBe(false);
    }
  });

  it('marks a dependency outage retryable but a validation error not', async () => {
    mockFetch({
      ok: false,
      status: 503,
      jsonBody: {
        type: 't',
        title: 'x',
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
      },
    });
    const api = createApiClient(async () => 'tok');
    try {
      await api('/bff/dashboard');
    } catch (err) {
      expect((err as ApiError).isRetryable).toBe(true);
    }

    mockFetch({
      ok: false,
      status: 422,
      jsonBody: { type: 't', title: 'x', status: 422, code: 'VALIDATION_FAILED' },
    });
    try {
      await api('/api/v1/meetings', { method: 'POST', body: {} });
    } catch (err) {
      expect((err as ApiError).isRetryable).toBe(false);
    }
  });

  it('falls back to a status-derived code when the body is not problem+json', async () => {
    // A proxy error page or a truncated response. The request still failed, and the caller
    // needs a usable code rather than a JSON parse exception on top of the real error.
    mockFetch({ ok: false, status: 502 });
    const api = createApiClient(async () => 'tok');

    await expect(api('/bff/dashboard')).rejects.toMatchObject({
      code: 'INTERNAL',
      status: 502,
    });
  });
});

describe('url building', () => {
  it('omits undefined query parameters instead of sending the string "undefined"', async () => {
    const fetchMock = mockFetch({ jsonBody: {} });
    const api = createApiClient(async () => 'tok');

    await api('/api/v1/meetings', { query: { status: undefined, limit: 50 } });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${GATEWAY}/api/v1/meetings?limit=50`);
  });

  it('refuses to run without a configured gateway rather than guessing a host', async () => {
    delete process.env.EXPO_PUBLIC_API_GATEWAY_URL;
    mockFetch({ jsonBody: {} });
    const api = createApiClient(async () => 'tok');

    // A default host would send real bearer tokens somewhere unintended.
    await expect(api('/bff/dashboard')).rejects.toThrow('EXPO_PUBLIC_API_GATEWAY_URL');
  });
});
