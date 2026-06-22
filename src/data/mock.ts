import { colors } from '@/theme/tokens';

/**
 * Mock content for the Meeting Pod flow. In production this is replaced by
 * data from reprise-backend (bff) over REST and live events from
 * reprise-realtime over WSS. Shapes here mirror what those contracts return.
 */

export type ChipKind = 'action' | 'decision' | 'keypoints';

export interface MeetingChip {
  kind: ChipKind;
  label: string;
}

export interface RecentMeeting {
  id: string;
  title: string;
  when: string;
  durationMin: number;
  speakers: number;
  chips: MeetingChip[];
}

export const recentMeetings: RecentMeeting[] = [
  {
    id: 'q3-roadmap-sync',
    title: 'Q3 Roadmap Sync',
    when: 'Today',
    durationMin: 24,
    speakers: 3,
    chips: [
      { kind: 'action', label: '3 actions' },
      { kind: 'decision', label: '1 decision' },
    ],
  },
  {
    id: 'design-review-pod-v2',
    title: 'Design Review — Pod v2',
    when: 'Yesterday',
    durationMin: 41,
    speakers: 4,
    chips: [
      { kind: 'action', label: '5 actions' },
      { kind: 'keypoints', label: '8 key points' },
    ],
  },
  {
    id: 'hiring-loop-debrief',
    title: 'Hiring Loop Debrief',
    when: 'Mon',
    durationMin: 18,
    speakers: 5,
    chips: [{ kind: 'decision', label: '2 decisions' }],
  },
];

export interface TranscriptLineData {
  id: string;
  initial: string;
  color: string;
  name: string;
  time: string;
  text: string;
  live?: boolean;
  partial?: boolean;
}

export const liveTranscript: TranscriptLineData[] = [
  {
    id: 't1',
    initial: 'P',
    color: colors.speakerP,
    name: 'Priya',
    time: '12:31',
    text: "Let's lock the launch date before we scope anything else.",
  },
  {
    id: 't2',
    initial: 'M',
    color: colors.speakerM,
    name: 'Marcus',
    time: '12:33',
    text: "I'd push for the 14th - that gives QA a full week.",
  },
  {
    id: 't3',
    initial: 'D',
    color: colors.speakerD,
    name: 'Dana',
    time: 'now',
    text: 'Agreed. We should loop in support before we',
    live: true,
    partial: true,
  },
];

export const fullTranscript: TranscriptLineData[] = [
  liveTranscript[0],
  liveTranscript[1],
  {
    id: 't3-final',
    initial: 'D',
    color: colors.speakerD,
    name: 'Dana',
    time: '12:34',
    text: 'Agreed. We should loop in support before we commit publicly.',
  },
  {
    id: 't4',
    initial: 'P',
    color: colors.speakerP,
    name: 'Priya',
    time: '12:36',
    text: "I'll get the scope doc circulated by end of day.",
  },
];

export const keyPoints: string[] = [
  'Team is aligning on Q3 launch scope and sequencing.',
  'QA flagged it needs a full week of lead time before release.',
];

export const decisionText =
  'Launch date set for the 14th to protect the QA window.';

export const overviewText =
  'The team aligned on shipping Q3 on the 14th, protecting a full QA week, and agreed to loop in support before launch.';

export interface ActionItem {
  id: 'a' | 'b' | 'c';
  text: string;
  owner: string;
}

export const actionItems: ActionItem[] = [
  { id: 'a', text: 'Loop in the support team before launch.', owner: 'Dana' },
  { id: 'b', text: 'Confirm the QA window with engineering.', owner: 'Marcus' },
  { id: 'c', text: 'Circulate the final scope doc.', owner: 'Priya' },
];

export const session = {
  title: 'Q3 Roadmap Sync',
  location: 'Conference Room B',
  mode: 'In-person',
  activeSpeakers: 3,
};

/* ----------------------------------------------------------------------------
 * People directory
 * ------------------------------------------------------------------------- */
export interface Person {
  id: string;
  name: string;
  initial: string;
  color: string;
  role: string;
  meetings: number;
  openActions: number;
  lastMet: string;
}

