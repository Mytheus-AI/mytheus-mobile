/* Shared module mocks for screen tests: the router and Clerk, which unit tests never reach.
   Import this before the screen under test. */

export const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
export const mockParams: { current: Record<string, string> } = { current: {} };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams.current,
}));

jest.mock('@clerk/expo', () => ({
  useUser: () => ({ user: { id: 'clerk_me', firstName: 'Maya', fullName: 'Maya Rao', primaryEmailAddress: { emailAddress: 'maya@acme.test' } } }),
  useOrganization: () => ({ organization: { id: 'org_1', name: 'Acme' }, memberships: { data: [] } }),
  useOrganizationList: () => ({ isLoaded: true, userMemberships: { data: [] }, setActive: jest.fn() }),
  useAuth: () => ({ isLoaded: true, isSignedIn: true, orgId: 'org_1', userId: 'clerk_me', getToken: async () => 't', signOut: jest.fn() }),
}));

export function resetMocks() {
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
  mockParams.current = {};
}
