import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useApi } from '../ApiProvider';
import { endpoints } from '../endpoints';
import { qk } from '../queryKeys';

/** Your meetings, newest first, a page at a time. */
export function useMeetings() {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: qk.meetings,
    queryFn: ({ pageParam }) => endpoints.meetings(api, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? null,
  });
}

export function useMeeting(id: string) {
  const api = useApi();
  return useQuery({ queryKey: qk.meeting(id), queryFn: () => endpoints.meeting(api, id), enabled: !!id });
}

/** The meeting's confirmed results: decisions, actions with owners, the agenda's outcome. */
export function useRecap(id: string, enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: qk.recap(id), queryFn: () => endpoints.recap(api, id), enabled: !!id && enabled });
}

/** Your agent's notes for this meeting: private to you (`worklogs?user_id=me`). */
export function useMyNotes(id: string, enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: qk.myNotes(id), queryFn: () => endpoints.myNotes(api, id), enabled: !!id && enabled });
}

/** What you missed: for a meeting your agent attended for you (bff catch-up). */
export function useCatchUp(id: string, enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: qk.catchUp(id), queryFn: () => endpoints.catchUp(api, id), enabled: !!id && enabled });
}

/** Your standing in the call: consent already given for this meeting, recording, ended. */
export function useRoomSession(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: qk.roomSession(id),
    queryFn: () => endpoints.roomSession(api, id),
    enabled: !!id,
    staleTime: 0,
  });
}
