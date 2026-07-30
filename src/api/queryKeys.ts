/**
 * Query key factory.
 *
 * Keys carry NO tenant component, deliberately. The tenant is a property of the bearer token,
 * so two tenants can never share a cache inside one signed-in session, and sign-out clears
 * the cache outright. Putting an org id in a key would require the client to know its
 * `org_id`, which is the one thing it must never handle.
 */

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  meetings: (status?: string) => ['meetings', status ?? 'all'] as const,
  meeting: (id: string) => ['meetings', 'detail', id] as const,
  teams: ['teams'] as const,
  departments: ['departments'] as const,
};
