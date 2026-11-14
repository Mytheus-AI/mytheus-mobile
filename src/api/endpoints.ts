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
 *   notification-service `/notifications`, `/notifications/push-devices`
 *   core-api capture     `/api/v1/capture/*` (in-person recording on the phone)
 *   core-api voice       `/api/v1/voice/*` (every Myte speaks with the self-hosted Kokoro voice)
 */

import type { ApiClient } from './client';

/** The notice version label the person agreed to (meeting-service `ConsentAck.version`). */
export type ConsentVersion = string;

/** What `POST /api/v1/voice/speech` takes: 1..1500 characters, speed 0.7..1.4. */
export interface SpeechBody {
  text: string;
  voice?: string | null;
  speed?: number;
  language?: string;
}

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

  // push (notification-service): this phone's Expo push token for the signed-in person
  pushDevices: (c: ApiClient) => c.request('get', '/notifications/push-devices'),
  registerPushDevice: (c: ApiClient, token: string, platform: 'ios' | 'android', idempotencyKey?: string) =>
    c.request('post', '/notifications/push-devices', { body: { token, platform }, idempotencyKey }),
  unregisterPushDevice: (c: ApiClient, id: string, idempotencyKey?: string) =>
    c.request('delete', '/notifications/push-devices/{device_id}', { path: { device_id: id }, idempotencyKey }),

  // core-api: the voice every Myte speaks with (ADR-0050)
  voices: (c: ApiClient) => c.request('get', '/api/v1/voice/voices'),
  chooseVoice: (c: ApiClient, voice: string | null, idempotencyKey?: string) =>
    c.request('put', '/api/v1/voice/preference', { body: { voice }, idempotencyKey }),
  /** MP3 bytes; 429 over 30 a minute, 503 `voice_not_connected` when the voice is off. */
  speech: (c: ApiClient, b: SpeechBody) =>
    c.requestBytes('post', '/api/v1/voice/speech', {
      // No voice named: the server speaks with the person's choice, else their Myte's pick.
      body: { text: b.text, ...(b.voice ? { voice: b.voice } : {}), speed: b.speed ?? 1, language: b.language ?? 'en' },
    }),

  // core-api: a briefing from your agent (the caller's own)
  latestBriefing: (c: ApiClient) => c.request('get', '/api/v1/briefings/latest'),
  briefing: (c: ApiClient, id: string) =>
    c.request('get', '/api/v1/briefings/{briefing_id}', { path: { briefing_id: id } }),
  meetingBriefing: (c: ApiClient, meetingId: string) =>
    c.request('get', '/api/v1/meetings/{meeting_id}/briefing', { path: { meeting_id: meetingId } }),
  briefMe: (c: ApiClient, meetingId: string | null, idempotencyKey?: string) =>
    c.request('post', '/api/v1/briefings', { body: meetingId ? { meeting_id: meetingId } : {}, idempotencyKey }),
  briefingHeard: (c: ApiClient, id: string, idempotencyKey?: string) =>
    c.request('post', '/api/v1/briefings/{briefing_id}/listened', { path: { briefing_id: id }, idempotencyKey }),
  briefingAudio: (c: ApiClient, id: string) =>
    c.request('get', '/api/v1/briefings/{briefing_id}/audio', { path: { briefing_id: id } }),
  briefingPreferences: (c: ApiClient) => c.request('get', '/api/v1/briefings/preferences'),
  saveBriefingPreferences: (
    c: ApiClient,
    body: {
      enabled: boolean;
      auto_play: boolean;
      length: 'short' | 'standard';
      language: string;
      voice: string | null;
      server_voice: string | null;
      rate: number;
    },
    idempotencyKey?: string,
  ) => c.request('put', '/api/v1/briefings/preferences', { body, idempotencyKey }),

  // My work
  myTasks: (c: ApiClient, status: 'confirmed' | 'done') =>
    c.request('get', '/api/v1/actions/mine', { query: { status } }),
  completeTask: (c: ApiClient, id: string, idempotencyKey?: string) =>
    c.request('post', '/api/v1/actions/{action_id}/done', { path: { action_id: id }, idempotencyKey }),
  reopenTask: (c: ApiClient, id: string, idempotencyKey?: string) =>
    c.request('post', '/api/v1/actions/{action_id}/reopen', { path: { action_id: id }, idempotencyKey }),
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
      body: { expires_in_days: 30, confirm_confidential: false },
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

  // core-api: recording an in-person meeting on this phone
  captureStatus: (c: ApiClient) => c.request('get', '/api/v1/capture/status'),
  startCapture: (c: ApiClient, title: string | null, consentAt: string, idempotencyKey?: string) =>
    c.request('post', '/api/v1/capture/sessions', {
      body: title ? { title, consent: true, consent_at: consentAt } : { consent: true, consent_at: consentAt },
      idempotencyKey,
    }),
  refreshCapture: (c: ApiClient, meetingId: string, consentAt: string, idempotencyKey?: string) =>
    c.request('post', '/api/v1/capture/sessions/{meeting_id}/refresh', {
      path: { meeting_id: meetingId },
      body: { consent_at: consentAt },
      idempotencyKey,
    }),
  endCapture: (c: ApiClient, meetingId: string, idempotencyKey?: string) =>
    c.request('post', '/api/v1/capture/sessions/{meeting_id}/end', { path: { meeting_id: meetingId }, idempotencyKey }),

  // meeting-service: the call
  roomSession: (c: ApiClient, id: string) =>
    c.request('get', '/api/meetings/{meeting_id}/session', { path: { meeting_id: id } }),
  mintToken: (c: ApiClient, id: string, consent: ConsentVersion | null) =>
    c.request('post', '/api/meetings/{meeting_id}/token', {
      path: { meeting_id: id },
      body: consent ? { consent: { version: consent } } : undefined,
    }),
};