export const people: Person[] = [
  { id: 'priya', name: 'Priya Nair', initial: 'P', color: colors.speakerP, role: 'Product Lead', meetings: 12, openActions: 1, lastMet: 'Today' },
  { id: 'marcus', name: 'Marcus Lee', initial: 'M', color: colors.speakerM, role: 'Engineering', meetings: 9, openActions: 2, lastMet: 'Today' },
  { id: 'dana', name: 'Dana Cruz', initial: 'D', color: colors.speakerD, role: 'Support', meetings: 7, openActions: 1, lastMet: 'Today' },
  { id: 'aisha', name: 'Aisha Khan', initial: 'A', color: '#6E7F6A', role: 'Design', meetings: 5, openActions: 1, lastMet: 'Yesterday' },
  { id: 'tom', name: 'Tom Reyes', initial: 'T', color: '#9A7B4F', role: 'QA', meetings: 4, openActions: 1, lastMet: 'Mon' },
  { id: 'sara', name: 'Sara Lindqvist', initial: 'S', color: '#7A6A53', role: 'Marketing', meetings: 3, openActions: 0, lastMet: 'Last week' },
];

/* ----------------------------------------------------------------------------
 * Action items aggregated across every meeting (Actions tab)
 * ------------------------------------------------------------------------- */
export interface AggAction {
  id: string;
  text: string;
  owner: string;
  meeting: string;
  when: string;
  done: boolean;
}

export const allActions: AggAction[] = [
  { id: 'q3-a', text: 'Loop in the support team before launch.', owner: 'Dana', meeting: 'Q3 Roadmap Sync', when: 'Today', done: false },
  { id: 'q3-b', text: 'Confirm the QA window with engineering.', owner: 'Marcus', meeting: 'Q3 Roadmap Sync', when: 'Today', done: false },
  { id: 'q3-c', text: 'Circulate the final scope doc.', owner: 'Priya', meeting: 'Q3 Roadmap Sync', when: 'Today', done: false },
  { id: 'dr-a', text: 'Revisit the Pod v2 onboarding copy.', owner: 'Aisha', meeting: 'Design Review — Pod v2', when: 'Yesterday', done: false },
  { id: 'dr-b', text: 'Prototype the live-caption settings panel.', owner: 'Marcus', meeting: 'Design Review — Pod v2', when: 'Yesterday', done: true },
  { id: 'hl-a', text: 'Share interview scorecards with the panel.', owner: 'Tom', meeting: 'Hiring Loop Debrief', when: 'Mon', done: false },
];

/* ----------------------------------------------------------------------------
 * Library - the full session archive, grouped by recency
 * ------------------------------------------------------------------------- */
export interface SessionGroup {
  label: string;
  items: RecentMeeting[];
}

const olderSessions: RecentMeeting[] = [
  {
    id: 'weekly-standup',
    title: 'Weekly Standup',
    when: 'Mon',
    durationMin: 12,
    speakers: 6,
    chips: [{ kind: 'action', label: '4 actions' }],
  },
  {
    id: 'customer-onsite',
    title: 'Customer Onsite — Northwind',
    when: 'Last week',
    durationMin: 52,
    speakers: 4,
    chips: [
      { kind: 'decision', label: '2 decisions' },
      { kind: 'keypoints', label: '11 key points' },
    ],
  },
  {
    id: 'board-prep',
    title: 'Board Prep',
    when: 'Last week',
    durationMin: 35,
    speakers: 3,
    chips: [{ kind: 'action', label: '6 actions' }],
  },
];

export const librarySessions: SessionGroup[] = [
  { label: 'Today', items: [recentMeetings[0]] },
  { label: 'This week', items: [recentMeetings[1], recentMeetings[2], olderSessions[0]] },
  { label: 'Earlier', items: [olderSessions[1], olderSessions[2]] },
];

export const libraryFilters = ['All', 'In-person', 'Decisions', 'Actions'] as const;

/* ----------------------------------------------------------------------------
 * Ask Reprise
 * ------------------------------------------------------------------------- */
export const askSuggestions: string[] = [
  'What did I commit to this week?',
  'Summarize the Q3 Roadmap Sync',
  'What decisions were made yesterday?',
  'List open action items for Marcus',
];

export interface AskThread {
  id: string;
  question: string;
  answer: string;
  when: string;
}

export const recentQuestions: AskThread[] = [
  {
    id: 'aq1',
    question: 'What is the Q3 launch date?',
    answer: 'The team set the launch for the 14th to protect a full QA week.',
    when: 'Today',
  },
  {
    id: 'aq2',
    question: 'Who owns the support hand-off?',
    answer: 'Dana is looping in the support team before launch.',
    when: 'Today',
  },
];

