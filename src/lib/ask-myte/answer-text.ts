// Ported from mytheus-ui src/components/ask-myte/parts.tsx (main @ 093129f): `blocksOf` verbatim,
// and the tokenizing half of `inline` (same regex, same rules) returning parts instead of JSX, so
// the phone draws an answer's text exactly as the web does. Change both together.
//
// - Paragraphs split on blank lines; a chunk whose every line is a bullet (`-`, `*`, `•`) or a
//   number (`1.`, `1)`) is a list.
// - `**bold**` is bold.
// - A `[n]` marker with a source is a citation; a marker that points at no source is dropped
//   rather than drawn as a dead chip.

import type { Source } from "./types";

export type Block = { kind: "p"; text: string } | { kind: "ul" | "ol"; items: string[] };

/** Paragraphs and simple lists, from the model's plain text. */
export function blocksOf(text: string): Block[] {
  const out: Block[] = [];
  for (const chunk of text.split(/\n{2,}/)) {
    const lines = chunk.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;
    const bullet = lines.every((l) => /^\s*[-*•]\s+/.test(l));
    const numbered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
    if (bullet) out.push({ kind: "ul", items: lines.map((l) => l.replace(/^\s*[-*•]\s+/, "")) });
    else if (numbered) out.push({ kind: "ol", items: lines.map((l) => l.replace(/^\s*\d+[.)]\s+/, "")) });
    else out.push({ kind: "p", text: lines.join("\n") });
  }
  return out;
}

export type InlinePart = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "cite"; n: number; source: Source };

/** One block's text as plain runs, bold runs and citations (the web's `inline`, without JSX). */
export function inlineParts(text: string, sources: readonly Source[]): InlinePart[] {
  const have = new Map(sources.map((s) => [s.n, s]));
  const parts: InlinePart[] = [];
  const re = /\[(\d+)\]|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1]) {
      const n = Number(m[1]);
      // A marker that points at no source is dropped rather than drawn as a dead chip.
      const source = have.get(n);
      if (source) parts.push({ kind: "cite", n, source });
    } else if (m[2]) {
      parts.push({ kind: "bold", text: m[2] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}
