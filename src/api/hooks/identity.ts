import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@clerk/expo';
import { useApi } from '../ApiProvider';
import { endpoints } from '../endpoints';
import { qk } from '../queryKeys';
import { joinPeople, type ClerkMemberName, type Person } from '@/lib/people';

/** The signed-in person's internal profile (`GET /users/me`): their internal id, role, agent. */
export function useMe() {
  const api = useApi();
  return useQuery({ queryKey: qk.me, queryFn: () => endpoints.me(api), staleTime: 5 * 60_000 });
}

/** Internal user id -> name, for "Confirmed by Maya", assignees and hands. */
export function usePeople(): { people: Map<string, Person> | undefined; meId: string | null } {
  const api = useApi();
  const me = useMe();
  const members = useQuery({ queryKey: qk.members, queryFn: () => endpoints.members(api), staleTime: 5 * 60_000 });
  const { memberships } = useOrganization({ memberships: { pageSize: 100 } });
  const clerk = useMemo<ClerkMemberName[]>(
    () =>
      (memberships?.data ?? []).flatMap((m) => {
        const u = m.publicUserData;
        if (!u?.userId) return [];
        return [{ clerkUserId: u.userId, firstName: u.firstName ?? null, lastName: u.lastName ?? null, identifier: u.identifier ?? null }];
      }),
    [memberships?.data],
  );
  const meId = me.data?.id ?? null;
  const people = useMemo(
    () => (members.data ? joinPeople(members.data.items, clerk, meId) : undefined),
    [members.data, clerk, meId],
  );
  return { people, meId };
}
