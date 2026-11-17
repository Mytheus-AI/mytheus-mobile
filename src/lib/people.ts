/**
 * Names for internal user ids. identity-tenant-service (`GET /users`) knows each member's internal
 * id, Clerk id, email and the name Mytheus stores (`display_name`). mytheus-ui joins Clerk names on
 * the server with Clerk's backend client. The phone has no backend key, so it joins on the Clerk
 * organization's member list, which the signed-in member may read through Clerk's frontend API.
 * Precedence, as in mytheus-ui: identity's `display_name`, then the Clerk name, then the email's
 * local part read as a name ("maya.rao@" -> "Maya Rao").
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

/** "maya.rao@acme.test" -> "Maya Rao": [._-] become spaces and each word is capitalised. */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] || email;
  const words = local.replace(/[._-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return words.length ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : email;
}

/** identity's display name, else the Clerk name, else the email read as a name. */
export function personName(displayNameStored: string | null | undefined, clerkName: string | null | undefined, email: string): string {
  return displayNameStored?.trim() || clerkName?.trim() || nameFromEmail(email);
}

export function joinPeople(members: readonly Member[], clerk: readonly ClerkMemberName[], meId: string | null): Map<string, Person> {
  const byClerk = new Map(clerk.map((c) => [c.clerkUserId, c]));
  const out = new Map<string, Person>();
  for (const m of members) {
    const c = m.clerk_user_id ? byClerk.get(m.clerk_user_id) : undefined;
    const name = personName(m.display_name, c ? displayName(c.firstName, c.lastName) : null, m.email);
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
