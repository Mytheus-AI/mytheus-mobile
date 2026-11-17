import { emailCodeFactor, nextStep, secondFactor, clerkMessage } from '@/auth/sign-in-flow';
import { ago, clock, dayLabel, dueLabel } from '@/lib/format';
import { countLabel, inboxCounts, toInboxItems, toStatusView } from '@/lib/inbox';
import { groupMeetings } from '@/lib/meetings';
import { describeNotification } from '@/lib/notification-copy';
import { joinPeople, nameFor } from '@/lib/people';
import { joinErrorText, speakerLabel } from '@/lib/room';
import { appRoute } from '@/lib/routes';
import type { Meeting, StatusRequest } from '@/api/types';

const UUID = '0b6a3c43-2f5d-4f4b-9a8e-0a1b2c3d4e5f';
const UUID2 = '1c7b4d54-3a6e-4a5c-8b9f-1b2c3d4e5f60';

describe('appRoute: notification links lead to the same thing on the phone', () => {
  it.each([
    [`/meetings/${UUID}`, `/meetings/${UUID}`],
    [`/meetings/${UUID}/decisions/${UUID2}`, `/decisions/${UUID2}`],
    ['/decisions', '/decisions'],
    [`/decisions/${UUID2}`, `/decisions/${UUID2}`],
    ['/status-requests', '/work?tab=updates'],
    ['/work/updates', '/work?tab=updates'],
    ['/tasks', '/work?tab=tasks'],
    ['/work/promises', '/work?tab=promises'],
    ['/notifications', '/inbox'],
    ['/workspace/billing', null],
    ['https://evil.test/x', null],
    ['//evil.test', null],
    [null, null],
  ])('%s -> %s', (href, route) => {
    expect(appRoute(href)).toBe(route);
  });
});

describe('format', () => {
  const now = new Date(2026, 10, 11, 10, 0, 0);
  it('labels days plainly', () => {
    expect(dayLabel('2026-11-11T08:00:00', now)).toBe('Today');
    expect(dayLabel('2026-11-12', now)).toBe('Tomorrow');
    expect(dayLabel('2026-11-10T23:00:00', now)).toBe('Yesterday');
  });
  it('says when a task is due or overdue, treating a bare date as a calendar day', () => {
    expect(dueLabel('2026-11-11', now)).toEqual({ text: 'Due today', overdue: false });
    expect(dueLabel('2026-11-12', now)).toEqual({ text: 'Due tomorrow', overdue: false });
    expect(dueLabel('2026-11-03', now)?.overdue).toBe(true);
    expect(dueLabel(null, now)).toBeNull();
  });
  it('counts time', () => {
    expect(ago('2026-11-11T09:59:30', now)).toBe('Just now');
    expect(ago('2026-11-11T09:45:00', now)).toBe('15 min ago');
    expect(clock(65_000)).toBe('1:05');
    expect(clock(3_725_000)).toBe('1:02:05');
  });
});

describe('inbox merge (same order as the web)', () => {
  const now = Date.parse('2026-11-11T10:00:00Z');
  const sr = (over: Partial<StatusRequest>): StatusRequest => ({
    id: 's1',
    action_id: 'a1',
    meeting_id: UUID,
    requested_at: '2026-11-11T08:00:00Z',
    state: 'pending',
    status_text: null,
    answered_at: null,
    ...over,
  });
  it('puts open items first, then priority, then newest', () => {
    const items = toInboxItems(
      {
        notifications: [
          describeNotification({ id: 'n-read', meeting_id: null, source: 'notification', alert_type: null, priority: 1, title: 'Old', body: '', link: null, payload: null, status: 'read', created_at: '2026-11-11T09:00:00Z' }),
          describeNotification({ id: 'n-low', meeting_id: null, source: 'agent_alert', alert_type: 'workload', priority: 3, title: 'FYI', body: '', link: null, payload: null, status: 'unread', created_at: '2026-11-11T09:30:00Z' }),
        ],
        updates: [toStatusView(sr({ meeting_scheduled_start: '2026-11-11T11:00:00Z' }))],
        reviews: [{ id: 'r1', kind: 'decision', content: 'Ship Friday', meeting_id: UUID, meeting_title: 'Launch', created_at: '2026-11-11T07:00:00Z' }],
      },
      now,
    );
    expect(items.map((i) => i.key)).toEqual(['update:s1', 'review:r1', 'notification:n-low', 'notification:n-read']);
    expect(inboxCounts(items)).toEqual({ all: 3, review: 1, updates: 1, notifications: 1 });
  });
  it('words a status request from the server fields', () => {
    const v = toStatusView(sr({ action_content: ' Draft the brief ', meeting_title: 'Weekly' }));
    expect(v.actionTitle).toBe('Draft the brief');
    expect(v.meetingTitle).toBe('Weekly');
    expect(toStatusView(sr({})).actionTitle).toBe('One of your open actions');
  });
  it('caps the badge', () => {
    expect(countLabel(0)).toBeNull();
    expect(countLabel(7)).toBe('7');
    expect(countLabel(140)).toBe('99+');
  });
  it('words an already-decided alert and links to decisions', () => {
    const n = describeNotification({
      id: 'n',
      meeting_id: UUID,
      source: 'agent_alert',
      alert_type: 'already_decided',
      priority: 1,
      title: '',
      body: '',
      link: null,
      payload: { decision_content: 'Use vendor B', decided_at: '2026-10-01T10:00:00Z', meeting_title: 'Ops' },
      status: 'unread',
      created_at: '2026-11-11T09:00:00Z',
    });
    expect(n.priority).toBe(2);
    expect(n.title).toBe('Already decided, raised again in Ops');
    expect(appRoute(n.href)).toBe('/decisions');
  });
});

