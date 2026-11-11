/* Jest setup: native modules the unit tests never reach are replaced with inert stand-ins. */

jest.mock('@livekit/react-native', () => ({
  registerGlobals: jest.fn(),
  AudioSession: { startAudioSession: jest.fn(async () => undefined), stopAudioSession: jest.fn(async () => undefined) },
  VideoView: () => null,
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

// The in-person recorder's native PCM stream (`@siteed/audio-studio`) never runs under Jest; the
// screens' tests drive `useMic` through this stand-in.
jest.mock('@siteed/audio-studio', () => ({
  AudioStudioModule: { requestPermissionsAsync: jest.fn(async () => ({ granted: true })) },
  useAudioRecorder: () => ({
    startRecording: jest.fn(async () => ({})),
    stopRecording: jest.fn(async () => ({})),
    isRecording: false,
    isPaused: false,
  }),
}));
