import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { segmentAt, segmentStarts, voiceTone, type BriefingSegment } from '@/lib/briefing';
import { useVoiceEngine } from '@/voice/useVoice';
import { speechChunks } from '@/voice/text';
import type { SpeechItem } from '@/voice/engine';

/* Playback of one briefing on the phone, two engines behind one set of controls:

   - `audio`: the briefing has a server audio file. An expo-audio player on its short-lived URL.
   - `voice`: no file. Your Myte's Kokoro voice (ADR-0050), point by point and sentence by
     sentence through the voice engine: the first sentence starts as soon as it is ready and the
     next is fetched while one plays. The voice is your chosen one, else your Myte's personality
     picks it (server-side); the personality sets its pace, your speed the playback rate.

   Either way the player is the lock-screen player (title, your Myte's name), and the audio session
   plays in silent mode and in the background only while a briefing plays; it is released when the
   briefing ends or the screen closes. When the voice is unavailable the text stays and `error`
   says so; there is no device voice to fall back to. */

export type Engine = 'voice' | 'audio';

/** The background audio session is held only while a briefing plays (system.md N24). */
function background(on: boolean): void {
  void setAudioModeAsync({ playsInSilentMode: on, shouldPlayInBackground: on }).catch(() => undefined);
}

export interface PlayerOptions {
  briefingId: string;
  segments: readonly Pick<BriefingSegment, 'text'>[];
  language: string;
  personality: string;
  title: string;
  agentName: string;
  rate: number;
  hasAudio: boolean;
  audioUrl: (id: string) => Promise<string | null>;
  onFirstPlay?: () => void;
}

interface Plan {
  items: SpeechItem[];
  /** Where each item starts and ends inside its point, as fractions of the point's text. */
  span: [number, number][];
  /** The first item of each point. */
  firstOf: number[];
}

function plan(segments: readonly Pick<BriefingSegment, 'text'>[]): Plan {
  const items: SpeechItem[] = [];
  const span: [number, number][] = [];
  const firstOf: number[] = [];
  segments.forEach((seg, i) => {
    firstOf.push(items.length);
    const chunks = speechChunks(seg.text);
    const total = chunks.reduce((a, c) => a + c.length, 0) || 1;
    let at = 0;
    for (const c of chunks) {
      items.push({ text: c, tag: i });
      span.push([at / total, (at + c.length) / total]);
      at += c.length;
    }
  });
  return { items, span, firstOf };
}

