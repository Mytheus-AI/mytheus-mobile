/**
 * A short grace period before a write that cannot be taken back (marking a task done has no
 * reopen route). The item leaves the list at once, a toast offers Undo, and only when the window
 * passes is the write sent. Pure timers, no React, so it is tested with fake timers.
 */
export interface Deferred {
  /** Queue `commit` to run after `ms`; returns an undo that cancels it. */
  schedule: (key: string, commit: () => void, ms?: number) => () => void;
  /** Run everything still waiting now (leaving the screen must not drop a completion). */
  flush: () => void;
  pending: () => string[];
}

export const GRACE_MS = 4500;

export function createDeferred(): Deferred {
  const waiting = new Map<string, { timer: ReturnType<typeof setTimeout>; commit: () => void }>();
  return {
    schedule(key, commit, ms = GRACE_MS) {
      const prev = waiting.get(key);
      if (prev) clearTimeout(prev.timer);
      const timer = setTimeout(() => {
        waiting.delete(key);
        commit();
      }, ms);
      waiting.set(key, { timer, commit });
      return () => {
        const w = waiting.get(key);
        if (!w) return;
        clearTimeout(w.timer);
        waiting.delete(key);
      };
    },
    flush() {
      for (const [key, w] of Array.from(waiting.entries())) {
        clearTimeout(w.timer);
        waiting.delete(key);
        w.commit();
      }
    },
    pending: () => Array.from(waiting.keys()),
  };
}
