/**
 * What your Myte says when it talks you through your decisions and tasks (`/myte/brief`,
 * system.md N28). Pure: the clock is a parameter, so the script is tested without mocking time
 * and stays the same while it is being spoken.
 *
 * - Decisions: confirmed and not superseded, made in the last 14 days, newest first, at most 5.
 * - Tasks: your open (confirmed) tasks (`Task`, what `GET /api/v1/actions/mine` returns),
 *   soonest due first and undated last, at most 5.
 * - Each item is one short sentence (cut at a word at 160 characters; the row shows it whole)
 *   with the place it opens. A list that could not be loaded (`null`) is said, not hidden.
 */

import type { DecisionLogEntry, Task } from '@/api/types';
import { dueLabel, parse, plural } from './format';

export const TALK_DECISIONS_MAX = 5;
export const TALK_TASKS_MAX = 5;
export const TALK_DECISION_WINDOW_DAYS = 14;
export const TALK_ITEM_CHARS = 160;

const DAY = 24 * 60 * 60 * 1000;

export type TalkKind = 'hello' | 'decision' | 'task' | 'more' | 'note' | 'bye';

export interface TalkLine {
  id: string;
  kind: TalkKind;
  text: string;
  /** Where a tap on this line's item goes; null for a line that is not about one item. */
  route: string | null;
  /** The decision or task this line is about. */
  itemId?: string;
}

export interface MyteTalk {
  lines: TalkLine[];
  /** The decisions that are said, in order. */
  decisions: DecisionLogEntry[];
  /** The tasks that are said, in order. */
  tasks: Task[];
  /** Recent decisions left out by the cap. */
  moreDecisions: number;
  /** Open tasks left out by the cap. */
  moreTasks: number;
}

export interface TalkInput {
  /** "Nova" for a Myte with its own name, else "your Myte". */
  spokenName: string;
  personFirstName: string | null | undefined;
  /** null: the list could not be loaded. */
  decisions: readonly DecisionLogEntry[] | null;
  tasks: readonly Task[] | null;
  now: Date;
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** "two decisions" (words up to twelve, then digits), through the shared `plural`. */
function count(n: number, one: string, many?: string): string {
  const said = plural(n, one, many);
  const word = WORDS[n];
  return word ? said.replace(/^\d+/, word) : said;
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** One line of text, at most `TALK_ITEM_CHARS`, cut at a word boundary with an ellipsis. */
export function clip(text: string, max = TALK_ITEM_CHARS): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const head = s.slice(0, max - 1);
  const space = head.lastIndexOf(' ');
  const cut = (space > max / 2 ? head.slice(0, space) : head).replace(/[\s,;:.!?…-]+$/, '');
  return `${cut}…`;
}

/** Ends with terminal punctuation. */
function sentence(s: string): string {
  return /[.!?…]$/.test(s) ? s : `${s}.`;
}

/** Without a closing full stop, so a clause can follow. */
function clause(s: string): string {
  return s.replace(/[.!?]+$/, '');
}

function time(iso: string | null | undefined): number {
  return parse(iso)?.getTime() ?? Number.NaN;
}

/** Confirmed, not superseded, from the last 14 days, newest first. */
export function recentDecisions(items: readonly DecisionLogEntry[], now: Date): DecisionLogEntry[] {
  const since = now.getTime() - TALK_DECISION_WINDOW_DAYS * DAY;
  return items
    .filter((d) => d.status === 'confirmed' && !d.superseded_by && time(d.created_at) >= since)
    .sort((a, b) => time(b.created_at) - time(a.created_at));
}

/** Open tasks, soonest due first and undated last; ties keep the server's order. */
export function openTasks(items: readonly Task[]): Task[] {
  const due = (t: Task) => {
    const at = time(t.due_date);
    return Number.isNaN(at) ? Number.POSITIVE_INFINITY : at;
  };
  return items.filter((t) => t.status === 'confirmed').sort((a, b) => due(a) - due(b));
}

function decisionLine(d: DecisionLogEntry): TalkLine {
  const content = clip(d.content);
  const title = d.meeting_title?.trim();
  return {
    id: `decision:${d.id}`,
    kind: 'decision',
    text: sentence(title ? `From ${title}: ${content}` : content),
    route: `/decisions/${d.id}`,
    itemId: d.id,
  };
}

function taskLine(t: Task, now: Date): TalkLine {
  const due = dueLabel(t.due_date, now);
  const content = clause(clip(t.content));
  return {
    id: `task:${t.id}`,
    kind: 'task',
    text: sentence(due ? `${content}, ${lowerFirst(due.text)}` : content),
    route: '/work?tab=tasks',
    itemId: t.id,
  };
}

export function composeMyteTalk({ spokenName, personFirstName, decisions, tasks, now }: TalkInput): MyteTalk {
  const lines: TalkLine[] = [];
  const first = personFirstName?.trim().split(/\s+/)[0];
  lines.push({ id: 'hello', kind: 'hello', text: first ? `Hi ${first}, it's ${spokenName}.` : `Hi, it's ${spokenName}.`, route: null });

  // Decisions.
  const recent = decisions ? recentDecisions(decisions, now) : [];
  const saidDecisions = recent.slice(0, TALK_DECISIONS_MAX);
  const moreDecisions = recent.length - saidDecisions.length;
  if (!decisions) {
    lines.push({ id: 'decisions', kind: 'note', text: "I couldn't reach your decisions just now.", route: null });
  } else if (!recent.length) {
    lines.push({ id: 'decisions', kind: 'note', text: 'Nothing new was decided in the last two weeks.', route: null });
  } else {
    lines.push({ id: 'decisions', kind: 'note', text: `${capital(count(recent.length, 'decision'))} from the last two weeks.`, route: null });
    for (const d of saidDecisions) lines.push(decisionLine(d));
    if (moreDecisions > 0) {
      lines.push({ id: 'decisions-more', kind: 'more', text: `And ${moreDecisions} more in your decision log.`, route: '/decisions' });
    }
  }

  // Tasks.
  const open = tasks ? openTasks(tasks) : [];
  const saidTasks = open.slice(0, TALK_TASKS_MAX);
  const moreTasks = open.length - saidTasks.length;
  if (!tasks) {
    lines.push({ id: 'tasks', kind: 'note', text: "I couldn't reach your tasks just now.", route: null });
  } else if (!open.length) {
    lines.push({ id: 'tasks', kind: 'note', text: 'You have no open tasks.', route: null });
  } else {
    const overdue = open.filter((t) => dueLabel(t.due_date, now)?.overdue).length;
    const head = `You have ${count(open.length, 'open task')}${overdue ? `, ${WORDS[overdue] ?? overdue} overdue` : ''}.`;
    lines.push({ id: 'tasks', kind: 'note', text: head, route: null });
    for (const t of saidTasks) lines.push(taskLine(t, now));
    if (moreTasks > 0) {
      lines.push({ id: 'tasks-more', kind: 'more', text: `And ${moreTasks} more on your list.`, route: '/work?tab=tasks' });
    }
  }

  // Goodbye.
  const said = saidDecisions.length + saidTasks.length;
  const bye =
    said > 0
      ? "That's everything. Tap any of them to open it."
      : decisions && tasks
        ? 'Nothing needs you right now. Enjoy the quiet.'
        : "That's all I have for now.";
  lines.push({ id: 'bye', kind: 'bye', text: bye, route: null });

  return { lines, decisions: saidDecisions, tasks: saidTasks, moreDecisions, moreTasks };
}
