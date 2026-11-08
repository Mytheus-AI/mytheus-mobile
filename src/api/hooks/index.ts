/**
 * One hook per endpoint, over the base client. Plan 1-2 section 7 step 2.
 *
 * Components never call `fetch` and never call the client directly: every read goes through a
 * hook here so caching, retry policy and error shape are decided in one place.
 */

import { useQuery } from '@tanstack/react-query';

import { useApi } from '../provider';
import { queryKeys } from '../queryKeys';
import type { Dashboard, Department, MeetingPage, Team } from '../types';

/** The home screen's single request: four panels, each carrying its own status. */
export function useDashboard() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => api<Dashboard>('/bff/dashboard'),
  });
}

export function useMeetings(status?: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.meetings(status),
    // First page only. Infinite scroll uses `next_cursor` and lands with the screen that
    // needs it; pretending to paginate while ignoring the cursor would silently cap the list
    // at 50 with nothing indicating that rows were dropped.
    queryFn: () => api<MeetingPage>('/api/v1/meetings', { query: { status, limit: 50 } }),
  });
}

/**
 * The people screen's data source.
 *
 * Teams, not an org-member roster: `identity-tenant-service` has no `GET /users` surface yet,
 * so there is nothing to read a member list from. Recorded as an open gap in the band file
 * rather than faked with a client-side join.
 */
export function useTeams() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.teams,
    queryFn: () => api<Team[]>('/api/v1/teams'),
  });
}

export function useDepartments() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.departments,
    queryFn: () => api<Department[]>('/api/v1/departments'),
  });
}
