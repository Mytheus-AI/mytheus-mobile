import {
  TALK_DECISIONS_MAX,
  TALK_ITEM_CHARS,
  TALK_TASKS_MAX,
  clip,
  composeMyteTalk,
  type TalkInput,
} from '@/lib/myte-talk';
import { appRoute, signInReturn } from '@/lib/routes';
import type { DecisionLogEntry, Task } from '@/api/types';

/* What your Myte says when it talks you through your decisions and tasks (system.md N28): the
   caps, the order, the 14-day window, the empty and failed states, the persona's name, and the
   sign-in return allowlist that brings a signed-out widget tap back to the screen. */

// Wednesday 18 Nov 2026, noon local time.
const NOW = new Date(2026, 10, 18, 12, 0, 0);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
const day = (offset: number) => {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function decision(id: string, over: Partial<DecisionLogEntry> = {}): DecisionLogEntry {
  return {
    id,
    content: `Decision ${id}`,
    created_at: daysAgo(1),
    meeting_id: 'm1',
    meeting_started_at: daysAgo(1),
    meeting_title: null,
    status: 'confirmed',
    ...over,
  };
}

function task(id: string, over: Partial<Task> = {}): Task {
  return { id, assignee_id: 'u1', confidence: 1, content: `Task ${id}`, created_at: daysAgo(3), status: 'confirmed', ...over };
}

const base: TalkInput = { spokenName: 'Nova', personFirstName: 'Sam', decisions: [], tasks: [], now: NOW };
const texts = (input: Partial<TalkInput>) => composeMyteTalk({ ...base, ...input }).lines.map((l) => l.text);

describe('the script', () => {
  it('greets you by name with its own name, or as your Myte (never "Sam\'s Myte")', () => {
    expect(texts({})[0]).toBe("Hi Sam, it's Nova.");
    expect(texts({ spokenName: 'your Myte' })[0]).toBe("Hi Sam, it's your Myte.");
    expect(texts({ spokenName: 'your Myte', personFirstName: null })[0]).toBe("Hi, it's your Myte.");
    expect(texts({ personFirstName: 'Sam Rao' })[0]).toBe("Hi Sam, it's Nova.");
  });

  it('says recent confirmed decisions, newest first, each with its meeting and route', () => {
    const t = composeMyteTalk({
      ...base,
      decisions: [
        decision('old', { created_at: daysAgo(20) }),
        decision('a', { created_at: daysAgo(3), content: 'We move to annual billing', meeting_title: 'Pricing review' }),
        decision('b', { created_at: daysAgo(1), content: 'Ship on Friday.' }),
        decision('gone', { status: 'superseded', superseded_by: 'b' }),
        decision('replaced', { superseded_by: 'b' }),
      ],
    });
    expect(t.lines.slice(1, 4).map((l) => l.text)).toEqual([
      'Two decisions from the last two weeks.',
      'Ship on Friday.',
      'From Pricing review: We move to annual billing.',
    ]);
    expect(t.lines[2]).toMatchObject({ kind: 'decision', route: '/decisions/b', itemId: 'b' });
    expect(t.decisions.map((d) => d.id)).toEqual(['b', 'a']);
    expect(t.moreDecisions).toBe(0);
  });

  it(`caps decisions at ${TALK_DECISIONS_MAX} and points to the log for the rest`, () => {
    const many = Array.from({ length: 8 }, (_, i) => decision(`d${i}`, { created_at: daysAgo(i) }));
    const t = composeMyteTalk({ ...base, decisions: many });
    expect(t.decisions).toHaveLength(TALK_DECISIONS_MAX);
    expect(t.moreDecisions).toBe(3);
    expect(t.lines.find((l) => l.id === 'decisions')?.text).toBe('Eight decisions from the last two weeks.');
    expect(t.lines.find((l) => l.id === 'decisions-more')).toMatchObject({ kind: 'more', text: 'And 3 more in your decision log.', route: '/decisions' });
  });

  it(`says open tasks soonest due first, undated last, capped at ${TALK_TASKS_MAX}, with the overdue count`, () => {
    const t = composeMyteTalk({
      ...base,
      tasks: [
        task('later', { due_date: day(5) }),
        task('undated'),
        task('tomorrow', { content: 'Send the deck to Priya', due_date: day(1) }),
        task('late', { content: 'File the expenses.', due_date: day(-2) }),
        task('done', { status: 'done' }),
        task('u2'),
        task('u3'),
        task('u4'),
      ],
    });
    expect(t.tasks.map((x) => x.id)).toEqual(['late', 'tomorrow', 'later', 'undated', 'u2']);
    expect(t.moreTasks).toBe(2);
    const lines = t.lines.filter((l) => l.kind === 'task' || l.id.startsWith('tasks'));
    expect(lines[0].text).toBe('You have seven open tasks, one overdue.');
    expect(lines[1].text).toMatch(/^File the expenses, overdue since /);
    expect(lines[1].text.endsWith('.')).toBe(true);
    expect(lines[2]).toMatchObject({ text: 'Send the deck to Priya, due tomorrow.', route: '/work?tab=tasks', itemId: 'tomorrow' });
    expect(lines[4].text).toBe('Task undated.');
    expect(lines[lines.length - 1]).toMatchObject({ id: 'tasks-more', text: 'And 2 more on your list.', route: '/work?tab=tasks' });
  });

  it('says one task in the singular', () => {
    expect(texts({ tasks: [task('a')] })).toContain('You have one open task.');
  });

  it('nothing to say: the quiet ending', () => {
    expect(texts({})).toEqual([
      "Hi Sam, it's Nova.",
      'Nothing new was decided in the last two weeks.',
      'You have no open tasks.',
      'Nothing needs you right now. Enjoy the quiet.',
    ]);
  });

  it('a list that failed is said, and the other is still said', () => {
    const t = texts({ decisions: null, tasks: [task('a')] });
    expect(t).toContain("I couldn't reach your decisions just now.");
    expect(t).toContain('Task a.');
    expect(t[t.length - 1]).toBe("That's everything. Tap any of them to open it.");
    expect(texts({ decisions: [], tasks: null })).toContain("I couldn't reach your tasks just now.");
  });

  it('cuts a long item at a word with an ellipsis, and ends every line with punctuation', () => {
    const long = `${'word '.repeat(60)}end`;
    const cut = clip(long);
    expect(cut.length).toBeLessThanOrEqual(TALK_ITEM_CHARS);
    expect(cut.endsWith('word…')).toBe(true);
    const all = composeMyteTalk({ ...base, decisions: [decision('x', { content: long })], tasks: [task('y', { content: long, due_date: day(0) })] });
    for (const l of all.lines) expect(l.text).toMatch(/[.!?…]$/);
    expect(all.lines.find((l) => l.itemId === 'y')?.text).toMatch(/word…, due today\.$/);
  });
});

describe('the way in', () => {
  it('lets only the talk screen through sign-in, so `next` is never an open redirect', () => {
    expect(signInReturn('/myte/brief')).toBe('/myte/brief');
    expect(signInReturn(['/myte/brief'])).toBe('/myte/brief');
    expect(signInReturn('/settings')).toBeNull();
    expect(signInReturn('https://evil.test/myte/brief')).toBeNull();
    expect(signInReturn('//evil.test')).toBeNull();
    expect(signInReturn(undefined)).toBeNull();
    expect(signInReturn(42)).toBeNull();
  });

  it('a link to the talk screen opens it', () => {
    expect(appRoute('/myte/brief')).toBe('/myte/brief');
    expect(appRoute('/myte')).toBeNull();
  });
});
