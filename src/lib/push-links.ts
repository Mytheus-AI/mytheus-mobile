/**
 * Where a tapped push notification leads. notification-service sends `data: { notification_id,
 * link? }`, `link` being the same relative mytheus-ui path the Inbox row carries, so a tap opens
 * what the row opens (`appRoute`). Anything without a screen here opens the Inbox, where the row
 * itself is. Pure, so it is unit-tested.
 */

import { appRoute } from './routes';

export function pushRoute(data: unknown): string {
  const link = data && typeof data === 'object' ? (data as { link?: unknown }).link : undefined;
  return appRoute(typeof link === 'string' ? link : null) ?? '/inbox';
}

/** What this phone remembers about its registration, so sign-out can remove exactly it. */
export interface StoredPushDevice {
  id: string;
  /** `${clerkUserId}:${orgId}`: a registration belongs to one person in one workspace. */
  scope: string;
}

export function parseStoredDevice(raw: string | null): StoredPushDevice | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredPushDevice>;
    return typeof v.id === 'string' && typeof v.scope === 'string' ? { id: v.id, scope: v.scope } : null;
  } catch {
    return null;
  }
}
