/**
 * Every REST call the app makes, in one place, each one checked against the generated route table
 * (`spec.ts`). Screens never call these directly; they use the hooks in `src/api/hooks/`.
 *
 * Paths are the gateway's public ones, exactly as mytheus-ui calls them:
 *   bff                  `/bff/*`, `POST /api/v1/ask`
 *   core-api             `/api/v1/*`
 *   identity             `/users`, `/users/me`
 *   meeting-service      `/api/meetings/{id}/token`, `/api/meetings/{id}/session` (NOT `/api/v1`:
 *                        the gateway sends `/api/v1/meetings` to core-api; the near-collision is
 *                        deliberate, see mytheus-ui `app/api/livekit-token/route.ts`)
 *   notification-service `/notifications`
 */

import type { ApiClient } from './client';

/** The notice version label the person agreed to (meeting-service `ConsentAck.version`). */
export type ConsentVersion = string;

export const endpoints = {
  // identity
  me: (c: ApiClient) => c.request('get', '/users/me'),
  members: (c: ApiClient) => c.request('get', '/users'),

  // bff
  dashboard: (c: ApiClient) => c.request('get', '/bff/dashboard'),
  catchUp: (c: ApiClient, meetingId: string) =>
    c.request('get', '/bff/meetings/{meeting_id}/catch-up', { path: { meeting_id: meetingId } }),
  ask: (c: ApiClient, question: string, meetingId: string | null, idempotencyKey?: string) =>
    c.request('post', '/api/v1/ask', {
      body: meetingId ? { question, meeting_id: meetingId } : { question },
      idempotencyKey,
    }),

  // notifications
  notifications: (c: ApiClient, status: 'unread' | 'read', limit = 50) =>
    c.request('get', '/notifications', { query: { status, limit } }),
  setNotificationStatus: (c: ApiClient, id: string, status: 'read' | 'dismissed', idempotencyKey?: string) =>
    c.request('patch', '/notifications/{notification_id}', {
      path: { notification_id: id },
      body: { status },
      idempotencyKey,
    }),

  // My work
  myTasks: (c: ApiClient, status: 'confirmed' | 'done') =>
    c.request('get', '/api/v1/actions/mine', { query: { status } }),
  completeTask: (c: ApiClient, id: string, idempotencyKey?: string) =>
    c.request('post', '/api/v1/actions/{action_id}/done', { path: { action_id: id }, idempotencyKey }),
  commitments: (c: ApiClient, status: 'open' | 'done' | 'dismissed') =>
    c.request('get', '/api/v1/commitments', { query: { status } }),
  setCommitmentStatus: (
    c: ApiClient,
    id: string,
    status: 'open' | 'done' | 'dismissed',
    idempotencyKey?: string,
  ) =>
    c.request('patch', '/api/v1/commitments/{commitment_id}', {
      path: { commitment_id: id },
      body: { status },
      idempotencyKey,
    }),
  statusRequests: (c: ApiClient, state: 'pending' | 'answered') =>
    c.request('get', '/api/v1/status-requests', { query: { state } }),
  answerStatusRequest: (c: ApiClient, id: string, statusText: string, idempotencyKey?: string) =>
    c.request('post', '/api/v1/status-requests/{request_id}/answer', {
      path: { request_id: id },
      body: { status_text: statusText },
      idempotencyKey,
    }),

  // decisions
  decisions: (c: ApiClient) => c.request('get', '/api/v1/decisions'),
  decisionRecord: (c: ApiClient, id: string) =>
    c.request('get', '/api/v1/decisions/{decision_id}/record', { path: { decision_id: id } }),
  decisionShareLinks: (c: ApiClient, id: string) =>
    c.request('get', '/api/v1/decisions/{decision_id}/share-links', { path: { decision_id: id } }),
  createDecisionShareLink: (c: ApiClient, id: string, idempotencyKey?: string) =>
    c.request('post', '/api/v1/decisions/{decision_id}/share-links', {
      path: { decision_id: id },
      body: { expires_in_days: 30 },
      idempotencyKey,
    }),
  confirmDecision: (c: ApiClient, id: string, idempotencyKey?: string) =>
    c.request('post', '/api/v1/decisions/{decision_id}/confirm', { path: { decision_id: id }, idempotencyKey }),
  dismissDecision: (c: ApiClient, id: string, idempotencyKey?: string) =>
    c.request('post', '/api/v1/decisions/{decision_id}/dismiss', { path: { decision_id: id }, idempotencyKey }),
  confirmAction: (c: ApiClient, id: string, idempotencyKey?: string) =>
    c.request('post', '/api/v1/actions/{action_id}/confirm', { path: { action_id: id }, idempotencyKey }),
  dismissAction: (c: ApiClient, id: string, idempotencyKey?: string) =>
    c.request('post', '/api/v1/actions/{action_id}/dismiss', { path: { action_id: id }, idempotencyKey }),

  // meetings
  meetings: (c: ApiClient, cursor?: string | null) =>
    c.request('get', '/api/v1/meetings', { query: { limit: 30, cursor: cursor ?? undefined } }),
  meeting: (c: ApiClient, id: string) =>
    c.request('get', '/api/v1/meetings/{meeting_id}', { path: { meeting_id: id } }),
  recap: (c: ApiClient, id: string) =>
    c.request('get', '/api/v1/meetings/{meeting_id}/recap', { path: { meeting_id: id } }),
  myNotes: (c: ApiClient, id: string) =>
    c.request('get', '/api/v1/meetings/{meeting_id}/worklogs', {
      path: { meeting_id: id },
      query: { user_id: 'me' },
    }),
  candidates: (c: ApiClient, id: string) =>
    c.request('get', '/api/v1/meetings/{meeting_id}/candidates', {
      path: { meeting_id: id },
      query: { include_resolved: true },
    }),
  transcript: (c: ApiClient, id: string, cursor?: string | null) =>
    c.request('get', '/api/v1/meetings/{meeting_id}/transcript', {
      path: { meeting_id: id },
      query: { limit: 500, cursor: cursor ?? undefined },
    }),
  speakers: (c: ApiClient, id: string) =>
    c.request('get', '/api/v1/meetings/{meeting_id}/speakers', { path: { meeting_id: id } }),
  setAgendaStatus: (
    c: ApiClient,
    meetingId: string,
    itemId: string,
    status: 'pending' | 'in_progress' | 'covered' | 'skipped',
    idempotencyKey?: string,
  ) =>
    c.request('patch', '/api/v1/meetings/{meeting_id}/agenda/{item_id}', {
      path: { meeting_id: meetingId, item_id: itemId },
      body: { status },
      idempotencyKey,
    }),
  endMeeting: (c: ApiClient, id: string, idempotencyKey?: string) =>
    c.request('patch', '/api/v1/meetings/{meeting_id}', {
      path: { meeting_id: id },
      body: { status: 'ended' },
      idempotencyKey,
    }),

  // meeting-service: the call
  roomSession: (c: ApiClient, id: string) =>
    c.request('get', '/api/meetings/{meeting_id}/session', { path: { meeting_id: id } }),
  mintToken: (c: ApiClient, id: string, consent: ConsentVersion | null) =>
    c.request('post', '/api/meetings/{meeting_id}/token', {
      path: { meeting_id: id },
      body: consent ? { consent: { version: consent } } : undefined,
    }),
};
