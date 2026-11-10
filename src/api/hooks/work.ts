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

/** Mark a task done (`POST /api/v1/actions/{id}/done`). There is no reopen route, so the screen
 *  holds the write for a short grace period with Undo before it calls this. */
export function useCompleteTask() {
  const api = useApi();
  const qc = useQueryClient();
  return useKeyedMutation((id: string, key: string) => endpoints.completeTask(api, id, key), {
    onSuccess: (done) => {
      qc.setQueryData<{ items: Task[] }>(qk.tasks('confirmed'), (prev) =>
        prev ? { items: prev.items.filter((t) => t.id !== done.id) } : prev,
      );
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
