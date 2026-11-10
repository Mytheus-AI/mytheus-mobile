/**
 * Socket payload types the room reads, from the realtime-gateway `/v1` contract
 * (mytheus-realtime `services/realtime-gateway/src/server.ts` and `roomEvents.ts` on main).
 *
 * The gateway relays these from the agents' pub/sub channel and its own room events; they are
 * not in any OpenAPI document, so they are written here once, verbatim from the gateway's
 * contract comments, and mirror mytheus-ui `src/lib/api/meeting-agenda-types.ts`. REST shapes
 * come from the generated OpenAPI types instead (`src/api/types.ts`).
 */

import type { AgendaItem, AgendaStatus } from '@/api/types';

export type { AgendaItem, AgendaStatus };

/** `"agent-agenda"` socket payload (ADR-0038 D7), to everyone in the meeting. */
export interface AgentAgendaPayload {
  itemId: string;
  status: AgendaStatus;
  note: string | null;
}

export type NudgeType = 'off_agenda' | 'over_time' | 'unaddressed' | 'proxy_update';

/** `"agent-nudge"` socket payload (ADR-0038 D9), to the host's sockets only. */
export interface AgentNudgePayload {
  id: string;
  type: NudgeType;
  itemId: string | null;
  content: string;
  userId?: string | null;
}

/** What the gateway answers to a room event (roomEvents.ts). */
export type RoomAck =
  | ({ ok: true } & Record<string, unknown>)
  | ({ ok: false; error: string } & Record<string, unknown>);

/** `"join"` ack (server.ts). */
export interface JoinAck {
  ok: boolean;
  presence?: string[];
  error?: 'FORBIDDEN' | 'INVALID_PAYLOAD';
}

/** Every room broadcast is wrapped as `{ meetingId, payload }`. */
export interface Wrapped<P> {
  meetingId?: string;
  payload?: P;
}

/** `"meeting-ended"` payload. */
export interface MeetingEndedPayload {
  byUserId: string;
  at: string;
}

/** `"room-state"` payload, to the joining socket only. */
export interface RoomStatePayload {
  locks?: { candidateId: string; byUserId: string; until: number }[];
  hands?: { userId: string; at: string }[];
}
