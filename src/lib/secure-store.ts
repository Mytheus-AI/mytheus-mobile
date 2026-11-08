/**
 * The secure-store wrapper. Tokens go through here and nowhere else.
 *
 * expo-secure-store is backed by the iOS Keychain and the Android Keystore, so the value is
 * encrypted at rest and unreadable to another app or to a JS-level dump. AsyncStorage is
 * plain, JS-readable storage: a session token there is readable by anything that can execute
 * in the app's JS context and survives on a lost device. That is why the invariant in
 * CLAUDE.md is "expo-secure-store only", and why Clerk's token cache is wired to this file
 * rather than left on its default.
 *
 * Every operation swallows its error and degrades to "no cached token". A keychain read can
 * genuinely fail - a locked device, a restored backup on new hardware, a corrupted entry -
 * and the correct outcome is that the user signs in again, not that the app crashes on
 * launch with a native exception.
 */

import * as SecureStore from 'expo-secure-store';
// From the package root, not a `dist/` path: deep imports into a package's build output break
// on any minor release that reorganises it.
import type { TokenCache } from '@clerk/clerk-expo';

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // A failed read must not be fatal. Treat it as absent and let the session be re-established.
    return null;
  }
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Nothing useful to do: the session still works for this launch, it just will not
    // survive a restart. Failing the sign-in over it would be worse.
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignored deliberately. Clerk also clears its in-memory session on sign-out, so a failed
    // delete cannot leave an authenticated session live.
  }
}

/**
 * Clerk's token cache, backed by the Keychain/Keystore.
 *
 * Passed to `<ClerkProvider tokenCache={tokenCache}>`. Without it Clerk falls back to its
 * default storage, which is exactly the AsyncStorage case the invariant forbids.
 */
export const tokenCache: TokenCache = {
  getToken: getSecureItem,
  saveToken: setSecureItem,
  clearToken: (key: string) => {
    void deleteSecureItem(key);
  },
};
