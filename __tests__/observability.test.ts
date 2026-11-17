import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';
import * as Sentry from '@sentry/react-native';
import {
  buildSentryOptions,
  parseDsn,
  scrubBreadcrumb,
  scrubEvent,
  stripQuery,
  stripTenantKeys,
} from '@/observability/options';
import {
  identifyUser,
  initObservability,
  isObservabilityOn,
  reportError,
  resetObservabilityForTests,
} from '@/observability/sentry';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
}));

const DSN = 'https://0123abcdef@o42.ingest.us.sentry.io/4507';

describe('parseDsn', () => {
  it('accepts a public client DSN', () => {
    expect(parseDsn(DSN)).toBe(DSN);
    expect(parseDsn(`  ${DSN}  `)).toBe(DSN);
    expect(parseDsn('https://abc@sentry.example.com:9000/sentry/12')).toBe('https://abc@sentry.example.com:9000/sentry/12');
  });

  it('turns reporting off for a missing or malformed DSN', () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn(null)).toBeNull();
    expect(parseDsn('')).toBeNull();
    expect(parseDsn('not a dsn')).toBeNull();
    expect(parseDsn('http://abc@o1.ingest.sentry.io/1')).toBeNull();
    expect(parseDsn('https://o1.ingest.sentry.io/1')).toBeNull();
  });

  it('refuses a legacy DSN that carries a secret key', () => {
    expect(parseDsn('https://public:secret@o1.ingest.sentry.io/1')).toBeNull();
  });
});

describe('buildSentryOptions', () => {
  it('is null without a DSN, so nothing is initialised', () => {
    expect(buildSentryOptions({ dsn: null, dev: false })).toBeNull();
    expect(buildSentryOptions({ dsn: '', dev: true })).toBeNull();
  });

  it('sends no default PII and no screenshots', () => {
    const o = buildSentryOptions({ dsn: DSN, dev: false });
    expect(o).toMatchObject({
      dsn: DSN,
      environment: 'production',
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
    });
    expect(buildSentryOptions({ dsn: DSN, dev: true })?.environment).toBe('development');
  });
});

describe('scrubbing', () => {
  it('strips query strings and fragments', () => {
    expect(stripQuery('https://api.mytheus.cloud/api/v1/actions?cursor=x#y')).toBe('https://api.mytheus.cloud/api/v1/actions');
    expect(stripQuery('/bff/home')).toBe('/bff/home');
  });

  it('removes tenant keys at any depth', () => {
    expect(stripTenantKeys({ org_id: 'o', a: { orgId: 'o', 'org-id': 'o', b: [{ organization_id: 'o', c: 1 }] } })).toEqual({
      a: { b: [{ c: 1 }] },
    });
  });

  it('keeps the crash but drops headers, bodies, cookies, PII and tenancy', () => {
    const event: ErrorEvent = {
      type: undefined,
      message: 'boom',
      request: {
        url: 'https://api.mytheus.cloud/api/v1/ask?q=secret',
        method: 'POST',
        headers: { Authorization: 'Bearer t' },
        cookies: { session: 's' },
        data: { question: 'meeting content' },
      },
      user: { id: 'user_1', email: 'a@b.c', ip_address: '1.2.3.4' },
      tags: { org_id: 'org_1', screen: 'home' },
      extra: { orgId: 'org_1', attempt: 2 },
      contexts: { app: { org_id: 'org_1', app_version: '0.1.0' } },
      breadcrumbs: [
        { category: 'console', message: 'transcript text' },
        { category: 'fetch', data: { url: '/api/v1/ask?q=x', method: 'POST', status_code: 500 } },
      ],
    };
    const out = scrubEvent(event);
    expect(out.message).toBe('boom');
    expect(out.request).toEqual({ method: 'POST', url: 'https://api.mytheus.cloud/api/v1/ask' });
    expect(out.user).toEqual({ id: 'user_1' });
    expect(out.tags).toEqual({ screen: 'home' });
    expect(out.extra).toEqual({ attempt: 2 });
    expect(out.contexts).toEqual({ app: { app_version: '0.1.0' } });
    expect(out.breadcrumbs).toEqual([{ category: 'fetch', data: { url: '/api/v1/ask', method: 'POST', status_code: 500 } }]);
    // The input is not mutated.
    expect(event.tags).toHaveProperty('org_id');
  });

  it('drops console breadcrumbs and passes others through', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'x' })).toBeNull();
    const nav: Breadcrumb = { category: 'navigation', message: '/home' };
    expect(scrubBreadcrumb(nav)).toBe(nav);
  });
});

describe('initObservability', () => {
  beforeEach(() => {
    resetObservabilityForTests();
    jest.clearAllMocks();
  });

  it('is a no-op without a DSN', () => {
    expect(initObservability(null, false)).toBe(false);
    identifyUser('user_1');
    reportError(new Error('x'));
    expect(isObservabilityOn()).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.setUser).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('initialises once with a DSN and identifies by user id only', () => {
    expect(initObservability(DSN, false)).toBe(true);
    expect(initObservability(DSN, false)).toBe(true);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    identifyUser('user_1');
    expect(Sentry.setUser).toHaveBeenLastCalledWith({ id: 'user_1' });
    identifyUser(null);
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
    const err = new Error('x');
    reportError(err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });
});
