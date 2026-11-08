/**
 * The session, backed by Clerk. Plan 1-2 section 7 step 1.
 *
 * This file used to be a module-level boolean with a listener set: a mock session that any
 * caller could flip to `true`. It now delegates to Clerk, and the surface is kept identical
 * (`useSignedIn`, `useSessionActions`) so the three screens that consume it did not need
 * rewriting to gain real auth.
 *
 * The `signIn()` free function is deliberately GONE rather than adapted. Real sign-in needs a
 * strategy, a redirect and a browser session; a function that pretends to sign someone in
 * with no arguments cannot be implemented honestly, and leaving a working-looking stub would
 * invite a screen to call it and appear authenticated while holding no token. Anything that
 * needs to start a sign-in uses `useSSO`/`useSignIn` from `@clerk/clerk-expo` directly.
 *
 * Tokens live in the Keychain/Keystore via `src/lib/secure-store.ts`, never AsyncStorage.
 */

import { useAuth } from '@clerk/clerk-expo';

/**
 * True once Clerk has a live session.
 *
 * Returns false while Clerk is still loading, which is the safe default: a route guard that
 * treats "not yet known" as signed-in flashes authenticated UI to a signed-out user, and the
 * request behind it fails with a 401 a moment later.
 */
export function useSignedIn(): boolean {
  const { isLoaded, isSignedIn } = useAuth();
  return isLoaded && Boolean(isSignedIn);
}

/** Whether Clerk has finished restoring a cached session. Screens use this to hold the
 *  splash rather than deciding a route on incomplete information. */
export function useSessionLoaded(): boolean {
  return useAuth().isLoaded;
}

export function useSessionActions() {
  const { signOut } = useAuth();
  // Clerk clears both its in-memory session and the secure-store cache, so there is nothing
  // extra to tear down here. Doing it manually as well would risk clearing the cache while
  // Clerk still believed the session was live.
  return { signOut: () => signOut() };
}
