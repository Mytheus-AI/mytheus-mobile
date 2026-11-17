// Ported verbatim from mytheus-ui src/lib/ask-myte/compose.ts (main @ 093129f), `FailureCopy` and
// `failureCopy` only (ADR-0047 D10); change both together. The rest of compose.ts (the history
// rail's groups, slash shortcuts, mentions) is not used on the phone yet.
// On mobile `isAdmin` is never passed: the actions it unlocks open web-only Workspace pages.

import type { AnswerFailure } from "./reducer";

export interface FailureCopy {
  title: string;
  detail: string;
  retry: boolean;
  /** a way out besides Retry */
  action?: { label: string; href: string } | null;
}

/** In character, first person, plain. `message` is what rag-service said, kept when it says
    more than ours (a budget's return date, say). */
export function failureCopy(reason: AnswerFailure | "stopped", opts: { name: string; message?: string | null; isAdmin?: boolean }): FailureCopy {
  const extra = opts.message?.trim() || "";
  switch (reason) {
    case "stopped":
      return { title: "Stopped.", detail: "Ask again to continue.", retry: true };
    case "not_connected":
      return {
        title: "I'm not connected on this workspace yet.",
        detail: opts.isAdmin ? "You can connect me in the Workspace console." : "A workspace admin can connect me. Until then I can't look anything up.",
        retry: false,
        action: opts.isAdmin ? { label: "Open Workspace", href: "/workspace" } : null,
      };
    case "budget":
      return {
        title: "Your workspace reached its AI limit.",
        detail: extra || "Answers come back when the limit resets, or sooner if an admin raises it.",
        retry: false,
        action: opts.isAdmin ? { label: "Usage and billing", href: "/workspace/billing" } : null,
      };
    case "session":
      return { title: "Your session expired.", detail: "Sign in again and ask me once more.", retry: false, action: { label: "Sign in again", href: "/sign-in" } };
    case "invalid":
      return { title: "I couldn't take that question.", detail: extra || "Keep it under 2000 characters and try again.", retry: false };
    case "offline":
      return { title: "You're offline.", detail: "I kept what I had so far. Ask again when you're back online.", retry: true };
    default:
      return { title: "I couldn't answer just now.", detail: "Nothing was lost. Try again in a moment.", retry: true };
  }
}
