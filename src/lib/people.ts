/**
 * Names for internal user ids. identity-tenant-service (`GET /users`) knows each member's internal
 * id, Clerk id and email but not their name; names live in Clerk. mytheus-ui joins them on the
 * server with Clerk's backend client. The phone has no backend key, so it joins on the Clerk
 * organization's member list, which the signed-in member may read through Clerk's frontend API.
 * A person Clerk cannot name falls back to the part of their email before the @.
 */

import type { Member } from '@/api/types';

export interface ClerkMemberName {
  clerkUserId: string;
  firstName: string | null;
  lastName: string | null;
  identifier: string | null;
}

export interface Person {
  id: string;
  name: string;
  email: string;
  isYou: boolean;
}

export function displayName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

export function joinPeople(members: readonly Member[], clerk: readonly ClerkMemberName[], meId: string | null): Map<string, Person> {
  const byClerk = new Map(clerk.map((c) => [c.clerkUserId, c]));
  const out = new Map<string, Person>();
  for (const m of members) {
    const c = m.clerk_user_id ? byClerk.get(m.clerk_user_id) : undefined;
    const name = (c && displayName(c.firstName, c.lastName)) || m.email.split('@')[0] || m.email;
    out.set(m.id, { id: m.id, name, email: m.email, isYou: m.id === meId });
  }
  return out;
}

/** "Maya" for others, "You" for the signed-in person, "Someone" when unknown. */
export function nameFor(people: Map<string, Person> | undefined, id: string | null | undefined, opts: { you?: boolean } = {}): string {
  if (!id) return 'Someone';
  const p = people?.get(id);
  if (!p) return 'Someone';
  if (p.isYou && opts.you !== false) return 'You';
  return p.name;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
