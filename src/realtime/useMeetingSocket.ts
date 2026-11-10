/**
 * One Socket.io connection to `realtime-gateway` (namespace `/v1`), joined to one meeting, reduced
 * into the room's live state. The mobile counterpart of mytheus-ui
 * `src/lib/realtime/useMeetingSocket.ts`, over the gateway contract on mytheus-realtime main
 * (`services/realtime-gateway/src/server.ts`, `roomEvents.ts`):
 *
 * - ONE SOCKET, created in the effect and torn down by its cleanup.
 * - A FRESH TOKEN ON EVERY (RE)CONNECT: `auth` is a callback, so each handshake (the automatic
 *   reconnects included) carries a Clerk token minted just now; `reauth` keeps the token the gateway
 *   uses for its own core-api reads current while the socket stays up (every 40 s, and right before
 *   an event the gateway verifies against core-api).
 * - RE-JOINS AND RE-HYDRATES ON EVERY (RE)CONNECT. The gateway replays nothing; durable state is
 *   re-read over REST (captions, your notes, the candidate ledger, the agenda) and merged in.
 * - After `MAX_RECONNECT_ATTEMPTS` failed attempts it stops and reports `error`, so the room says
 *   so and offers Try again instead of going quiet.
 *
 * Consumed: `caption`, `agent-delta`, `agent-note` (yours only), `agent-candidate`,
 * `candidate-resolution`, `candidate-lock`, `agent-agenda`, `agenda-status`, `agent-nudge` (host
 * only), `room-state`, `hand`, `reaction`, `meeting-ended`, `presence`.
 * Emitted: `join`, `reauth`, `candidate-resolved`, `candidate-lock`, `agenda-status`, `hand`,
 * `reaction`, `end-meeting`.
 *
 * Not on the phone (decision, see system.md N14): chat, suggestions, context fills and in-room
 * alerts. Alerts still reach the person through the Inbox (notification-service).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { applyCaption, emptyCaptionState, type CaptionPayload, type CaptionState } from './captions';
import {
  applyNoteDelta,
  applyNoteFinal,
  emptyNotesState,
  hydrateNotes,
  type NoteDeltaPayload,
  type NoteFinalPayload,
  type NotesState,
} from './notes';
import {
  applyLiveCandidates,
  applyLock,
  applyResolution,
  applyRoomLocks,
  emptyCandidatesState,
  expireSettled,
  hideCandidate as hideCandidateIn,
  hydrateCandidates,
  settleLocally,
  updateCandidate as updateCandidateIn,
  type Candidate,
  type CandidateEventPayload,
  type CandidateOutcome,
  type CandidateRow,
  type CandidatesState,
  type LockPayload,
  type ResolutionPayload,
} from './candidates';
import {
  applyAgentAgenda,
  applyHostAgendaStatus,
  applyNudge,
  beginHostStatus,
  commitHostStatus,
  dismissNudge as dismissNudgeIn,
  emptyNudgeState,
  hydrateAgenda,
  initialAgendaState,
  rollbackHostStatus,
  type AgendaState,
  type NudgeState,
} from './agenda';
import {
  applyHand,
  applyReaction,
  applyRoomHands,
  emptyHandsState,
  expireReactions,
  type FloatingReaction,
  type HandsState,
  type ReactionId,
} from './room-live';
import { MAX_RECONNECT_ATTEMPTS, backoffMs, type LiveLink } from './connection';
import type {
  AgendaItem,
  AgendaStatus,
  AgentAgendaPayload,
  AgentNudgePayload,
  JoinAck,
  MeetingEndedPayload,
  RoomAck,
  RoomStatePayload,
  Wrapped,
} from './types';

/** Durable reads the socket re-hydrates from on every (re)connect. Each may fail on its own. */
export interface Hydrators {
  transcript: () => Promise<CaptionPayload[]>;
  notes: () => Promise<NoteFinalPayload[]>;
  candidates: () => Promise<{ decisions: CandidateRow[]; actions: CandidateRow[] }>;
  agenda: () => Promise<AgendaItem[] | null>;
}

