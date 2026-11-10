import { useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../ApiProvider';
import { endpoints } from '../endpoints';
import { useKeyedMutation } from '../mutation';
import { qk } from '../queryKeys';
import type { ActionItem, Decision } from '../types';
import { describeNotification, type FeedRowInput } from '@/lib/notification-copy';
import { inboxCounts, toInboxItems, toStatusView, type InboxCounts, type InboxItem } from '@/lib/inbox';

export type InboxArm = 'notifications' | 'updates' | 'review';

export interface InboxRead {
  items: InboxItem[];
  counts: InboxCounts;
  /** Arms that failed; the rest of the inbox still shows. */
  failed: InboxArm[];
  loading: boolean;
  refreshing: boolean;
  refetch: () => void;
}

/**
 * The Inbox: the same three reads mytheus-ui `lib/inbox-server.ts` merges (your notifications,
 * the status updates you owe, and what your agents detected that nobody has confirmed yet), each
 * failing on its own so the screen can say which part is missing.
 */
export function useInbox(): InboxRead {
  const api = useApi();
  const results = useQueries({
    queries: [
      { queryKey: qk.notifications('unread'), queryFn: () => endpoints.notifications(api, 'unread') },
      { queryKey: qk.notifications('read'), queryFn: () => endpoints.notifications(api, 'read') },
      { queryKey: qk.statusRequests('pending'), queryFn: () => endpoints.statusRequests(api, 'pending') },
      { queryKey: qk.dashboard, queryFn: () => endpoints.dashboard(api) },
    ],
  });
  const [unread, read, updates, dashboard] = results;

  return useMemo(() => {
    const failed: InboxArm[] = [];
    const notifOk = unread.data && read.data;
    if ((unread.isError || read.isError) && !notifOk) failed.push('notifications');
    if (updates.isError && !updates.data) failed.push('updates');
    const reviewArm = dashboard.data?.needs_review;
    if ((dashboard.isError && !dashboard.data) || reviewArm?.status === 'degraded') failed.push('review');

    const rows = [...(unread.data?.items ?? []), ...(read.data?.items ?? [])] as FeedRowInput[];
    const items = toInboxItems(
      {
        notifications: rows.map(describeNotification),
        updates: (updates.data?.items ?? []).map(toStatusView),
        reviews: (reviewArm?.items ?? []).map((r) => ({ ...r, meeting_title: r.meeting_title ?? null })),
      },
      Date.now(),
    );
    return {
      items,
      counts: inboxCounts(items),
      failed,
      loading: results.some((r) => r.isPending),
      refreshing: results.some((r) => r.isRefetching),
      refetch: () => results.forEach((r) => void r.refetch()),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread.data, read.data, updates.data, dashboard.data, unread.isError, read.isError, updates.isError, dashboard.isError, results.map((r) => r.status + r.fetchStatus).join()]);
}

/** Mark a notification read or dismiss it (`PATCH /notifications/{id}`). */
export function useNotificationStatus() {
  const api = useApi();
  const qc = useQueryClient();
  return useKeyedMutation(
    ({ id, status }: { id: string; status: 'read' | 'dismissed' }, key: string) =>
      endpoints.setNotificationStatus(api, id, status, key),
    {
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: ['notifications'] });
      },
    },
  );
}

/**
 * Confirm or dismiss something your agents detected, from the Inbox or a meeting page. Never
 * automatic: only this explicit tap writes it (CLAUDE.md, no silent commits).
 */
export function useReviewCandidate() {
  const api = useApi();
  const qc = useQueryClient();
  return useKeyedMutation<
    { kind: 'decision' | 'action'; id: string; outcome: 'confirm' | 'dismiss' },
    Decision | ActionItem
  >(
    ({ kind, id, outcome }, key) => {
      if (kind === 'decision') {
        return outcome === 'confirm' ? endpoints.confirmDecision(api, id, key) : endpoints.dismissDecision(api, id, key);
      }
      return outcome === 'confirm' ? endpoints.confirmAction(api, id, key) : endpoints.dismissAction(api, id, key);
    },
    {
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: qk.dashboard });
        void qc.invalidateQueries({ queryKey: qk.decisions });
        void qc.invalidateQueries({ queryKey: ['tasks'] });
        void qc.invalidateQueries({ queryKey: ['recap'] });
      },
    },
  );
}
