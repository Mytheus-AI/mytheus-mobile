import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../ApiProvider';
import { endpoints } from '../endpoints';
import { qk } from '../queryKeys';
import { nameFromEmail } from '@/lib/people';
import { usePeople } from './identity';

/** Internal user ids are UUIDs; anything else is not a person and is never sent (the web 404s it too). */
export const PERSON_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DirectoryEntry {
  id: string;
  name: string;
  email: string;
  role: string | null;
  isYou: boolean;
}

/**
 * The people in the open workspace, by name: identity's member list (`GET /users`, already scoped
 * to the workspace by the gateway) with names joined in `usePeople` (display name, then Clerk, then
 * the email read as a name; N20). Sorted by name, you first. `orgName` is the open workspace's name.
 */
export function useDirectory() {
  const { people, orgName } = usePeople();
  // Same key as `usePeople`, so this reads the list it already fetched.
  const api = useApi();
  const members = useQuery({ queryKey: qk.members, queryFn: () => endpoints.members(api), staleTime: 5 * 60_000 });
  const entries = useMemo<DirectoryEntry[] | undefined>(() => {
    if (!members.data || !people) return undefined;
    return members.data.items
      .map((m) => {
        const joined = people.get(m.id);
        return { id: m.id, name: joined?.name ?? nameFromEmail(m.email), email: m.email, role: m.role, isYou: !!joined?.isYou };
      })
      .sort((a, b) => (a.isYou === b.isYou ? a.name.localeCompare(b.name) : a.isYou ? -1 : 1));
  }, [members.data, people]);
  return { entries, query: members, orgName };
}

/**
 * One person's profile (`GET /bff/people/{user_id}`): role, bio, department, teams, skills, the
 * topics their Myte listens for, and recent meetings. Another workspace's person and an unknown
 * one are the same 404.
 */
export function usePersonProfile(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: qk.person(id),
    queryFn: () => endpoints.personProfile(api, id),
    enabled: PERSON_ID.test(id),
    staleTime: 60_000,
  });
}
