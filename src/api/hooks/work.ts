import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../ApiProvider';
import { endpoints } from '../endpoints';
import { useKeyedMutation } from '../mutation';
import { qk } from '../queryKeys';
import type { Commitment, Task } from '../types';

/**
 * Your tasks from `GET /api/v1/actions/mine`: confirmed actions assigned to you, including tasks
 * created with no meeting (`meeting_id: null`), which `GET /api/v1/actions?assignee_id=me` leaves
 * out. Soonest due first, undated last (server order).
 */
export function useTasks(status: 'confirmed' | 'done') {
  const api = useApi();
  return useQuery({ queryKey: qk.tasks(status), queryFn: () => endpoints.myTasks(api, status) });
}

/**
 * Mark a task done (`POST /api/v1/actions/{id}/done`), at once and optimistically: the task leaves
 * the open list before the server answers and comes back if it refuses. Undo is a real write
 * (`useReopenTask`), not a client-side grace window.
 */
export function useCompleteTask() {
  const api = useApi();
  const qc = useQueryClient();
  return useKeyedMutation((id: string, key: string) => endpoints.completeTask(api, id, key), {
    onMutate: async ({ input: id }) => {
      await qc.cancelQueries({ queryKey: qk.tasks('confirmed') });
      const before = qc.getQueryData<{ items: Task[] }>(qk.tasks('confirmed'));
      if (before) qc.setQueryData(qk.tasks('confirmed'), { items: before.items.filter((t) => t.id !== id) });
      return { before };
    },
    onError: (_e, _v, ctx) => {
      const before = (ctx as { before?: { items: Task[] } } | undefined)?.before;
      if (before) qc.setQueryData(qk.tasks('confirmed'), before);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/**
 * Reopen a done task (`POST /api/v1/actions/{id}/reopen`: done -> confirmed, for its assignee or
 * owner). Optimistic: `task` goes back into the open list at once, and out again on an error.
 */
export function useReopenTask() {
  const api = useApi();
  const qc = useQueryClient();
  return useKeyedMutation((task: Task, key: string) => endpoints.reopenTask(api, task.id, key), {
    onMutate: async ({ input: task }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const open = qc.getQueryData<{ items: Task[] }>(qk.tasks('confirmed'));
      const done = qc.getQueryData<{ items: Task[] }>(qk.tasks('done'));
      if (open && !open.items.some((t) => t.id === task.id)) {
        qc.setQueryData(qk.tasks('confirmed'), { items: [{ ...task, status: 'confirmed' }, ...open.items] });
      }
      if (done) qc.setQueryData(qk.tasks('done'), { items: done.items.filter((t) => t.id !== task.id) });
      return { open, done };
    },
    onError: (_e, _v, ctx) => {
      const c = ctx as { open?: { items: Task[] }; done?: { items: Task[] } } | undefined;
      if (c?.open) qc.setQueryData(qk.tasks('confirmed'), c.open);
      if (c?.done) qc.setQueryData(qk.tasks('done'), c.done);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/** Your private promises ("I'll send it Friday"), noted by your agent. */
export function useCommitments(status: 'open' | 'done') {
  const api = useApi();
  return useQuery({ queryKey: qk.commitments(status), queryFn: () => endpoints.commitments(api, status) });
}

/** Close, dismiss or reopen a promise, optimistically, rolled back if the server says no. */
export function useSetCommitment() {
  const api = useApi();
  const qc = useQueryClient();
  return useKeyedMutation(
    ({ id, status }: { id: string; status: Commitment['status'] }, key: string) =>
      endpoints.setCommitmentStatus(api, id, status, key),
    {
      onMutate: async ({ input }) => {
        await qc.cancelQueries({ queryKey: qk.commitments('open') });
        const before = qc.getQueryData<{ items: Commitment[] }>(qk.commitments('open'));
        if (before && input.status !== 'open') {
          qc.setQueryData(qk.commitments('open'), { items: before.items.filter((c) => c.id !== input.id) });
        }
        return { before };
      },
      onError: (_e, _v, ctx) => {
        const before = (ctx as { before?: { items: Commitment[] } } | undefined)?.before;
        if (before) qc.setQueryData(qk.commitments('open'), before);
      },
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: ['commitments'] });
      },
    },
  );
}

/** "How is it going?" requests you owe before a follow-up meeting. */
export function useStatusRequests(state: 'pending' | 'answered') {
  const api = useApi();
  return useQuery({ queryKey: qk.statusRequests(state), queryFn: () => endpoints.statusRequests(api, state) });
}

export function useAnswerStatus() {
  const api = useApi();
  const qc = useQueryClient();
  return useKeyedMutation(
    ({ id, text }: { id: string; text: string }, key: string) => endpoints.answerStatusRequest(api, id, text, key),
    {
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: ['status-requests'] });
      },
    },
  );
}
