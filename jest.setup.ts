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

// A briefing from your agent: the device voice and the server-voice player never run under Jest.
// `expo-speech` records what it was asked to say and finishes at once (onStart, a word boundary,
// onDone) so the player's flow is exercised.
jest.mock('expo-speech', () => {
  const spoken: string[] = [];
  return {
    __spoken: spoken,
    speak: jest.fn((text: string, opts: { onStart?: () => void; onBoundary?: (e: unknown) => void; onDone?: () => void } = {}) => {
      spoken.push(text);
      opts.onStart?.();
      opts.onBoundary?.({ charIndex: 0, charLength: Math.max(1, text.indexOf(' ')) });
    }),
    stop: jest.fn(async () => undefined),
    getAvailableVoicesAsync: jest.fn(async () => [
      { identifier: 'com.apple.voice.enhanced.en-US.Ava', name: 'Ava', language: 'en-US', quality: 'Enhanced' },
      { identifier: 'com.apple.voice.compact.en-US.Samantha', name: 'Samantha', language: 'en-US', quality: 'Default' },
    ]),
  };
});
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(async () => undefined),
    addListener: jest.fn(),
    setActiveForLockScreen: jest.fn(),
    duration: 30,
    playbackRate: 1,
  })),
}));
