/**
 * What a Myte says, made ready for the voice (ADR-0050 D4): markdown and citations stripped, then
 * split into sentences and grouped into chunks the server can speak (1..1500 characters each).
 *
 * The first chunk is a single sentence so the first sound comes quickly; the rest group a few
 * sentences together (up to `target` characters) so a long answer costs few requests against the
 * 30-a-minute limit.
 */

export const MAX_CHARS = 1500;
const TARGET = 240;

const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g', 'i.e', 'inc', 'ltd', 'co', 'approx', 'no']);

/** Markdown, links, citation marks and bare URLs out; the words in. */
export function cleanForSpeech(input: string): string {
  return (
    input
      // fenced and inline code: say nothing of a code block, keep an inline word
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      // images, then links: keep the label
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // citations: [1], [1, 2], [^3], 【4†source】, (source: ...)
      .replace(/\[\^?\d+(?:\s*[,;-]\s*\d+)*\]/g, '')
      .replace(/【[^】]*】/g, '')
      .replace(/\[(?:source|cite|ref)[^\]]*\]/gi, '')
      // bare URLs
      .replace(/https?:\/\/\S+/g, '')
      // headings, quotes, list markers, rules, tables
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
      .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '')
      .replace(/\|/g, ' ')
      // emphasis
      .replace(/(\*\*|__)(.+?)\1/g, '$2')
      .replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1$2')
      .replace(/(^|[^\w_])_(?!\s)([^_\n]+?)_(?!\w)/g, '$1$2')
      .replace(/~~(.+?)~~/g, '$1')
      // a line break ends a thought: make it read like one
      .replace(/([^.!?:;,\s])\s*\n+\s*/g, '$1. ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,!?;:])/g, '$1')
      .trim()
  );
}

/** Sentences, kept whole: a decimal ("3.5"), an abbreviation ("Dr.") or an ellipsis inside a
    sentence does not end it. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '…') continue;
    let end = i + 1;
    while (end < text.length && /[.!?…"'”’)\]]/.test(text[end] ?? '')) end += 1;
    if (end < text.length && !/\s/.test(text[end] ?? '')) continue;
    if (ch === '.') {
      const word = text.slice(start, i).split(/\s+/).pop()?.toLowerCase() ?? '';
      if (ABBREVIATIONS.has(word) || /^[a-z]$/i.test(word)) continue;
    }
    const s = text.slice(start, end).trim();
    if (s) out.push(s);
    start = end;
    i = end - 1;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** A sentence longer than `max` is split at a clause, else at a word. */
function hardSplit(sentence: string, max: number): string[] {
  const out: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(': '));
    if (cut < max / 3) cut = window.lastIndexOf(' ');
    if (cut <= 0) cut = max - 1;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** The chunks to send, in order. Empty when there is nothing to say. */
export function speechChunks(text: string, opts: { target?: number; max?: number } = {}): string[] {
  const max = Math.min(opts.max ?? MAX_CHARS, MAX_CHARS);
  const target = Math.min(opts.target ?? TARGET, max);
  const sentences = splitSentences(cleanForSpeech(text)).flatMap((s) => (s.length > max ? hardSplit(s, max) : [s]));
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (!/[\p{L}\p{N}]/u.test(s)) continue;
    // The first chunk is one sentence: the first sound comes as soon as it can.
    if (chunks.length === 0 && !current) {
      chunks.push(s);
      continue;
    }
    if (current && current.length + 1 + s.length > target) {
      chunks.push(current);
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
