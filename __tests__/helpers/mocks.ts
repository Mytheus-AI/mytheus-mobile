/* Shared module mocks for screen tests: the router and Clerk, which unit tests never reach.
   Import this before the screen under test. */

export const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
export const mockParams: { current: Record<string, string> } = { current: {} };
/** The screen's focus: `blur()` runs the cleanup of the focused screen's `useFocusEffect`, as
    switching tabs or pushing a screen does. A screen is focused while it is mounted. */
export const mockFocus: { blur: () => void } = { blur: () => undefined };
export const mockSignOut = jest.fn(async () => undefined);

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams.current,
    useFocusEffect: (effect: () => void | (() => void)) =>
      useEffect(() => {
        let cleanup: void | (() => void) = effect();
        mockFocus.blur = () => {
          const run = cleanup;
          cleanup = undefined;
          if (run) run();
        };
        return () => {
          if (cleanup) cleanup();
        };
      }, [effect]),
  };
});

jest.mock('@clerk/expo', () => ({
  useUser: () => ({ user: { id: 'clerk_me', firstName: 'Maya', fullName: 'Maya Rao', primaryEmailAddress: { emailAddress: 'maya@acme.test' } } }),
  useOrganization: () => ({ organization: { id: 'org_1', name: 'Acme' }, memberships: { data: [] } }),
  useOrganizationList: () => ({ isLoaded: true, userMemberships: { data: [] }, setActive: jest.fn() }),
  useAuth: () => ({ isLoaded: true, isSignedIn: true, orgId: 'org_1', userId: 'clerk_me', getToken: async () => 't', signOut: mockSignOut }),
}));

export function resetMocks() {
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
  mockParams.current = {};
  mockFocus.blur = () => undefined;
  mockSignOut.mockClear();
}
