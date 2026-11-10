import type { ApiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import type { CaptionPayload } from './captions';
import type { Hydrators } from './useMeetingSocket';

/** How many transcript pages a re-hydrate follows (500 finals each, about two hours of talk). */
const MAX_TRANSCRIPT_PAGES = 4;

/**
 * The room's durable reads over REST, the same four mytheus-ui re-reads on every (re)connect:
 * the transcript's finals, your own notes, the candidate ledger (open plus resolved), the agenda.
 */
export function roomHydrators(api: ApiClient, meetingId: string): Hydrators {
  return {
    async transcript() {
      const out: CaptionPayload[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < MAX_TRANSCRIPT_PAGES; page += 1) {
        const res = await endpoints.transcript(api, meetingId, cursor);
        for (const c of res.items) {
          if (c.redacted) continue;
          out.push({
            chunkId: c.id,
            speakerId: c.speaker_id,
            startMs: c.start_ms,
            endMs: c.end_ms,
            text: c.text,
            isFinal: true,
            confidence: c.confidence ?? undefined,
          });
        }
        cursor = res.next_cursor ?? null;
        if (!cursor) break;
      }
      return out;
    },
    async notes() {
      const res = await endpoints.myNotes(api, meetingId);
      return res.items.map((n) => ({ windowId: n.window_id, content: n.content }));
    },
    async candidates() {
      const res = await endpoints.candidates(api, meetingId);
      return { decisions: res.decisions, actions: res.actions };
    },
    async agenda() {
      const m = await endpoints.meeting(api, meetingId);
      return Array.isArray(m.agenda) ? m.agenda : null;
    },
  };
}
