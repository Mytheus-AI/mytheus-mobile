import { mockParams, mockRouter, resetMocks } from './helpers/mocks';
import React from 'react';
import { Share } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { fakeApi, renderWithApi } from './helpers/render';
import Inbox from '../app/(app)/(tabs)/inbox';
import Work from '../app/(app)/(tabs)/work';
import Ask from '../app/(app)/(tabs)/ask';
import Home from '../app/(app)/(tabs)/index';
import Join from '../app/(app)/meetings/[meetingId]/join';
import DecisionScreen from '../app/(app)/decisions/[decisionId]';
import { ApiError } from '@/api/client';
import { CONSENT_VERSION } from '@/components/feature/Consent';

const M = '0b6a3c43-2f5d-4f4b-9a8e-0a1b2c3d4e5f';
const D = '5d2e8f10-7a1b-4c3d-9e8f-0a1b2c3d4e5f';

const arm = <T,>(items: T[]) => ({ status: items.length ? 'ok' : 'empty', items });
const dashboard = (over: Record<string, unknown> = {}) => ({
  upcoming_meetings: arm([]),
  recent_meetings: arm([]),
  action_items: arm([]),
  decisions: arm([]),
  needs_review: arm([]),
  worklogs: arm([]),
  ...over,
});

beforeEach(() => resetMocks());

describe('Inbox', () => {
  it('merges notifications, updates owed and detections, and confirms a detection', async () => {
    const api = fakeApi({
      'GET /notifications': ({ query }: { query?: Record<string, unknown> }) => ({
        items:
          query?.status === 'unread'
            ? [{ id: 'n1', meeting_id: M, source: 'agent_alert', alert_type: 'conflict', priority: 1, title: 'Budget conflict', body: 'Raj and Priya disagree.', link: `/meetings/${M}`, payload: {}, status: 'unread', created_at: new Date().toISOString(), read_at: null, dismissed_at: null }]
            : [],
      }),
      'GET /api/v1/status-requests': { items: [{ id: 's1', action_id: 'a1', meeting_id: M, requested_at: new Date().toISOString(), state: 'pending', status_text: null, answered_at: null, action_content: 'Draft the launch brief', meeting_title: 'Weekly sync' }] },
      'GET /bff/dashboard': dashboard({ needs_review: arm([{ id: D, kind: 'decision', content: 'Ship on Friday', meeting_id: M, meeting_title: 'Launch review', created_at: new Date().toISOString() }]) }),
      'POST /api/v1/decisions/{decision_id}/confirm': { id: D, status: 'confirmed' },
    });
    renderWithApi(<Inbox />, api.client);
    expect(await screen.findByText('Budget conflict')).toBeTruthy();
    expect(screen.getByText('Draft the launch brief')).toBeTruthy();
    expect(screen.getByText('Ship on Friday')).toBeTruthy();
    expect(screen.getByText('3 waiting on you')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Confirm decision'));
    await waitFor(() => expect(api.calls.map((c) => c.key)).toContain('POST /api/v1/decisions/{decision_id}/confirm'));
    const confirm = api.calls.find((c) => c.key === 'POST /api/v1/decisions/{decision_id}/confirm');
    expect(confirm?.opts.path).toEqual({ decision_id: D });
    expect((confirm?.opts as { idempotencyKey?: string }).idempotencyKey).toBeTruthy();
    expect(await screen.findByText('Decision confirmed')).toBeTruthy();
  });

  it('keeps the rest of the inbox when one part fails, and says which', async () => {
    const api = fakeApi({
      'GET /notifications': new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'down'),
      'GET /api/v1/status-requests': { items: [] },
      'GET /bff/dashboard': dashboard(),
    });
    renderWithApi(<Inbox />, api.client);
    expect(await screen.findByText(/could not be loaded: your notifications/)).toBeTruthy();
    expect(screen.getByText('Nothing is waiting on you')).toBeTruthy();
  });
});

