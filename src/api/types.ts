/**
 * The wire shapes this app reads, picked out of the generated OpenAPI types
 * (`src/api/generated/*`, `npm run generate:api`). Nothing here is hand-written: when the backend
 * changes a shape a screen relies on, `tsc` fails here or at the screen.
 */

import type { components as Bff } from './generated/bff';
import type { components as Core } from './generated/core-api';
import type { components as Identity } from './generated/identity-tenant-service';
import type { components as MeetingSvc } from './generated/meeting-service';
import type { components as Notif } from './generated/notification-service';

type CoreS = Core['schemas'];
type BffS = Bff['schemas'];

// Errors (every service emits the same enum; any document is authoritative).
export type ErrorCode = CoreS['ErrorCode'];
export type Problem = CoreS['Problem'];

// Identity
export type UserProfile = Identity['schemas']['UserProfile'];
export type Member = Identity['schemas']['Member'];

// bff
export type Dashboard = BffS['Dashboard'];
export type DashboardMeeting = BffS['DashboardMeeting'];
export type DashboardRecentMeeting = BffS['DashboardRecentMeeting'];
export type DashboardReviewItem = BffS['DashboardReviewItem'];
export type DashboardDecision = BffS['DashboardDecision'];
export type MeetingCatchUp = BffS['MeetingCatchUp'];
export type AskRequest = BffS['AskRequest'];
export type AskAnswer = BffS['AskAnswer'];
export type AskCitation = BffS['AskCitation'];

// core-api: work
export type Task = CoreS['Task'];
export type MyTask = CoreS['MyTask'];
export type Commitment = CoreS['Commitment'];
export type CommitmentStatus = CoreS['Commitment']['status'];
export type StatusRequest = CoreS['StatusRequest'];

// core-api: decisions
export type DecisionLogEntry = CoreS['DecisionLogEntry'];
export type DecisionRecord = CoreS['DecisionRecord'];
export type LineageStep = CoreS['LineageStep'];
export type RecordAction = CoreS['RecordAction'];
export type ShareLink = CoreS['ShareLink'];
export type Decision = CoreS['Decision'];
export type ActionItem = CoreS['ActionItem'];

// core-api: meetings
export type Meeting = CoreS['Meeting'];
export type MeetingDetail = CoreS['MeetingDetail'];
export type MeetingStatus = CoreS['Meeting']['status'];
export type MeetingRecap = CoreS['MeetingRecap'];
export type AgendaItem = CoreS['AgendaItem'];
export type AgendaStatus = CoreS['AgendaItem']['status'];
export type Worklog = CoreS['Worklog'];
export type TranscriptChunk = CoreS['TranscriptChunk'];
export type CandidateList = CoreS['CandidateList'];

// core-api: in-person capture
export type CaptureStatus = CoreS['CaptureStatus'];
export type CaptureSession = CoreS['CaptureSession'];

// meeting-service
export type TokenResponse = MeetingSvc['schemas']['TokenResponse'];
export type RoomSession = MeetingSvc['schemas']['RoomSession'];

// notification-service
export type NotificationRow = Notif['schemas']['NotificationRow'];
export type PushDevice = Notif['schemas']['PushDevice'];
export type PushDeviceList = Notif['schemas']['PushDeviceList'];

// core-api voice (ADR-0050)
export type VoicesView = CoreS['VoicesView'];
export type VoiceOption = CoreS['VoiceOption'];