export interface MeetingSocketDeps {
  url: string | null;
  getToken: () => Promise<string | null>;
  meId: string | null;
  hydrate: Hydrators;
  connect?: (url: string, opts: Parameters<typeof io>[1]) => Socket;
}

export interface MeetingSocketState {
  status: LiveLink;
  everJoined: boolean;
  retry: () => void;
  captions: CaptionState;
  presence: string[];
  notes: NotesState;
  candidates: CandidatesState;
  announceCandidate: (id: string, outcome: CandidateOutcome) => Promise<RoomAck>;
  settleCandidate: (id: string, outcome: 'confirmed' | 'dismissed') => void;
  updateCandidate: (id: string, patch: Partial<Pick<Candidate, 'content' | 'rationale' | 'assigneeId' | 'dueDate'>>) => void;
  hideCandidate: (id: string) => void;
  lockCandidate: (id: string, locked: boolean) => Promise<RoomAck>;
  agenda: AgendaState;
  agendaHost: {
    begin: (itemId: string, status: AgendaStatus, op: number) => void;
    commit: (itemId: string, op: number, row: AgendaItem | null) => void;
    rollback: (itemId: string, op: number) => void;
    announce: (itemId: string) => Promise<RoomAck>;
  };
  nudges: NudgeState;
  dismissNudge: (id: string) => void;
  hands: HandsState;
  setHand: (raised: boolean) => Promise<RoomAck>;
  reactions: FloatingReaction[];
  react: (reaction: ReactionId) => Promise<RoomAck>;
  ended: MeetingEndedPayload | null;
  announceEnd: () => Promise<RoomAck>;
}

export const REAUTH_MS = 40_000;
const ACK_TIMEOUT_MS = 6000;
const NOT_CONNECTED: RoomAck = { ok: false, error: 'NOT_CONNECTED' };