describe('people', () => {
  it('names members: display name, then Clerk, then the email read as a name', () => {
    const m = (id: string, clerk: string | null, email: string, display_name?: string | null) => ({
      id, clerk_user_id: clerk, email, display_name, avatar_url: null, role: null, tier: 'member' as const,
    });
    const people = joinPeople(
      [
        m('u1', 'c1', 'maya@acme.test'),
        m('u2', 'c2', 'raj.patel@acme.test'),
        m('u3', 'c3', 'zoe@acme.test', ' Zoe Park '),
        m('u4', 'c4', 'a_b-c@acme.test', '  '),
      ],
      [
        { clerkUserId: 'c1', firstName: 'Maya', lastName: 'Rao', identifier: 'maya@acme.test' },
        { clerkUserId: 'c3', firstName: 'Zed', lastName: 'Clerk', identifier: 'zoe@acme.test' },
      ],
      'u2',
    );
    expect(nameFor(people, 'u1')).toBe('Maya Rao');
    expect(nameFor(people, 'u2')).toBe('You');
    expect(nameFor(people, 'u2', { you: false })).toBe('Raj Patel');
    // identity's display name beats Clerk's.
    expect(nameFor(people, 'u3')).toBe('Zoe Park');
    expect(nameFor(people, 'u4')).toBe('A B C');
    expect(nameFor(people, 'nobody')).toBe('Someone');
  });
});

describe('meetings grouping', () => {
  const m = (id: string, status: Meeting['status'], start: string | null): Meeting => ({
    id,
    status,
    scheduled_start: start,
    scheduled_end: null,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    created_by: null,
    livekit_room: null,
    title: id,
    confidential: false,
    source: 'mytheus',
    recorded_in_person: false,
  });
  it('orders live, upcoming soonest first, past newest first', () => {
    const now = Date.parse('2026-11-11T10:00:00Z');
    const g = groupMeetings(
      [
        m('past-old', 'ended', '2026-11-01T10:00:00Z'),
        m('later', 'scheduled', '2026-11-13T10:00:00Z'),
        m('live', 'live', '2026-11-11T09:30:00Z'),
        m('soon', 'scheduled', '2026-11-11T12:00:00Z'),
        m('past-new', 'ended', '2026-11-10T10:00:00Z'),
      ],
      now,
    );
    expect(g.live.map((x) => x.id)).toEqual(['live']);
    expect(g.upcoming.map((x) => x.id)).toEqual(['soon', 'later']);
    expect(g.past.map((x) => x.id)).toEqual(['past-new', 'past-old']);
  });
});

describe('sign-in steps', () => {
  it('follows Clerk statuses', () => {
    expect(nextStep({ status: 'complete' })).toBe('done');
    expect(nextStep({ status: 'needs_first_factor', supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'e1' }] })).toBe('email-code');
    expect(nextStep({ status: 'needs_first_factor', supportedFirstFactors: [{ strategy: 'password' }] })).toBe('unsupported');
    expect(nextStep({ status: 'needs_client_trust', supportedSecondFactors: [{ strategy: 'email_code', emailAddressId: 'e1' }] })).toBe('second-factor');
    expect(nextStep({ status: 'needs_new_password' })).toBe('unsupported');
  });
  it('prefers an emailed code, then an authenticator', () => {
    expect(secondFactor([{ strategy: 'totp' }, { strategy: 'email_code', emailAddressId: 'e' }])?.strategy).toBe('email_code');
    expect(secondFactor([{ strategy: 'totp' }])?.strategy).toBe('totp');
    expect(emailCodeFactor([{ strategy: 'email_code' }])).toBeNull();
  });
  it('shows Clerk prose, never a raw code', () => {
    expect(clerkMessage({ errors: [{ longMessage: 'Password is incorrect.' }] }, 'x')).toBe('Password is incorrect.');
    expect(clerkMessage(new Error('boom'), 'fallback')).toBe('fallback');
  });
});

describe('room words', () => {
  it('says why a join failed, by code', () => {
    expect(joinErrorText('NOT_A_PARTICIPANT').title).toBe('You are not on this meeting');
    expect(joinErrorText('CONNECT_FAILED').title).toBe('The call could not connect');
  });
  it('names a speaker once mapped, numbers them otherwise', () => {
    const names = new Map([[UUID, 'Maya']]);
    expect(speakerLabel(UUID, names)).toBe('Maya');
    expect(speakerLabel('1', names)).toBe('Speaker 2');
  });
});
