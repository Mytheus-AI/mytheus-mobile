import { useSyncExternalStore } from 'react';

/**
 * Mock session state. In production this is Clerk (`useAuth`); the app is
 * provisioned by the user's company, so there is no sign-up flow - signing
 * in simply establishes the session.
 */
let signedIn = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function signIn() {
  signedIn = true;
  emit();
}

export function signOut() {
  signedIn = false;
  emit();
}

export function useSignedIn(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => signedIn,
  );
}