describe('My work', () => {
  it('lists tasks from /actions/mine including ones with no meeting, and marks done at once', async () => {
    const done = jest.fn(() => ({ id: 'a2', status: 'done' }));
    const api = fakeApi({
      'GET /api/v1/actions/mine': ({ query }: { query?: Record<string, unknown> }) => ({
        items:
          query?.status === 'confirmed'
            ? [
                { id: 'a1', assignee_id: 'u', confidence: 1, content: 'Send the deck', created_at: '2026-11-10T10:00:00Z', due_date: null, meeting_id: M, meeting_title: 'Launch review', status: 'confirmed' },
                { id: 'a2', assignee_id: 'u', confidence: 1, content: 'Book the venue', created_at: '2026-11-10T10:00:00Z', due_date: null, meeting_id: null, meeting_title: null, status: 'confirmed' },
              ]
            : [],
      }),
      'GET /api/v1/commitments': { items: [] },
      'GET /api/v1/status-requests': { items: [] },
      'POST /api/v1/actions/{action_id}/done': done,
    });
    renderWithApi(<Work />, api.client);
    expect(await screen.findByText('Book the venue')).toBeTruthy();
    expect(screen.getByText('No meeting')).toBeTruthy();
    expect(screen.getByText('Launch review')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Mark done: Book the venue'));
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Task done')).toBeTruthy();
  });

  it('Undo reopens the task on the server', async () => {
    let status = 'confirmed';
    const task = { id: 'a1', assignee_id: 'u', confidence: 1, content: 'Send the deck', created_at: '2026-11-10T10:00:00Z', due_date: null, meeting_id: null, meeting_title: null };
    const done = jest.fn(() => {
      status = 'done';
      return { ...task, status };
    });
    const reopen = jest.fn(() => {
      status = 'confirmed';
      return { ...task, status };
    });
    const api = fakeApi({
      'GET /api/v1/actions/mine': ({ query }: { query?: Record<string, unknown> }) => ({
        items: query?.status === status ? [{ ...task, status }] : [],
      }),
      'GET /api/v1/commitments': { items: [] },
      'GET /api/v1/status-requests': { items: [] },
      'POST /api/v1/actions/{action_id}/done': done,
      'POST /api/v1/actions/{action_id}/reopen': reopen,
    });
    renderWithApi(<Work />, api.client);
    fireEvent.press(await screen.findByLabelText('Mark done: Send the deck'));
    fireEvent.press(await screen.findByLabelText('Undo'));
    await waitFor(() => expect(reopen).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Send the deck')).toBeTruthy();
  });

  it('shows promises and answers an update owed', async () => {
    mockParams.current = { tab: 'updates' };
    const answer = jest.fn(() => ({ id: 's1', state: 'answered' }));
    const api = fakeApi({
      'GET /api/v1/actions/mine': { items: [] },
      'GET /api/v1/commitments': { items: [] },
      'GET /api/v1/status-requests': ({ query }: { query?: Record<string, unknown> }) => ({
        items: query?.state === 'pending' ? [{ id: 's1', action_id: 'a1', meeting_id: M, requested_at: '2026-11-11T08:00:00Z', state: 'pending', status_text: null, answered_at: null, action_content: 'Draft the launch brief', meeting_title: 'Weekly sync' }] : [],
      }),
      'POST /api/v1/status-requests/{request_id}/answer': answer,
    });
    renderWithApi(<Work />, api.client);
    fireEvent.press(await screen.findByLabelText('Answer'));
    fireEvent.changeText(screen.getByLabelText('Your update'), 'Done, sent to legal');
    fireEvent.press(screen.getByLabelText('Send update'));
    await waitFor(() => expect(answer).toHaveBeenCalled());
    expect(api.calls.find((c) => c.key.startsWith('POST /api/v1/status-requests'))?.opts.body).toEqual({ status_text: 'Done, sent to legal' });
  });
});

describe('Ask', () => {
  it('asks bff and shows the answer with its numbered sources', async () => {
    const api = fakeApi({
      'GET /api/v1/meetings': { items: [] },
      'POST /api/v1/ask': {
        question: 'When do we ship?',
        answer: 'We ship on Friday [1].',
        abstained: false,
        degraded: false,
        citations: [{ n: 1, kind: 'decision', text: 'Ship on Friday', meeting_id: M, meeting_title: 'Launch review', decision_id: D }],
      },
    });
    renderWithApi(<Ask />, api.client);
    fireEvent.changeText(screen.getByLabelText('Your question'), 'When do we ship?');
    fireEvent.press(screen.getByLabelText('Ask'));
    expect(await screen.findByText(/We ship on Friday/)).toBeTruthy();
    expect(api.calls.find((c) => c.key === 'POST /api/v1/ask')?.opts.body).toEqual({ question: 'When do we ship?' });
    fireEvent.press(screen.getByLabelText(/^Source 1\./));
    expect(mockRouter.push).toHaveBeenCalledWith(`/decisions/${D}`);
  });

  it('says so honestly when it abstains', async () => {
    const api = fakeApi({
      'GET /api/v1/meetings': { items: [] },
      'POST /api/v1/ask': { question: 'x', answer: null, abstained: true, degraded: false, citations: [] },
    });
    renderWithApi(<Ask />, api.client);
    fireEvent.press(screen.getByLabelText('Ask: What did I agree to do this week?'));
    expect(await screen.findByText(/I could not find that/)).toBeTruthy();
  });

  it('explains a 503 and offers to try again', async () => {
    const api = fakeApi({
      'GET /api/v1/meetings': { items: [] },
      'POST /api/v1/ask': new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'down'),
    });
    renderWithApi(<Ask />, api.client);
    fireEvent.press(screen.getByLabelText('Ask: What did I agree to do this week?'));
    expect(await screen.findByText('Ask is not available right now. Try again in a moment.')).toBeTruthy();
    expect(screen.getByLabelText('Try again')).toBeTruthy();
  });
});

describe('Join (consent at join)', () => {
  it('shows the notice when consent is needed and carries its version into the room', async () => {
    mockParams.current = { meetingId: M };
    const api = fakeApi({
      'GET /api/v1/meetings/{meeting_id}': { id: M, title: 'Launch review', status: 'live', scheduled_start: null, scheduled_end: null, created_at: '', updated_at: '', created_by: null, livekit_room: 'r' },
      'GET /api/meetings/{meeting_id}/session': { consent_required: true, consent_version: null, consented_at: null, ended: false, recording: false, started_at: null },
    });
    renderWithApi(<Join />, api.client);
    expect(await screen.findByText('Audio and video are not recorded')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Agree and join'));
    expect(mockRouter.replace).toHaveBeenCalledWith(`/meetings/${M}/room?consent=${CONSENT_VERSION}`);
  });

  it('goes straight in when you already agreed for this meeting', async () => {
    mockParams.current = { meetingId: M };
    const api = fakeApi({
      'GET /api/v1/meetings/{meeting_id}': { id: M, title: 'Launch review', status: 'live', scheduled_start: null, scheduled_end: null, created_at: '', updated_at: '', created_by: null, livekit_room: 'r' },
      'GET /api/meetings/{meeting_id}/session': { consent_required: true, consent_version: CONSENT_VERSION, consented_at: '2026-11-11T09:00:00Z', ended: false, recording: false, started_at: null },
    });
    renderWithApi(<Join />, api.client);
    fireEvent.press(await screen.findByLabelText('Join meeting'));
    expect(mockRouter.replace).toHaveBeenCalledWith(`/meetings/${M}/room`);
  });
});

describe('Decision record', () => {
  it('shows lineage and creates a share link', async () => {
    mockParams.current = { decisionId: D };
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const api = fakeApi({
      'GET /api/v1/decisions/{decision_id}/record': {
        decision_id: D,
        content: 'Ship on Friday',
        rationale: 'QA signed off',
        decided_at: '2026-11-10T10:00:00Z',
        meeting_id: M,
        meeting_title: 'Launch review',
        status: 'confirmed',
        confirmed_by_name: 'Maya Rao',
        meeting_actions: [],
        lineage: [
          { relation: 'earlier', visible: true, decision_id: 'e1', content: 'Ship on Monday', meeting_title: 'Planning', status: 'superseded', decided_at: '2026-11-01T10:00:00Z' },
          { relation: 'subject', visible: true, decision_id: D, content: 'Ship on Friday', meeting_title: 'Launch review', status: 'confirmed', decided_at: '2026-11-10T10:00:00Z' },
          { relation: 'later', visible: false },
        ],
      },
      'GET /api/v1/decisions/{decision_id}/share-links': { items: [] },
      'POST /api/v1/decisions/{decision_id}/share-links': { id: 'l1', url: 'https://mytheus.cloud/s/tok', state: 'active', token: 'tok', kind: 'decision_record', expires_at: '2026-12-10T10:00:00Z', created_at: '', created_by: 'u', meeting_id: M, view_count: 0, can_revoke: true },
    });
    renderWithApi(<DecisionScreen />, api.client);
    expect(await screen.findByText('Ship on Monday')).toBeTruthy();
    expect(screen.getByText('A decision from a meeting you were not in.')).toBeTruthy();
    expect(screen.getByText(/Confirmed by Maya Rao/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Create share link'));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://mytheus.cloud/s/tok' })));
  });
});

