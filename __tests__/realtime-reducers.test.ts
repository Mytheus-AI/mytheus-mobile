import { applyCaption, emptyCaptionState } from '@/realtime/captions';
import { roomConnection, backoffMs } from '@/realtime/connection';
import { applyAgentAgenda, applyHostAgendaStatus, beginHostStatus, commitHostStatus, initialAgendaState, rollbackHostStatus } from '@/realtime/agenda';
import { roomHydrators } from '@/realtime/hydrators';
import type { AgendaItem } from '@/api/types';
import type { ApiClient } from '@/api/client';

const ITEM = '7e1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b';
const item = (over: Partial<AgendaItem> = {}): AgendaItem => ({
  id: ITEM,
  position: 0,
  title: 'Pricing',
  owner_user_id: null,
  duration_minutes: 10,
  status: 'pending',
  status_source: null,
  agent_note: null,
  updated_at: '2026-11-11T10:00:00Z',
  ...over,
});

describe('captions', () => {
  it('replaces an interim in place and never regresses a final', () => {
    let s = applyCaption(emptyCaptionState, { chunkId: 'a', speakerId: '0', startMs: 0, endMs: 1, text: 'We', isFinal: false });
    s = applyCaption(s, { chunkId: 'a', speakerId: '0', startMs: 0, endMs: 2, text: 'We ship', isFinal: true });
    s = applyCaption(s, { chunkId: 'a', speakerId: '0', startMs: 0, endMs: 2, text: 'We', isFinal: false });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({ text: 'We ship', isFinal: true });
  });
});

describe('one honest connection line', () => {
  it('stays quiet when both links work and names what is paused otherwise', () => {
    expect(roomConnection('connected', 'joined', true)).toBeNull();
    expect(roomConnection('connected', 'reconnecting', true)?.text).toBe('Agent paused, captions reconnecting');
    expect(roomConnection('reconnecting', 'joined', true)?.text).toMatch(/Call reconnecting/);
    expect(roomConnection('connected', 'error', true)).toMatchObject({ tone: 'error', retry: 'live' });
    expect(roomConnection('connected', 'forbidden', false)?.retry).toBeNull();
  });
  it('backs off with jitter up to 30 s', () => {
    expect(backoffMs(0, () => 0)).toBe(500);
    expect(backoffMs(10, () => 1)).toBe(30_000);
  });
});

describe('shared agenda', () => {
  it('lets the host win over the agent and rolls back a refused change', () => {
    let s = initialAgendaState([item()]);
    s = beginHostStatus(s, ITEM, 'covered', 1);
    s = applyAgentAgenda(s, { itemId: ITEM, status: 'in_progress', note: null });
    expect(s.items[0].status).toBe('covered');
    s = rollbackHostStatus(s, ITEM, 1);
    expect(s.items[0].status).toBe('pending');
    s = beginHostStatus(s, ITEM, 'skipped', 2);
    s = commitHostStatus(s, ITEM, 2, item({ status: 'skipped', status_source: 'host' }));
    expect(s.items[0]).toMatchObject({ status: 'skipped', status_source: 'host' });
  });
  it('applies another host change broadcast to the room', () => {
    const s = applyHostAgendaStatus(initialAgendaState([item()]), item({ status: 'covered', status_source: 'host' }));
    expect(s.items[0].status).toBe('covered');
  });
});

describe('room re-hydrate', () => {
  it('follows transcript pages, skips redacted chunks, and reads your notes and the agenda', async () => {
    const pages: Record<string, unknown> = {
      first: { items: [{ id: 'c1', meeting_id: 'm', speaker_id: '0', start_ms: 0, end_ms: 5, text: 'Hello', is_final: true }], next_cursor: 'p2' },
      p2: { items: [{ id: 'c2', meeting_id: 'm', speaker_id: '1', start_ms: 6, end_ms: 9, text: 'secret', is_final: true, redacted: true }], next_cursor: null },
    };
    const api = {
      async request(_m: string, path: string, opts: { query?: { cursor?: string } }) {
        if (path.endsWith('/transcript')) return pages[opts.query?.cursor ?? 'first'];
        if (path.endsWith('/worklogs')) return { items: [{ id: 'w', window_id: 'm:0', content: 'Note', meeting_id: 'm', user_id: 'u', created_at: '', source_chunk_ids: [] }] };
        if (path.endsWith('/candidates')) return { decisions: [], actions: [] };
        return { agenda: [item()] };
      },
    } as unknown as ApiClient;
    const h = roomHydrators(api, 'm');
    expect((await h.transcript()).map((c) => c.text)).toEqual(['Hello']);
    expect(await h.notes()).toEqual([{ windowId: 'm:0', content: 'Note' }]);
    expect((await h.agenda())?.[0].id).toBe(ITEM);
  });
});