export function useMeetingSocket(meetingId: string, deps: MeetingSocketDeps): MeetingSocketState {
  const { url } = deps;
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const [status, setStatus] = useState<LiveLink>(url ? 'connecting' : 'disabled');
  const [everJoined, setEverJoined] = useState(false);
  const [captions, setCaptions] = useState<CaptionState>(emptyCaptionState);
  const [presence, setPresence] = useState<string[]>([]);
  const [notes, setNotes] = useState<NotesState>(emptyNotesState);
  const [candidates, setCandidates] = useState<CandidatesState>(emptyCandidatesState);
  const [agenda, setAgenda] = useState<AgendaState>(() => initialAgendaState(null));
  const [nudges, setNudges] = useState<NudgeState>(emptyNudgeState);
  const [hands, setHands] = useState<HandsState>(emptyHandsState);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [ended, setEnded] = useState<MeetingEndedPayload | null>(null);
  const [generation, setGeneration] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let reauthTimer: ReturnType<typeof setInterval> | undefined;

    const make = depsRef.current.connect ?? ((u, o) => io(u, o));
    const socket = make(`${url.replace(/\/+$/, '')}/v1`, {
      // Called before EVERY connection attempt, so each handshake carries a token minted now.
      auth: (cb: (data: object) => void) => {
        depsRef.current
          .getToken()
          .then((token) => cb({ token: token ?? '' }))
          .catch(() => cb({ token: '' }));
      },
      transports: ['websocket'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
    });
    socketRef.current = socket;

    // Every re-hydrate degrades on its own: a failed read never breaks the live stream.
    const rehydrate = () => {
      const h = depsRef.current.hydrate;
      h.transcript()
        .then((items) => {
          if (!cancelled && items.length) setCaptions((prev) => items.reduce(applyCaption, prev));
        })
        .catch(() => undefined);
      h.notes()
        .then((items) => {
          if (!cancelled && items.length) setNotes((prev) => hydrateNotes(prev, items));
        })
        .catch(() => undefined);
      h.candidates()
        .then((res) => {
          if (!cancelled) setCandidates((prev) => hydrateCandidates(prev, res));
        })
        .catch(() => undefined);
      h.agenda()
        .then((items) => {
          if (!cancelled) setAgenda((prev) => hydrateAgenda(prev, items));
        })
        .catch(() => {
          if (!cancelled) setAgenda((prev) => hydrateAgenda(prev, null));
        });
    };

    const reauth = async () => {
      if (!socket.connected) return;
      try {
        const token = await depsRef.current.getToken();
        if (!token || cancelled) return;
        await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('reauth', { token });
      } catch {
        // Retried on the next tick; the next connect gets a fresh token anyway.
      }
    };

    const giveUp = () => {
      socket.disconnect();
      setStatus('error');
    };

    const scheduleRetry = () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (attempts >= MAX_RECONNECT_ATTEMPTS) {
        giveUp();
        return;
      }
      retryTimer = setTimeout(() => {
        if (!cancelled) socket.connect();
      }, backoffMs(attempts));
      attempts += 1;
    };

    const join = () => {
      rehydrate();
      socket.emit('join', { meetingId }, (ack: JoinAck) => {
        if (cancelled) return;
        if (ack?.ok) {
          attempts = 0;
          joinedRef.current = true;
          setEverJoined(true);
          setStatus('joined');
          setPresence(ack.presence ?? []);
        } else if (ack?.error === 'FORBIDDEN') {
          setStatus('forbidden');
        } else {
          setStatus('error');
        }
      });
    };

    socket.on('connect', () => {
      join();
      if (reauthTimer) clearInterval(reauthTimer);
      reauthTimer = setInterval(() => void reauth(), REAUTH_MS);
    });
    socket.on('disconnect', (reason: string) => {
      if (cancelled) return;
      if (reauthTimer) clearInterval(reauthTimer);
      joinedRef.current = false;
      setStatus(reason === 'io client disconnect' ? 'connecting' : 'reconnecting');
      // The server closed it (a deploy, a kick): Socket.io does not come back on its own then.
      if (reason === 'io server disconnect') scheduleRetry();
    });
    socket.on('connect_error', () => {
      if (cancelled) return;
      setStatus((prev) => (prev === 'joined' || prev === 'reconnecting' ? 'reconnecting' : 'connecting'));
      if (!socket.active) {
        // A handshake the gateway refused (an expired token, a deploy): retry with a fresh token.
        scheduleRetry();
      } else {
        attempts += 1;
        if (attempts >= MAX_RECONNECT_ATTEMPTS) giveUp();
      }
    });

    const mine =
      <P,>(handler: (payload: P) => void) =>
      (event: Wrapped<P>) => {
        if (cancelled || event?.meetingId !== meetingId || event.payload === undefined) return;
        handler(event.payload);
      };

    socket.on('caption', mine<CaptionPayload>((p) => setCaptions((prev) => applyCaption(prev, p))));
    socket.on('agent-delta', mine<NoteDeltaPayload>((p) => setNotes((prev) => applyNoteDelta(prev, p))));
    socket.on('agent-note', mine<NoteFinalPayload>((p) => setNotes((prev) => applyNoteFinal(prev, p))));
    socket.on('agent-candidate', mine<CandidateEventPayload>((p) => setCandidates((prev) => applyLiveCandidates(prev, p))));
    socket.on('candidate-resolution', mine<ResolutionPayload>((p) => setCandidates((prev) => applyResolution(prev, p, Date.now()))));
    socket.on('candidate-lock', mine<LockPayload>((p) => setCandidates((prev) => applyLock(prev, p))));
    socket.on('agent-agenda', mine<AgentAgendaPayload>((p) => setAgenda((prev) => applyAgentAgenda(prev, p))));
    socket.on('agenda-status', mine<{ item?: AgendaItem }>((p) => setAgenda((prev) => applyHostAgendaStatus(prev, p.item))));
    socket.on('agent-nudge', mine<AgentNudgePayload>((p) => setNudges((prev) => applyNudge(prev, p))));
    socket.on(
      'room-state',
      mine<RoomStatePayload>((p) => {
        setCandidates((prev) => applyRoomLocks(prev, p.locks));
        setHands(applyRoomHands(p.hands));
      }),
    );
    socket.on('hand', mine<{ userId?: string; raised?: boolean; at?: string }>((p) => setHands((prev) => applyHand(prev, p))));
    socket.on(
      'reaction',
      mine<{ id?: string; userId?: string; reaction?: string }>((p) => setReactions((prev) => applyReaction(prev, p, Date.now()))),
    );
    socket.on('meeting-ended', mine<MeetingEndedPayload>((p) => setEnded({ byUserId: p.byUserId, at: p.at })));
    socket.on('presence', (members: string[]) => {
      if (!cancelled) setPresence(Array.isArray(members) ? members : []);
    });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (reauthTimer) clearInterval(reauthTimer);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      joinedRef.current = false;
    };
  }, [url, meetingId, generation]);

  // Settled cards and floating reactions fade after a few seconds.
  const needsTick = Object.keys(candidates.settled).length > 0 || reactions.length > 0;
  useEffect(() => {
    if (!needsTick) return;
    const id = setInterval(() => {
      const now = Date.now();
      setCandidates((prev) => expireSettled(prev, now));
      setReactions((prev) => expireReactions(prev, now));
    }, 500);
    return () => clearInterval(id);
  }, [needsTick]);

  const retry = useCallback(() => {
    setStatus(url ? 'connecting' : 'disabled');
    setGeneration((g) => g + 1);
  }, [url]);

  /** Emit with an ack; refresh the gateway's copy of our token first when it verifies with core-api. */
  const emitAck = useCallback(
    async (event: string, payload: object, refresh = false): Promise<RoomAck> => {
      const socket = socketRef.current;
      if (!socket?.connected || !joinedRef.current) return NOT_CONNECTED;
      try {
        if (refresh) {
          const token = await depsRef.current.getToken();
          if (token) await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('reauth', { token });
        }
        return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, { meetingId, ...payload })) as RoomAck;
      } catch {
        return { ok: false, error: 'TIMEOUT' };
      }
    },
    [meetingId],
  );

  const announceCandidate = useCallback(
    (id: string, outcome: CandidateOutcome) => emitAck('candidate-resolved', { candidateId: id, outcome }, true),
    [emitAck],
  );
  const settleCandidate = useCallback(
    (id: string, outcome: 'confirmed' | 'dismissed') =>
      setCandidates((prev) => settleLocally(prev, id, outcome, depsRef.current.meId ?? '', Date.now())),
    [],
  );
  const updateCandidate = useCallback(
    (id: string, patch: Partial<Pick<Candidate, 'content' | 'rationale' | 'assigneeId' | 'dueDate'>>) =>
      setCandidates((prev) => updateCandidateIn(prev, id, patch)),
    [],
  );
  // "Hide for me" is personal and lasts while this meeting is open on this phone.
  const hideCandidate = useCallback((id: string) => setCandidates((prev) => hideCandidateIn(prev, id)), []);
  const lockCandidate = useCallback(
    (id: string, locked: boolean) => emitAck('candidate-lock', { candidateId: id, locked }),
    [emitAck],
  );

  const agendaHost = useMemo(
    () => ({
      begin: (itemId: string, s: AgendaStatus, op: number) => setAgenda((prev) => beginHostStatus(prev, itemId, s, op)),
      commit: (itemId: string, op: number, row: AgendaItem | null) => setAgenda((prev) => commitHostStatus(prev, itemId, op, row)),
      rollback: (itemId: string, op: number) => setAgenda((prev) => rollbackHostStatus(prev, itemId, op)),
      announce: (itemId: string) => emitAck('agenda-status', { itemId }, true),
    }),
    [emitAck],
  );
  const dismissNudge = useCallback((id: string) => setNudges((prev) => dismissNudgeIn(prev, id)), []);
  const setHand = useCallback((raised: boolean) => emitAck('hand', { raised }), [emitAck]);
  const react = useCallback((reaction: ReactionId) => emitAck('reaction', { reaction }), [emitAck]);
  const announceEnd = useCallback(() => emitAck('end-meeting', {}, true), [emitAck]);

  return {
    status,
    everJoined,
    retry,
    captions,
    presence,
    notes,
    candidates,
    announceCandidate,
    settleCandidate,
    updateCandidate,
    hideCandidate,
    lockCandidate,
    agenda,
    agendaHost,
    nudges,
    dismissNudge,
    hands,
    setHand,
    reactions,
    react,
    ended,
    announceEnd,
  };
}
