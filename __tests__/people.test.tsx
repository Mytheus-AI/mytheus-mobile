import { mockParams, mockRouter, resetMocks } from './helpers/mocks';
import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { fakeApi, renderWithApi } from './helpers/render';
import People from '../app/(app)/people/index';
import PersonScreen from '../app/(app)/people/[personId]';
import { ApiError } from '@/api/client';

const ME = '11111111-1111-4111-8111-111111111111';
const RAJ = '22222222-2222-4222-8222-222222222222';
const M1 = '0b6a3c43-2f5d-4f4b-9a8e-0a1b2c3d4e5f';
const M2 = '5d2e8f10-7a1b-4c3d-9e8f-0a1b2c3d4e5f';

const member = (id: string, email: string, over: Record<string, unknown> = {}) => ({
  id,
  email,
  clerk_user_id: null,
  avatar_url: null,
  role: null,
  tier: 'member',
  ...over,
});

const MEMBERS = {
  items: [
    member(RAJ, 'raj@acme.test', { role: 'Engineer' }),
    member(ME, 'maya@acme.test', { role: 'Product manager' }),
    member('33333333-3333-4333-8333-333333333333', 'zoe@acme.test', { display_name: 'Zoe Park' }),
  ],
};

const PROFILE = {
  user_id: RAJ,
  org_id: '99999999-9999-4999-8999-999999999999',
  email: 'raj@acme.test',
  avatar_url: null,
  role: 'Engineer',
  bio: 'Builds the billing pipeline.',
  department: { id: 'd1', name: 'Engineering' },
  team: [{ id: 't1', name: 'Payments', department_id: 'd1' }],
  skills: ['Postgres', 'Go'],
  topics: ['pricing'],
  recent_meetings: [
    { id: M1, title: 'Older review', scheduled_start: '2026-10-01T10:00:00Z', scheduled_end: null, status: 'ended' },
    { id: M2, title: 'Pricing sync', scheduled_start: '2026-11-10T10:00:00Z', scheduled_end: null, status: 'ended' },
  ],
};

const base = { 'GET /users/me': { id: ME, email: 'maya@acme.test' }, 'GET /users': MEMBERS };

beforeEach(() => resetMocks());

/** Let the name lookups (`/users`, `/users/me`) land before the test ends. */
const settle = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

describe('People', () => {
  it('lists the workspace, you first, and opens a profile', async () => {
    const api = fakeApi(base);
    renderWithApi(<People />, api.client);
    expect(await screen.findByText('Maya (you)')).toBeTruthy();
    expect(screen.getByText('3 people in Acme')).toBeTruthy();
    // identity's display name is the name; the email reads as a name when there is none.
    expect(screen.getByText('Zoe Park')).toBeTruthy();
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string | undefined).filter((l) => l && !l.startsWith('Back'));
    expect(labels).toEqual(['Maya (you), Product manager', 'Raj, Engineer', 'Zoe Park']);

    fireEvent.press(screen.getByLabelText('Raj, Engineer'));
    expect(mockRouter.push).toHaveBeenCalledWith(`/people/${RAJ}`);
    // No org_id, no tenant filter: the member list is read as the gateway scoped it.
    expect(api.calls.every((c) => !JSON.stringify(c.opts).includes('org'))).toBe(true);
  });

  it('says so when the member list fails', async () => {
    const api = fakeApi({ ...base, 'GET /users': new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'down') });
    renderWithApi(<People />, api.client);
    expect(await screen.findByText('People could not be loaded')).toBeTruthy();
  });
});

describe('Person', () => {
  it('shows the profile from /bff/people/{user_id}, newest meeting first', async () => {
    mockParams.current = { personId: RAJ };
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const api = fakeApi({ ...base, 'GET /bff/people/{user_id}': PROFILE });
    renderWithApi(<PersonScreen />, api.client);

    expect(await screen.findByText('Builds the billing pipeline.')).toBeTruthy();
    expect(api.calls.find((c) => c.key === 'GET /bff/people/{user_id}')?.opts.path).toEqual({ user_id: RAJ });
    expect(screen.getByText('Raj')).toBeTruthy();
    expect(screen.getByText('Engineer')).toBeTruthy();
    expect(screen.getByText('Engineering')).toBeTruthy();
    expect(screen.getByText('Payments')).toBeTruthy();
    expect(screen.getByText('Postgres')).toBeTruthy();
    expect(screen.getByText('pricing')).toBeTruthy();
    // The org_id in the response is never shown.
    expect(screen.queryByText(PROFILE.org_id)).toBeNull();

    const titles = screen.getAllByText(/Pricing sync|Older review/).map((n) => n.props.children);
    expect(titles).toEqual(['Pricing sync', 'Older review']);
    fireEvent.press(screen.getByText('Pricing sync'));
    expect(mockRouter.push).toHaveBeenCalledWith(`/meetings/${M2}`);

    fireEvent.press(screen.getByLabelText('Email Raj'));
    expect(open).toHaveBeenCalledWith('mailto:raj@acme.test');
    open.mockRestore();
  });

  it('treats a 404 as not available (another workspace looks the same)', async () => {
    mockParams.current = { personId: RAJ };
    const api = fakeApi({ ...base, 'GET /bff/people/{user_id}': new ApiError(404, 'NOT_FOUND', 'nope') });
    renderWithApi(<PersonScreen />, api.client);
    expect(await screen.findByText('This person is not available')).toBeTruthy();
    await settle();
  });

  it('never sends an id that is not a person', async () => {
    mockParams.current = { personId: 'not-a-uuid' };
    const api = fakeApi(base);
    renderWithApi(<PersonScreen />, api.client);
    expect(await screen.findByText('This person is not available')).toBeTruthy();
    expect(api.calls.some((c) => c.key.startsWith('GET /bff/people'))).toBe(false);
    await settle();
  });

  it('offers a retry when the server fails', async () => {
    mockParams.current = { personId: RAJ };
    let fail = true;
    const api = fakeApi({
      ...base,
      'GET /bff/people/{user_id}': () => (fail ? new ApiError(500, 'INTERNAL', 'boom') : PROFILE),
    });
    renderWithApi(<PersonScreen />, api.client);
    expect(await screen.findByText('This profile could not be loaded')).toBeTruthy();
    fail = false;
    fireEvent.press(screen.getByLabelText('Try again'));
    await waitFor(() => expect(screen.getByText('Builds the billing pipeline.')).toBeTruthy());
  });
});
