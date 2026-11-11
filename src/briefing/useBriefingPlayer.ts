import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { pickVoice, segmentAt, segmentStarts, voiceTone, type BriefingSegment, type VoiceLike } from '@/lib/briefing';

/* Playback of one briefing on the phone, two engines behind one set of controls:

   - `device`: expo-speech, one utterance per segment (a pause never loses more than a sentence),
     word boundaries driving the highlight. The voice is the person's remembered one when the
     phone has it, else one matched to their agent (`pickVoice`), at the persona's pace and pitch.
   - `audio`: the server voice (TTS connected), an expo-audio player on a short-lived URL, set as
     the lock-screen player (title, the agent's name, play, pause, skip) so it keeps playing and
     stays controllable with the screen locked.

   While a briefing plays, the audio session plays in silent mode and in the background, which
   also keeps the device voice going when the phone locks (iOS: UIBackgroundModes audio, already in
   app.json); it is released when the briefing ends or the screen closes. */

export type Engine = 'device' | 'audio';

/** The background audio session is held only while a briefing plays (system.md N-briefing):
    a briefing is listened to like a podcast, so it keeps playing when the phone locks, and the
    session is released as soon as it ends or the screen closes. */
function background(on: boolean): void {
  void setAudioModeAsync({ playsInSilentMode: on, shouldPlayInBackground: on }).catch(() => undefined);
}

export interface PlayerOptions {
  briefingId: string;
  segments: readonly Pick<BriefingSegment, 'text'>[];
  language: string;
  personality: string;
  seed: string;
  title: string;
  agentName: string;
  preferredVoice: string | null;
  rate: number;
  hasAudio: boolean;
  audioUrl: (id: string) => Promise<string | null>;
  onFirstPlay?: () => void;
}

export function useBriefingPlayer(o: PlayerOptions) {
  const starts = useMemo(() => segmentStarts(o.segments), [o.segments]);
  const [voices, setVoices] = useState<VoiceLike[]>([]);
  const [engine, setEngine] = useState<Engine>(o.hasAudio ? 'audio' : 'device');
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [word, setWord] = useState<[number, number] | null>(null);
  const [progress, setProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const gen = useRef(0);
  const player = useRef<AudioPlayer | null>(null);
  const started = useRef(false);
  const indexRef = useRef(0);
  const playingRef = useRef(false);
  const optsRef = useRef(o);
  optsRef.current = o;
  indexRef.current = index;
  playingRef.current = playing;

  useEffect(() => {
    let live = true;
    void Speech.getAvailableVoicesAsync()
      .then((v) => {
        if (live) setVoices(v.map((x) => ({ identifier: x.identifier, name: x.name, language: x.language, quality: String(x.quality) })));
      })
      .catch(() => undefined);
    return () => {
      live = false;
      gen.current += 1;
      void Speech.stop();
      player.current?.remove();
      player.current = null;
      background(false);
    };
  }, []);

  const voice = useMemo(() => pickVoice(voices, { language: o.language, seed: o.seed, preferred: o.preferredVoice }), [voices, o.language, o.seed, o.preferredVoice]);
  const tone = voiceTone(o.personality);

  const first = useCallback(() => {
    background(true);
    if (!started.current) {
      started.current = true;
      optsRef.current.onFirstPlay?.();
    }
  }, []);

  const speak = useCallback(
    (i: number) => {
      const seg = optsRef.current.segments[i];
      if (!seg) return;
      gen.current += 1;
      const mine = gen.current;
      void Speech.stop();
      setIndex(i);
      setWord(null);
      setFinished(false);
      setProgress(starts[i] ?? 0);
      Speech.speak(seg.text, {
        language: voice?.language ?? optsRef.current.language,
        voice: voice?.identifier,
        rate: Math.min(2, Math.max(0.3, optsRef.current.rate * tone.rate)),
        pitch: tone.pitch,
        onStart: () => {
          if (mine === gen.current) setPlaying(true);
        },
        onBoundary: (e: unknown) => {
          if (mine !== gen.current) return;
          const ev = e as { charIndex?: number; charLength?: number };
          if (typeof ev.charIndex !== 'number') return;
          const end = ev.charIndex + (ev.charLength ?? 1);
          setWord([ev.charIndex, end]);
          const a = starts[i] ?? 0;
          const b = starts[i + 1] ?? 1;
          setProgress(a + (b - a) * (end / Math.max(1, seg.text.length)));
        },
        onDone: () => {
          if (mine !== gen.current) return;
          const next = i + 1;
          if (next < optsRef.current.segments.length) speak(next);
          else {
            setPlaying(false);
            setWord(null);
            setProgress(1);
            setFinished(true);
            background(false);
          }
        },
        onStopped: () => {
          if (mine === gen.current) setPlaying(false);
        },
        onError: () => {
          if (mine === gen.current) setPlaying(false);
        },
      });
    },
    [voice, tone.rate, tone.pitch, starts],
  );

  const ensurePlayer = useCallback(async (): Promise<AudioPlayer | null> => {
    if (player.current) return player.current;
    setLoading(true);
    const url = await optsRef.current.audioUrl(optsRef.current.briefingId);
    setLoading(false);
    if (!url) {
      setEngine('device');
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
      speak(at);
    },
    [engine, ensurePlayer, finished, first, speak, starts],
  );

  const pause = useCallback(() => {
    if (engine === 'audio' && player.current) {
      player.current.pause();
      return;
    }
    gen.current += 1;
    void Speech.stop();
    setPlaying(false);
  }, [engine]);

  const toggle = useCallback(() => (playingRef.current ? pause() : void play()), [pause, play]);

  const seek = useCallback(
    (i: number) => {
      const n = optsRef.current.segments.length;
      const to = Math.min(Math.max(i, 0), Math.max(0, n - 1));
      setIndex(to);
      setWord(null);
      setProgress(starts[to] ?? 0);
      setFinished(false);
      if (engine === 'audio' && player.current) {
        void player.current.seekTo((starts[to] ?? 0) * (player.current.duration || 0));
        return;
      }
      if (playingRef.current) speak(to);
    },
    [engine, speak, starts],
  );

  useEffect(() => {
    if (player.current) player.current.playbackRate = o.rate;
  }, [o.rate]);

  return {
    engine,
    playing,
    index,
    word,
    progress,
    finished,
    loading,
    voice,
    voices,
    play,
    pause,
    toggle,
    seek,
    next: () => seek(indexRef.current + 1),
    prev: () => seek(indexRef.current - 1),
  };
}
