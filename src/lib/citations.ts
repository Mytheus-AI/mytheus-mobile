import type { AskCitation } from '@/api/types';

export type AnswerPart = { kind: 'text'; text: string } | { kind: 'cite'; n: number };

/**
 * Split an answer into text and its `[n]` citation markers (AskCitation.n), so each marker can be
 * drawn as a tappable reference. A marker with no matching citation stays plain text: the answer
 * is never shown pointing at a source that is not there. `[1, 2]` and `[1][2]` both work.
 */
export function splitCitations(answer: string, citations: readonly Pick<AskCitation, 'n'>[]): AnswerPart[] {
  const known = new Set(citations.map((c) => c.n));
  const parts: AnswerPart[] = [];
  const re = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const pushText = (text: string) => {
    if (!text) return;
    const prev = parts[parts.length - 1];
    if (prev?.kind === 'text') prev.text += text;
    else parts.push({ kind: 'text', text });
  };
  while ((m = re.exec(answer)) !== null) {
    const nums = m[1].split(',').map((s) => Number(s.trim()));
    if (!nums.every((n) => known.has(n))) continue;
    pushText(answer.slice(last, m.index));
    for (const n of nums) parts.push({ kind: 'cite', n });
    last = m.index + m[0].length;
  }
  pushText(answer.slice(last));
  return parts;
}

const KIND: Record<string, string> = {
  transcript: 'Said in a meeting',
  document: 'Company document',
  decision: 'Decision',
  action: 'Action',
};

export function citationKind(kind: string): string {
  return KIND[kind] ?? 'Source';
}

/** Where a citation leads in the app: the decision, else the meeting, else nowhere. */
export function citationRoute(c: Pick<AskCitation, 'decision_id' | 'meeting_id'>): string | null {
  if (c.decision_id) return `/decisions/${c.decision_id}`;
  if (c.meeting_id) return `/meetings/${c.meeting_id}`;
  return null;
}
