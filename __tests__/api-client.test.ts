import { ApiError, buildQuery, createApiClient, fillPath } from '@/api/client';
import { endpoints } from '@/api/endpoints';

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: Array<() => Response>) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    return next();
  }) as unknown as typeof fetch;
  return { calls, impl };
}

const json = (status: number, body: unknown) => () =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const headers = (c: Call) => c.init.headers as Record<string, string>;

describe('fillPath and buildQuery', () => {
  it('encodes path segments and refuses a missing one', () => {
    expect(fillPath('/api/v1/meetings/{meeting_id}', { meeting_id: 'a b/c' })).toBe('/api/v1/meetings/a%20b%2Fc');
    expect(() => fillPath('/api/v1/meetings/{meeting_id}', {})).toThrow(/meeting_id/);
  });
  it('omits unspecified values instead of sending "undefined"', () => {
    expect(buildQuery({ status: 'confirmed', cursor: undefined, x: null })).toBe('?status=confirmed');
    expect(buildQuery({})).toBe('');
  });
});

describe('createApiClient', () => {
  it('sends the bearer token to the gateway origin and never an org id', async () => {
    const f = fakeFetch([json(200, { items: [] })]);
    const api = createApiClient({ baseUrl: 'https://api.example.test/', getToken: async () => 'tok', fetchImpl: f.impl });
    await endpoints.myTasks(api, 'confirmed');
    expect(f.calls[0].url).toBe('https://api.example.test/api/v1/actions/mine?status=confirmed');
    expect(headers(f.calls[0]).Authorization).toBe('Bearer tok');
    expect(f.calls[0].url).not.toMatch(/org/);
    expect(Object.keys(headers(f.calls[0])).join()).not.toMatch(/org/i);
    expect(headers(f.calls[0])['Idempotency-Key']).toBeUndefined();
  });

  it('puts an Idempotency-Key on every write, and the caller can fix it', async () => {
    const f = fakeFetch([json(200, { id: 't1', status: 'done' }), json(200, { id: 't2' })]);
    const api = createApiClient({ baseUrl: 'https://x.test', getToken: async () => 't', fetchImpl: f.impl, newKey: () => 'gen' });
    await endpoints.completeTask(api, 't1');
    await endpoints.completeTask(api, 't2', 'mine');
    expect(headers(f.calls[0])['Idempotency-Key']).toBe('gen');
    expect(headers(f.calls[1])['Idempotency-Key']).toBe('mine');
    expect(f.calls[0].init.method).toBe('POST');
  });

  it('retries a TOKEN_EXPIRED once with a fresh token and the same key', async () => {
    const f = fakeFetch([json(401, { code: 'TOKEN_EXPIRED', status: 401, title: 'x', type: 'about:blank' }), json(200, { status: 'read' })]);
    const getToken = jest.fn(async (o?: { fresh?: boolean }) => (o?.fresh ? 'fresh' : 'stale'));
    const api = createApiClient({ baseUrl: 'https://x.test', getToken, fetchImpl: f.impl, newKey: () => 'k1' });
    await endpoints.setNotificationStatus(api, 'n1', 'read');
    expect(getToken).toHaveBeenLastCalledWith({ fresh: true });
    expect(headers(f.calls[1]).Authorization).toBe('Bearer fresh');
    expect(headers(f.calls[0])['Idempotency-Key']).toBe('k1');
    expect(headers(f.calls[1])['Idempotency-Key']).toBe('k1');
  });

  it('parses RFC 7807 problems into a stable code', async () => {
    const f = fakeFetch([json(428, { code: 'CONSENT_REQUIRED', status: 428, title: 'Consent', type: 'about:blank', trace_id: 'tr' })]);
    const api = createApiClient({ baseUrl: 'https://x.test', getToken: async () => 't', fetchImpl: f.impl });
    const err = await endpoints.mintToken(api, 'm1', null).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('CONSENT_REQUIRED');
    expect(err.status).toBe(428);
    expect(err.traceId).toBe('tr');
  });

  it('falls back to a code from the status when the body is not a problem', async () => {
    const f = fakeFetch([() => new Response('<html>bad gateway</html>', { status: 502 })]);
    const api = createApiClient({ baseUrl: 'https://x.test', getToken: async () => 't', fetchImpl: f.impl });
    const err = await endpoints.dashboard(api).catch((e) => e);
    expect(err.code).toBe('INTERNAL');
  });

  it('reports an unreachable server as a network error', async () => {
    const impl = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: 'https://x.test', getToken: async () => 't', fetchImpl: impl });
    const err = await endpoints.dashboard(api).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.isNetwork).toBe(true);
  });
});

/**
 * The contract table: every REST call the app makes, as the gateway sees it. `tsc` checks each
 * one against the generated OpenAPI route table; this pins the exact method and URL, so a change
 * to what the phone sends is a reviewed change.
 */
