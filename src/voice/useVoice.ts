import { useEffect, useMemo } from 'react';
import { createAudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { useApi } from '@/api/ApiProvider';
import type { ApiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { VoiceEngine, type PlayerLike, type VoiceDeps } from './engine';

/* The voice engine wired to the phone: speech from core-api through the one REST client (so the
   Clerk token and its refresh are the same as every other call), MP3s in the cache directory,
   expo-audio to play them. One engine per screen that speaks; released when it closes.

   The MP3s are spoken words (a briefing, your decisions and tasks), so they do not outlive the
   app: each engine deletes its own when it closes, and the first use in a process empties the
   directory of anything a killed process left behind (system.md N28). No engine has written yet
   at that point, so nothing in use is removed. */

let swept = false;

function voiceDir(): Directory {
  const dir = new Directory(Paths.cache, 'voice');
  if (!swept) {
    swept = true;
    try {
      if (dir.exists) dir.delete();
    } catch {
      // The OS may be clearing its cache at the same time; what is left is retried next launch.
    }
  }
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function nativeVoiceDeps(api: ApiClient): VoiceDeps {
  return {
    fetchSpeech: (body) => endpoints.speech(api, body),
    writeFile: (name, bytes) => {
      const file = new File(voiceDir(), name);
      file.write(bytes);
      return file.uri;
    },
    deleteFile: (uri) => {
      const file = new File(uri);
      if (file.exists) file.delete();
    },
    createPlayer: (uri) => createAudioPlayer({ uri }, { updateInterval: 250 }) as unknown as PlayerLike,
  };
}

export function useVoiceEngine(): VoiceEngine {
  const api = useApi();
  const engine = useMemo(() => new VoiceEngine(nativeVoiceDeps(api)), [api]);
  useEffect(() => () => engine.dispose(), [engine]);
  return engine;
}
