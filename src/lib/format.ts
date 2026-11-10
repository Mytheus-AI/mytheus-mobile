/**
 * Dates and times in plain words, in the phone's own locale and time zone. Pure (the clock is a
 * parameter), so it is tested without mocking time.
 */

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  // A bare date (YYYY-MM-DD) is a calendar day, not midnight UTC.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function time(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Today", "Tomorrow", "Yesterday", a weekday within the week, else "12 Nov". */
export function dayLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const d = parse(iso);
  if (!d) return '';
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Today, 3:30 PM". */
export function whenLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const d = parse(iso);
  if (!d) return '';
  return `${dayLabel(iso, now)}, ${time(d)}`;
}

/** "Due today", "Due tomorrow", "Overdue since 3 Nov", "Due 14 Nov", or null without a date. */
export function dueLabel(iso: string | null | undefined, now: Date = new Date()): { text: string; overdue: boolean } | null {
  const d = parse(iso);
  if (!d) return null;
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / DAY);
  if (diff < 0) return { text: `Overdue since ${dayLabel(iso, now)}`, overdue: true };
  if (diff === 0) return { text: 'Due today', overdue: false };
  if (diff === 1) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${dayLabel(iso, now)}`, overdue: false };
}

/** "Just now", "5 min ago", "3 h ago", then the day. */
export function ago(iso: string | null | undefined, now: Date = new Date()): string {
  const d = parse(iso);
  if (!d) return '';
  const ms = now.getTime() - d.getTime();
  if (ms < 60_000) return 'Just now';
  if (ms < 60 * 60_000) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < 12 * 60 * 60_000) return `${Math.floor(ms / (60 * 60_000))} h ago`;
  return dayLabel(iso, now);
}

/** "12:05" or "1:02:05" for an elapsed duration. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "Good morning" by the phone's clock. */
export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
