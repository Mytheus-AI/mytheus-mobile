/**
 * The phone's microphone as raw PCM, through `@siteed/audio-studio` (system.md N23).
 *
 * Expo's own audio modules record to a file; streaming the samples as they are captured needs a
 * native module. `@siteed/audio-studio` (formerly expo-audio-stream; maintained, Expo config
 * plugin, iOS + Android) delivers 16 kHz mono 16-bit PCM chunks to JS every `interval` ms as
 * base64, which `pcm.ts` turns into `/capture/audio` frames. It needs a development build (it is
 * not in Expo Go), which this app already requires for LiveKit and WebRTC.
 *
 * Only this file imports the library, so screens and tests depend on `useMic` alone.
 */

import { useRef } from 'react';
import { AudioStudioModule, useAudioRecorder, type AudioDataEvent } from '@siteed/audio-studio';
import { base64ToBytes, floatToPcm16 } from './pcm';

export type MicPermission = 'granted' | 'denied';

export async function requestMicPermission(): Promise<MicPermission> {
  try {
    const res = (await AudioStudioModule.requestPermissionsAsync()) as { granted?: boolean } | undefined;
    return res?.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

function toBytes(e: AudioDataEvent): Uint8Array | null {
  const data = e.data;
  if (typeof data === 'string') return data ? base64ToBytes(data) : null;
  if (data instanceof Float32Array) return floatToPcm16(data);
  if (data instanceof Int16Array) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return null;
}

export interface Mic {
  start: (onChunk: (bytes: Uint8Array) => void) => Promise<void>;
  stop: () => Promise<void>;
}

export function useMic(): Mic {
  const recorder = useAudioRecorder();
  const latest = useRef(recorder);
  latest.current = recorder;
  return {
    start: async (onChunk) => {
      await recorder.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 100,
        keepAwake: true,
        keepFullAnalysis: false,
        // Android: a foreground-service notification keeps the recording alive with the screen off.
        showNotification: true,
        notification: { title: 'Mytheus is recording', text: 'Recording an in-person meeting' },
        output: { primary: { enabled: false } },
        onAudioStream: async (e: AudioDataEvent) => {
          const bytes = toBytes(e);
          if (bytes && bytes.length) onChunk(bytes);
        },
      });
    },
    stop: async () => {
      const r = latest.current;
      if (r.isRecording || r.isPaused) await r.stopRecording();
    },
  };
}
