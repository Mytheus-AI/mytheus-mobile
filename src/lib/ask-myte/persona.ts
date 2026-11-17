/**
 * The Myte persona sent with every ask (ADR-0047 D8: it shapes tone only, never permissions).
 *
 * Two one-liners ported verbatim from mytheus-ui (main @ 093129f); change both together:
 * - `agentDisplayName` from src/lib/api/profile-types.ts (the one the web's Ask route uses, with
 *   the "Your Myte" fallback; the room's variant in agent-persona.ts says "Their Myte").
 * - `asPersonality` from src/lib/realtime/agent-persona.ts. The web tests `value in
 *   PERSONALITY_LABEL` (a label map mobile does not have); this checks the same five presets
 *   with a list, so an inherited key such as "constructor" cannot slip through.
 */

import type { Personality } from "./types";

const PERSONALITIES: readonly Personality[] = ["balanced", "concise", "detailed", "direct", "friendly"];

export function agentDisplayName(agentName: string | null | undefined, personName: string): string {
  const named = agentName?.trim();
  if (named) return named;
  const first = personName.trim().split(/\s+/)[0];
  return first ? `${first}'s Myte` : "Your Myte";
}

/** A known preset, or "balanced" (the column default) for anything else. */
export function asPersonality(value: unknown): Personality {
  return typeof value === "string" && (PERSONALITIES as readonly string[]).includes(value) ? (value as Personality) : "balanced";
}
