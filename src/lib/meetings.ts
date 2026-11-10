import type { Meeting } from '@/api/types';

export interface MeetingGroups {
  live: Meeting[];
  upcoming: Meeting[];
  past: Meeting[];
}

/** Live first, then what is coming soonest first, then the past newest first. */
export function groupMeetings(items: readonly Meeting[], nowMs: number = Date.now()): MeetingGroups {
  const live: Meeting[] = [];
  const upcoming: Meeting[] = [];
  const past: Meeting[] = [];
  for (const m of items) {
    if (m.status === 'live') live.push(m);
    else if (m.status === 'scheduled' && (!m.scheduled_start || Date.parse(m.scheduled_start) >= nowMs - 6 * 3600_000)) upcoming.push(m);
    else past.push(m);
  }
  const t = (m: Meeting) => Date.parse(m.scheduled_start ?? m.created_at) || 0;
  upcoming.sort((a, b) => t(a) - t(b));
  past.sort((a, b) => t(b) - t(a));
  return { live, upcoming, past };
}
