/**
 * Wire types for the `bff` and `core-api` reads this band consumes.
 *
 * Hand-written for now and matched to the FastAPI response models by name. They are replaced
 * by a generated client once the OpenAPI specs are emitted from code (recorded as an open gap
 * in the band file); until then this file is the one place wire drift can hide, which is why
 * it is small and separate from the screens.
 */

/** Every `bff` panel carries its own status. `empty` and `degraded` are NOT the same thing:
 *  one means "you have nothing", the other means "we could not load it", and they call for
 *  different empty states. Collapsing them shows an error where there is none, or hides one. */
export type ArmStatus = 'ok' | 'degraded' | 'empty';

export interface Arm<T> {
  status: ArmStatus;
  items: T[];
}

export type MeetingStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';

export interface DashboardMeeting {
  id: string;
  title: string | null;
  status: MeetingStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  livekit_room: string | null;
}

export interface Dashboard {
  upcoming_meetings: Arm<DashboardMeeting>;
  action_items: Arm<unknown>;
  worklogs: Arm<unknown>;
  decisions: Arm<unknown>;
}

export interface Participant {
  user_id: string;
  role_in_meeting: string | null;
}

export interface Meeting {
  id: string;
  title: string | null;
  status: MeetingStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  livekit_room: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  participants: Participant[];
}

/** Cursor pagination, never offset. `next_cursor` is opaque: build no logic on its contents. */
export interface MeetingPage {
  items: Meeting[];
  next_cursor: string | null;
}

export interface Team {
  id: string;
  name: string;
  department_id: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}
