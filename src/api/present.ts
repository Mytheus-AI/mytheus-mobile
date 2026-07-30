/**
 * Wire types to view models. The one place `snake_case` becomes `camelCase`.
 *
 * The important rule here is what these functions REFUSE to do. `MeetingCard` was written
 * against the mock, which supplied `durationMin`, `speakers` and summary `chips`. None of
 * those exist in the backend yet: duration and speaker counts come from transcription
 * (Plan 3-4) and the chips come from agent results (Plan 7-9).
 *
 * So they are left UNDEFINED rather than defaulted to `0` or `[]`-with-a-placeholder. A `0`
 * would render as "0 min - 0 speakers", which is a fabricated fact presented as a real one,
 * and the CLAUDE.md invariant is explicit that durable truth is never invented client-side.
 * The card omits what it does not have; when those bands land, the mapper fills the fields in
 * and nothing else changes.
 */

import type { DashboardMeeting, Meeting, MeetingStatus } from './types';

export interface MeetingCardModel {
  id: string;
  title: string;
  /** Human-relative label derived from `scheduled_start`. */
  when: string;
  status: MeetingStatus;
  /** Absent until the transcription band. Not zero. */
  durationMin?: number;
  /** Absent until the transcription band. Not zero. */
  speakers?: number;
  /** Absent until the agent band. */
  chips?: { kind: 'action' | 'decision' | 'keypoints'; label: string }[];
}

const DAY_MS = 86_400_000;

/**
 * A short relative label. Intl-free on purpose: `Intl.RelativeTimeFormat` is not reliably
 * present across every Hermes build this app ships on, and a missing Intl would crash the
 * whole list rather than degrade one label.
 */
export function relativeWhen(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Unscheduled';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Unscheduled';

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(then) - startOfDay(now)) / DAY_MS);

  if (days === 0) {
    return then.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days < 7) return then.toLocaleDateString(undefined, { weekday: 'short' });
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function toMeetingCard(m: DashboardMeeting | Meeting, now?: Date): MeetingCardModel {
  return {
    id: m.id,
    // The server allows a null title; the card needs something to render. "Untitled meeting"
    // is a presentation default, not invented data.
    title: m.title ?? 'Untitled meeting',
    when: relativeWhen(m.scheduled_start, now),
    status: m.status,
  };
}

/**
 * Bridge for the screens still reading the mock: the library and the person detail.
 *
 * They render past-meeting summaries with durations, speaker counts and agent chips, and none
 * of that has a backend until Plan 3-4 and Plan 7-9. This adapter exists so `MeetingCard`
 * has ONE prop type while those screens migrate band by band, instead of the component
 * carrying two shapes. Delete it when the last mock screen is rewired.
 */
export function fromMockMeeting(m: {
  id: string;
  title: string;
  when: string;
  durationMin: number;
  speakers: number;
  chips: { kind: 'action' | 'decision' | 'keypoints'; label: string }[];
}): MeetingCardModel {
  return {
    id: m.id,
    title: m.title,
    when: m.when,
    // These screens only ever show meetings that already happened.
    status: 'ended',
    durationMin: m.durationMin,
    speakers: m.speakers,
    chips: m.chips,
  };
}