describe('Home', () => {
  it('leads with the next meeting and a way to join', async () => {
    const api = fakeApi({
      'GET /bff/dashboard': dashboard({
        upcoming_meetings: arm([{ id: M, title: 'Launch review', status: 'live', scheduled_start: null, scheduled_end: null, livekit_room: 'r' }]),
      }),
      'GET /notifications': { items: [] },
      'GET /api/v1/status-requests': { items: [] },
    });
    renderWithApi(<Home />, api.client);
    expect(await screen.findByText('Happening now')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Join meeting'));
    expect(mockRouter.push).toHaveBeenCalledWith(`/meetings/${M}/join`);
  });
  it('offers no Join for a meeting recorded in person', async () => {
    const api = fakeApi({
      'GET /bff/dashboard': dashboard({
        upcoming_meetings: arm([{ id: M, title: 'Design crit', status: 'live', scheduled_start: null, scheduled_end: null, livekit_room: null, recorded_in_person: true }]),
      }),
      'GET /notifications': { items: [] },
      'GET /api/v1/status-requests': { items: [] },
    });
    renderWithApi(<Home />, api.client);
    expect(await screen.findByText('Recording in person now')).toBeTruthy();
    expect(screen.queryByLabelText('Join meeting')).toBeNull();
    expect(screen.getByLabelText('Details')).toBeTruthy();
  });
});