export function useBriefingPlayer(o: PlayerOptions) {
  const starts = useMemo(() => segmentStarts(o.segments), [o.segments]);
  const speech = useMemo(() => plan(o.segments), [o.segments]);
  const voice = useVoiceEngine();
  const [engine, setEngine] = useState<Engine>(o.hasAudio ? 'audio' : 'voice');
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = useRef<AudioPlayer | null>(null);
  const started = useRef(false);
  const indexRef = useRef(0);
  const playingRef = useRef(false);
  const optsRef = useRef(o);
  optsRef.current = o;
  indexRef.current = index;
  playingRef.current = playing;

  useEffect(() => {
    voice.setLockScreen({ title: o.title, artist: o.agentName });
  }, [voice, o.title, o.agentName]);

  useEffect(
    () => () => {
      player.current?.remove();
      player.current = null;
      background(false);
    },
    [],
  );

  const first = useCallback(() => {
    background(true);
    if (!started.current) {
      started.current = true;
      optsRef.current.onFirstPlay?.();
    }
  }, []);

  /** Speak from point `i` in your Myte's voice. */
  const speak = useCallback(
    (i: number) => {
      const from = speech.firstOf[i];
      if (from === undefined) return;
      setIndex(i);
      setFinished(false);
      setError(null);
      setProgress(starts[i] ?? 0);
      voice.setRate(optsRef.current.rate);
      voice.speak(
        speech.items,
        { speed: Math.min(1.4, Math.max(0.7, voiceTone(optsRef.current.personality).rate)), language: optsRef.current.language },
        {
          onItem: (_, tag) => {
            if (tag !== undefined) setIndex(tag);
          },
          onProgress: (item, f) => {
            const seg = speech.items[item]?.tag ?? 0;
            const [a, b] = speech.span[item] ?? [0, 1];
            const s0 = starts[seg] ?? 0;
            const s1 = starts[seg + 1] ?? 1;
            setProgress(s0 + (s1 - s0) * (a + (b - a) * f));
          },
          onPlaying: setPlaying,
          onLoading: setLoading,
          onDone: () => {
            setPlaying(false);
            setProgress(1);
            setFinished(true);
            background(false);
          },
          onError: () => {
            setPlaying(false);
            setError('Voice is unavailable right now');
            background(false);
          },
        },
        from,
      );
    },
    [speech, starts, voice],
  );

  const ensurePlayer = useCallback(async (): Promise<AudioPlayer | null> => {
    if (player.current) return player.current;
    setLoading(true);
    const url = await optsRef.current.audioUrl(optsRef.current.briefingId);
    setLoading(false);
    if (!url) {
      setEngine('voice');
      return null;
    }
    const p = createAudioPlayer({ uri: url }, { updateInterval: 250 });
    p.playbackRate = optsRef.current.rate;
    p.addListener('playbackStatusUpdate', (s) => {
      setPlaying(s.playing);
      const f = s.duration > 0 ? s.currentTime / s.duration : 0;
      setProgress(f);
      setIndex(segmentAt(starts, f));
      if (s.didJustFinish) {
        background(false);
        setFinished(true);
        setPlaying(false);
        setProgress(1);
      }
    });
    try {
      p.setActiveForLockScreen(true, { title: optsRef.current.title, artist: optsRef.current.agentName, albumTitle: 'Mytheus' });
    } catch {
      // An older native build without lock-screen support still plays.
    }
    player.current = p;
    return p;
  }, [starts]);

  const play = useCallback(
    async (from?: number) => {
      first();
      const at = from ?? (finished ? 0 : indexRef.current);
      if (engine === 'audio') {
        const p = await ensurePlayer();
        if (p) {
          if (from !== undefined || finished) await p.seekTo((starts[at] ?? 0) * (p.duration || 0));
          setFinished(false);
          p.play();
          return;
        }
      }
      // Paused mid-point with nothing changed: carry on from the same sentence.
      if (from === undefined && !finished && !error && voice.isPaused && (speech.items[voice.index]?.tag ?? -1) === at) {
        voice.resume();
        return;
      }
      speak(at);
    },
    [engine, ensurePlayer, error, finished, first, speak, speech, starts, voice],
  );

  const pause = useCallback(() => {
    if (engine === 'audio' && player.current) {
      player.current.pause();
      return;
    }
    voice.pause();
    setPlaying(false);
  }, [engine, voice]);

  const toggle = useCallback(() => (playingRef.current ? pause() : void play()), [pause, play]);

  const seek = useCallback(
    (i: number) => {
      const n = optsRef.current.segments.length;
      const to = Math.min(Math.max(i, 0), Math.max(0, n - 1));
      setIndex(to);
      setProgress(starts[to] ?? 0);
      setFinished(false);
      if (engine === 'audio' && player.current) {
        void player.current.seekTo((starts[to] ?? 0) * (player.current.duration || 0));
        return;
      }
      if (playingRef.current) speak(to);
      else voice.stop();
    },
    [engine, speak, starts, voice],
  );

  useEffect(() => {
    if (player.current) player.current.playbackRate = o.rate;
    voice.setRate(o.rate);
  }, [o.rate, voice]);

  return {
    engine,
    playing,
    index,
    progress,
    finished,
    loading,
    error,
    play,
    pause,
    toggle,
    seek,
    next: () => seek(indexRef.current + 1),
    prev: () => seek(indexRef.current - 1),
  };
}
