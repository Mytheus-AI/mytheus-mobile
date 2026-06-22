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