/* ----------------------------------------------------------------------------
 * Per-person detail (Person detail screen)
 * ------------------------------------------------------------------------- */
export const allMeetings: RecentMeeting[] = [...recentMeetings, ...olderSessions];

export interface PersonQuote {
  text: string;
  meeting: string;
  when: string;
}

const personQuotes: Record<string, PersonQuote[]> = {
  priya: [
    { text: "Let's lock the launch date before we scope anything else.", meeting: 'Q3 Roadmap Sync', when: 'Today' },
    { text: "I'll get the scope doc circulated by end of day.", meeting: 'Q3 Roadmap Sync', when: 'Today' },
  ],
  marcus: [
    { text: "I'd push for the 14th - that gives QA a full week.", meeting: 'Q3 Roadmap Sync', when: 'Today' },
  ],
  dana: [
    { text: 'Agreed. We should loop in support before we commit publicly.', meeting: 'Q3 Roadmap Sync', when: 'Today' },
  ],
  aisha: [
    { text: 'The onboarding copy should feel calmer on first launch.', meeting: 'Design Review — Pod v2', when: 'Yesterday' },
  ],
  tom: [
    { text: 'I want the scorecards in before we sync as a panel.', meeting: 'Hiring Loop Debrief', when: 'Mon' },
  ],
  sara: [],
};

const personMeetingIds: Record<string, string[]> = {
  priya: ['q3-roadmap-sync', 'design-review-pod-v2', 'weekly-standup'],
  marcus: ['q3-roadmap-sync', 'design-review-pod-v2'],
  dana: ['q3-roadmap-sync', 'hiring-loop-debrief'],
  aisha: ['design-review-pod-v2', 'customer-onsite'],
  tom: ['hiring-loop-debrief', 'board-prep'],
  sara: ['customer-onsite'],
};

export function getPerson(id: string): Person | undefined {
  return people.find((p) => p.id === id);
}

export function getPersonOpenActions(person: Person): AggAction[] {
  const first = person.name.split(' ')[0];
  return allActions.filter((a) => a.owner === first && !a.done);
}

export function getPersonQuotes(id: string): PersonQuote[] {
  return personQuotes[id] ?? [];
}

export function getPersonMeetings(id: string): RecentMeeting[] {
  const ids = personMeetingIds[id] ?? [];
  return ids
    .map((mid) => allMeetings.find((m) => m.id === mid))
    .filter((m): m is RecentMeeting => Boolean(m));
}

/* ----------------------------------------------------------------------------
 * Weekly insights (This week digest)
 * ------------------------------------------------------------------------- */
export const weeklyStats = {
  rangeLabel: 'This week',
  meetings: allMeetings.length,
  minutes: allMeetings.reduce((n, m) => n + m.durationMin, 0),
  decisions: 5,
  actionsTotal: allActions.length,
  actionsDone: allActions.filter((a) => a.done).length,
  people: people.length,
  trendPct: 18,
  trendUp: true,
};

export interface DayActivity {
  day: string;
  minutes: number;
}

export const weeklyActivity: DayActivity[] = [
  { day: 'Mon', minutes: 35 },
  { day: 'Tue', minutes: 12 },
  { day: 'Wed', minutes: 52 },
  { day: 'Thu', minutes: 18 },
  { day: 'Fri', minutes: 41 },
  { day: 'Sat', minutes: 0 },
  { day: 'Sun', minutes: 24 },
];

export const topCollaborators: Person[] = [...people]
  .sort((a, b) => b.meetings - a.meetings)
  .slice(0, 4);

export interface WeekHighlight {
  text: string;
  meeting: string;
  kind: 'decision' | 'keypoint';
}

export const weekHighlights: WeekHighlight[] = [
  { text: 'Launch date set for the 14th to protect the QA window.', meeting: 'Q3 Roadmap Sync', kind: 'decision' },
  { text: 'Pod v2 onboarding copy will be revisited for a calmer first run.', meeting: 'Design Review — Pod v2', kind: 'keypoint' },
  { text: 'Two decisions captured at the Northwind onsite.', meeting: 'Customer Onsite — Northwind', kind: 'decision' },
];
