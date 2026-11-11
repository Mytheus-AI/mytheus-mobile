import { resetMocks } from './helpers/mocks';
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AudioStudioModule } from '@siteed/audio-studio';
import { ApiError } from '@/api/client';
import { fakeApi, renderWithApi } from './helpers/render';
import RecordInPerson from '../app/(app)/capture/index';

beforeEach(() => resetMocks());

const permission = AudioStudioModule.requestPermissionsAsync as jest.Mock;

describe('Record in person', () => {
  it('says so when the server cannot take phone recordings', async () => {
    const api = fakeApi({ 'GET /api/v1/capture/status': { configured: false } });
    renderWithApi(<RecordInPerson />, api.client);
    expect(await screen.findByText('Recording in person is not connected')).toBeTruthy();
  });

  it('asks for consent before anything is recorded', async () => {
    const start = jest.fn();
    const api = fakeApi({
      'GET /api/v1/capture/status': { configured: true },
      'POST /api/v1/capture/sessions': start,
    });
    renderWithApi(<RecordInPerson />, api.client);
    const go = await screen.findByLabelText('Start recording');
    expect(go.props.accessibilityState).toMatchObject({ disabled: true });
    expect(start).not.toHaveBeenCalled();
    const box = screen.getByRole('checkbox');
    fireEvent.press(box);
    expect(screen.getByRole('checkbox').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByLabelText('Start recording').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('explains a refused microphone and creates nothing', async () => {
    permission.mockResolvedValueOnce({ granted: false });
    const start = jest.fn();
    const api = fakeApi({
      'GET /api/v1/capture/status': { configured: true },
      'POST /api/v1/capture/sessions': start,
    });
    renderWithApi(<RecordInPerson />, api.client);
    fireEvent.press(await screen.findByRole('checkbox'));
    fireEvent.press(screen.getByLabelText('Start recording'));
    expect(await screen.findByText('Mytheus cannot use the microphone')).toBeTruthy();
    expect(start).not.toHaveBeenCalled();
  });

  it('a 503 from the server is the not-connected state', async () => {
    const api = fakeApi({
      'GET /api/v1/capture/status': { configured: true },
      'POST /api/v1/capture/sessions': new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'not connected'),
    });
    renderWithApi(<RecordInPerson />, api.client);
    fireEvent.press(await screen.findByRole('checkbox'));
    fireEvent.press(screen.getByLabelText('Start recording'));
    await waitFor(() => expect(screen.getByText('Recording in person is not connected')).toBeTruthy());
  });
});
