/**
 * Where a web link leads in this app. notification-service stores links as mytheus-ui paths
 * (`/meetings/{id}`, `/decisions`, `/work/updates`, and the legacy `/status-requests`, `/tasks`,
 * `/promises` that mytheus-ui redirects), so a notification tapped on a phone opens the same
 * thing it opens on the web. Anything this app has no screen for returns null and is shown
 * without a link rather than guessed at.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WorkTab = 'tasks' | 'promises' | 'updates';

export function appRoute(href: string | null | undefined): string | null {
  if (!href || !href.startsWith('/') || href.startsWith('//')) return null;
  const [rawPath] = href.split(/[?#]/);
  const path = rawPath.replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'meetings' && parts[1] && UUID.test(parts[1])) {
    // /meetings/{m}/decisions/{d}: the decision record (it carries its own lineage).
    if (parts[2] === 'decisions' && parts[3] && UUID.test(parts[3])) return `/decisions/${parts[3]}`;
    return `/meetings/${parts[1]}`;
  }
  if (path === '/meetings') return '/meetings';
  if (parts[0] === 'decisions') {
    return parts[1] && UUID.test(parts[1]) ? `/decisions/${parts[1]}` : '/decisions';
  }
  if (path === '/inbox' || path === '/notifications') return '/inbox';
  if (path === '/work' || path === '/work/tasks' || path === '/tasks') return '/work?tab=tasks';
  if (path === '/work/promises' || path === '/promises') return '/work?tab=promises';
  if (path === '/work/updates' || path === '/status-requests') return '/work?tab=updates';
  // A briefing from your agent: its push opens the briefing screen; the list is Home.
  if (parts[0] === 'briefings' && parts[1] && UUID.test(parts[1])) return `/briefings/${parts[1]}`;
  if (path === '/briefings') return '/';
  if (path === '/dashboard' || path === '/') return '/';
  return null;
}
