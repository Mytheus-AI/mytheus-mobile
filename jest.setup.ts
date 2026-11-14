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

// Your Myte's voice (ADR-0050) never reaches a device under Jest: the cache directory is an
// in-memory stand-in, and every expo-audio player records its listeners so a test can drive its
// status (`__emit`). `play()` reports playing at once.
jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) => parts.map((x) => (typeof x === 'string' ? x : (x as { uri: string }).uri)).join('/');
  class Directory {
    uri: string;
    exists = true;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    create() {
      this.exists = true;
    }
  }
  class File {
    uri: string;
    exists = true;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    write = jest.fn();
    delete = jest.fn();
  }
  return { File, Directory, Paths: { cache: new Directory('file:///cache') } };
});
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  createAudioPlayer: jest.fn((source: { uri: string }) => {
    const listeners: ((s: unknown) => void)[] = [];
    const player = {
      source,
      play: jest.fn(() => listeners.forEach((l) => l({ playing: true, currentTime: 0, duration: 3, didJustFinish: false }))),
      pause: jest.fn(),
      remove: jest.fn(),
      replace: jest.fn((next: { uri: string }) => {
        player.source = next;
      }),
      seekTo: jest.fn(async () => undefined),
      addListener: jest.fn((_: string, fn: (s: unknown) => void) => {
        listeners.push(fn);
        return { remove: jest.fn() };
      }),
      setActiveForLockScreen: jest.fn(),
      setPlaybackRate: jest.fn(),
      __emit: (s: unknown) => listeners.forEach((l) => l(s)),
      duration: 30,
      playbackRate: 1,
      shouldCorrectPitch: false,
    };
    return player;
  }),
}));