describe('every endpoint the app calls', () => {
  it('hits the documented method and path', async () => {
    const seen: string[] = [];
    const impl = (async (url: string, init: RequestInit) => {
      seen.push(`${init.method} ${url.replace('https://x.test', '')}${init.body ? ` ${init.body}` : ''}`);
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: 'https://x.test', getToken: async () => 't', fetchImpl: impl });
    const M = 'm1';
    await endpoints.me(api);
    await endpoints.members(api);
    await endpoints.dashboard(api);
    await endpoints.catchUp(api, M);
    await endpoints.ask(api, 'What changed?', null);
    await endpoints.ask(api, 'What changed?', M);
    await endpoints.notifications(api, 'unread');
    await endpoints.setNotificationStatus(api, 'n1', 'dismissed');
    await endpoints.pushDevices(api);
    await endpoints.registerPushDevice(api, 'ExponentPushToken[abc12345]', 'ios');
    await endpoints.unregisterPushDevice(api, 'p1');
    await endpoints.myTasks(api, 'done');
    await endpoints.completeTask(api, 'a1');
    await endpoints.reopenTask(api, 'a1');
    await endpoints.commitments(api, 'open');
    await endpoints.setCommitmentStatus(api, 'c1', 'done');
    await endpoints.statusRequests(api, 'pending');
    await endpoints.answerStatusRequest(api, 's1', 'On track');
    await endpoints.decisions(api);
    await endpoints.decisionRecord(api, 'd1');
    await endpoints.decisionShareLinks(api, 'd1');
    await endpoints.createDecisionShareLink(api, 'd1');
    await endpoints.confirmDecision(api, 'd1');
    await endpoints.dismissDecision(api, 'd1');
    await endpoints.confirmAction(api, 'a1');
    await endpoints.dismissAction(api, 'a1');
    await endpoints.meetings(api);
    await endpoints.meeting(api, M);
    await endpoints.recap(api, M);
    await endpoints.myNotes(api, M);
    await endpoints.candidates(api, M);
    await endpoints.transcript(api, M);
    await endpoints.speakers(api, M);
    await endpoints.setAgendaStatus(api, M, 'i1', 'covered');
    await endpoints.endMeeting(api, M);
    await endpoints.captureStatus(api);
    await endpoints.startCapture(api, null, '2026-11-11T10:00:00.000Z');
    await endpoints.startCapture(api, 'Design review', '2026-11-11T10:00:00.000Z');
    await endpoints.refreshCapture(api, M, '2026-11-11T10:00:00.000Z');
    await endpoints.endCapture(api, M);
    await endpoints.roomSession(api, M);
    await endpoints.mintToken(api, M, null);
    await endpoints.mintToken(api, M, 'room-notice-2026-11-11');
    expect(seen).toMatchInlineSnapshot(`
[
  "GET /users/me",
  "GET /users",
  "GET /bff/dashboard",
  "GET /bff/meetings/m1/catch-up",
  "POST /api/v1/ask {"question":"What changed?"}",
  "POST /api/v1/ask {"question":"What changed?","meeting_id":"m1"}",
  "GET /notifications?status=unread&limit=50",
  "PATCH /notifications/n1 {"status":"dismissed"}",
  "GET /notifications/push-devices",
  "POST /notifications/push-devices {"token":"ExponentPushToken[abc12345]","platform":"ios"}",
  "DELETE /notifications/push-devices/p1",
  "GET /api/v1/actions/mine?status=done",
  "POST /api/v1/actions/a1/done",
  "POST /api/v1/actions/a1/reopen",
  "GET /api/v1/commitments?status=open",
  "PATCH /api/v1/commitments/c1 {"status":"done"}",
  "GET /api/v1/status-requests?state=pending",
  "POST /api/v1/status-requests/s1/answer {"status_text":"On track"}",
  "GET /api/v1/decisions",
  "GET /api/v1/decisions/d1/record",
  "GET /api/v1/decisions/d1/share-links",
  "POST /api/v1/decisions/d1/share-links {"expires_in_days":30,"confirm_confidential":false}",
  "POST /api/v1/decisions/d1/confirm",
  "POST /api/v1/decisions/d1/dismiss",
  "POST /api/v1/actions/a1/confirm",
  "POST /api/v1/actions/a1/dismiss",
  "GET /api/v1/meetings?limit=30",
  "GET /api/v1/meetings/m1",
  "GET /api/v1/meetings/m1/recap",
  "GET /api/v1/meetings/m1/worklogs?user_id=me",
  "GET /api/v1/meetings/m1/candidates?include_resolved=true",
  "GET /api/v1/meetings/m1/transcript?limit=500",
  "GET /api/v1/meetings/m1/speakers",
  "PATCH /api/v1/meetings/m1/agenda/i1 {"status":"covered"}",
  "PATCH /api/v1/meetings/m1 {"status":"ended"}",
  "GET /api/v1/capture/status",
  "POST /api/v1/capture/sessions {"consent":true,"consent_at":"2026-11-11T10:00:00.000Z"}",
  "POST /api/v1/capture/sessions {"title":"Design review","consent":true,"consent_at":"2026-11-11T10:00:00.000Z"}",
  "POST /api/v1/capture/sessions/m1/refresh {"consent_at":"2026-11-11T10:00:00.000Z"}",
  "POST /api/v1/capture/sessions/m1/end",
  "GET /api/meetings/m1/session",
  "POST /api/meetings/m1/token",
  "POST /api/meetings/m1/token {"consent":{"version":"room-notice-2026-11-11"}}",
]
`);
  });
});
