/**
 * The voice engine: how a Myte speaks on the phone (ADR-0050 D4). Every utterance is the server's
 * self-hosted Kokoro voice; there is no device voice and no fallback to one.
 *
 * - It plays a queue of items (a sentence or a few, from `speechChunks`), each fetched from
 *   `POST /api/v1/voice/speech` as MP3, written to the cache directory and played by one expo-audio
 *   player (replaced item by item, so it can stay the lock-screen player).
 * - While one item plays the next is already being fetched, so there is no gap between sentences.
 * - A fetched item is kept for the life of the engine (keyed by its text, voice, speed and
 *   language), so replaying or skipping back costs no request against the 30-a-minute limit.
 * - Pause, resume, stop, seek to an item, and the playback rate (pitch-corrected) are immediate.
 * - A 429 is retried once after a short wait; any other failure (503 `voice_not_connected`, no
 *   network) stops the queue and reports `onError`, and the caller keeps showing the text.
 *
 * Every native piece is injected (`VoiceDeps`), so the queue is tested without a device.
 */

export interface SpeechItem {
  text: string;
  /** Which part of the caller's content this item belongs to (a briefing point, say). */
  tag?: number;
}

export interface SpeakOptions {
  /** Omitted: the person's chosen voice, else their Myte's personality picks (server-side). */
  voice?: string | null;
  /** The voice's own pace, 0.7..1.4 (the Myte's personality). Playback speed is `setRate`. */
  speed?: number;
  language?: string;
}

export interface PlayerStatus {
  playing: boolean;
  currentTime: number;
  duration: number;
  didJustFinish: boolean;
}

/** The parts of an expo-audio `AudioPlayer` the engine uses. */
export interface PlayerLike {
  replace(source: { uri: string }): void;
  play(): void;
  pause(): void;
  remove(): void;
  addListener(event: 'playbackStatusUpdate', fn: (s: PlayerStatus) => void): { remove(): void } | void;
  setPlaybackRate?(rate: number, quality?: 'low' | 'medium' | 'high'): void;
  playbackRate?: number;
  shouldCorrectPitch?: boolean;
  setActiveForLockScreen?(active: boolean, metadata?: { title?: string; artist?: string; albumTitle?: string }): void;
}

export interface VoiceDeps {
  fetchSpeech(body: { text: string; voice?: string | null; speed?: number; language?: string }): Promise<ArrayBuffer>;
  /** Writes the bytes to a cache file and returns its uri. */
  writeFile(name: string, bytes: Uint8Array): string;
  deleteFile(uri: string): void;
  createPlayer(uri: string): PlayerLike;
  wait?(ms: number): Promise<void>;
}

export interface VoiceCallbacks {
  /** Item `index` started (its `tag` comes with it). */
  onItem?(index: number, tag: number | undefined): void;
  /** How far through item `index` the voice is, 0..1. */
  onProgress?(index: number, fraction: number): void;
  onPlaying?(playing: boolean): void;
  /** Waiting for the voice (the first item, or a slow network). */
  onLoading?(loading: boolean): void;
  onDone?(): void;
  onError?(error: unknown): void;
}

export interface LockScreen {
  title: string;
  artist: string;
}

export const VOICE_UNAVAILABLE = 'Voice is unavailable right now';

function statusOf(e: unknown): number | null {
  return e && typeof e === 'object' && 'status' in e && typeof (e as { status: unknown }).status === 'number'
    ? (e as { status: number }).status
    : null;
}

function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export class VoiceEngine {
  private items: SpeechItem[] = [];
  private opts: SpeakOptions = {};
  private cb: VoiceCallbacks = {};
  private at = 0;
  private gen = 0;
  private paused = false;
  /** The item currently loaded into the player (index and generation), if any. */
  private loaded: { gen: number; index: number } | null = null;
  private player: PlayerLike | null = null;
  private rate = 1;
  private lock: LockScreen | null = null;
  private readonly cache = new Map<string, Promise<string>>();
  private readonly files = new Set<string>();
  private seq = 0;

  constructor(private readonly deps: VoiceDeps) {}

  /** Starts speaking `items` from `from`, replacing whatever was being said. */
  speak(items: SpeechItem[], opts: SpeakOptions = {}, cb: VoiceCallbacks = {}, from = 0): void {
    this.items = items;
    this.opts = opts;
    this.cb = cb;
    this.paused = false;
    this.player?.pause();
    void this.run(++this.gen, Math.max(0, Math.min(from, items.length)));
  }

  /** Jumps to item `index` of the current queue (keeps playing if it was playing). */
  seek(index: number): void {
    if (index < 0 || index >= this.items.length) return;
    this.player?.pause();
    const resume = !this.paused;
    this.at = index;
    this.loaded = null;
    if (resume) void this.run(++this.gen, index);
    else {
      this.gen += 1;
      this.cb.onItem?.(index, this.items[index]?.tag);
    }
  }

  pause(): void {
    this.paused = true;
    this.player?.pause();
    this.cb.onPlaying?.(false);
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.loaded && this.loaded.gen === this.gen && this.loaded.index === this.at && this.player) {
      this.player.play();
      return;
    }
    if (this.at < this.items.length) void this.run(++this.gen, this.at);
  }

  /** Stops and forgets the queue (the fetched audio stays cached until `dispose`). */
  stop(): void {
    this.gen += 1;
    this.paused = false;
    this.loaded = null;
    this.items = [];
    this.player?.pause();
    this.cb.onPlaying?.(false);
    this.cb.onLoading?.(false);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get index(): number {
    return this.at;
  }

  setRate(rate: number): void {
    this.rate = rate;
    if (this.player) applyRate(this.player, rate);
  }

  /** Show the voice on the lock screen (a briefing is listened to like a podcast). */
  setLockScreen(lock: LockScreen | null): void {
    this.lock = lock;
    if (this.player && lock) activateLock(this.player, lock);
  }

  dispose(): void {
    this.stop();
    try {
      this.player?.remove();
    } catch {
      // Already released by the native side.
    }
    this.player = null;
    for (const uri of this.files) {
      try {
        this.deps.deleteFile(uri);
      } catch {
        // The OS may have cleared its cache already.
      }
    }
    this.files.clear();
    this.cache.clear();
  }

  private key(text: string): string {
    return `${this.opts.voice ?? ''}|${this.opts.speed ?? 1}|${this.opts.language ?? ''}|${text}`;
  }

  /** The cached file for item `index`, fetching it once. A failed fetch is forgotten so a later
      Play can try again. */
  private load(index: number): Promise<string> {
    const item = this.items[index];
    if (!item) return Promise.reject(new Error('no such item'));
    const key = this.key(item.text);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const body = { text: item.text, voice: this.opts.voice ?? undefined, speed: this.opts.speed, language: this.opts.language };
    const p = this.fetchWithRetry(body).then((buf) => {
      const uri = this.deps.writeFile(`${hash(key)}-${(this.seq += 1)}.mp3`, new Uint8Array(buf));
      this.files.add(uri);
      return uri;
    });
    this.cache.set(key, p);
    p.catch(() => {
      if (this.cache.get(key) === p) this.cache.delete(key);
    });
    return p;
  }

  private async fetchWithRetry(body: Parameters<VoiceDeps['fetchSpeech']>[0]): Promise<ArrayBuffer> {
    try {
      return await this.deps.fetchSpeech(body);
    } catch (e) {
      if (statusOf(e) !== 429) throw e;
      await (this.deps.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))))(2500);
      return this.deps.fetchSpeech(body);
    }
  }

  private ensurePlayer(uri: string): PlayerLike {
    if (this.player) {
      this.player.replace({ uri });
      return this.player;
    }
    const p = this.deps.createPlayer(uri);
    applyRate(p, this.rate);
    p.addListener('playbackStatusUpdate', (s) => this.onStatus(s));
    if (this.lock) activateLock(p, this.lock);
    this.player = p;
    return p;
  }

  private onStatus(s: PlayerStatus): void {
    const cur = this.loaded;
    if (!cur || cur.gen !== this.gen) return;
    if (s.didJustFinish) {
      this.cb.onProgress?.(cur.index, 1);
      this.loaded = null;
      void this.run(this.gen, cur.index + 1);
      return;
    }
    if (!this.paused) this.cb.onPlaying?.(s.playing);
    if (s.duration > 0) this.cb.onProgress?.(cur.index, Math.min(1, s.currentTime / s.duration));
  }

  private async run(gen: number, index: number): Promise<void> {
    this.at = index;
    if (index >= this.items.length) {
      this.loaded = null;
      this.cb.onPlaying?.(false);
      this.cb.onLoading?.(false);
      this.cb.onDone?.();
      return;
    }
    this.cb.onItem?.(index, this.items[index]?.tag);
    this.cb.onLoading?.(true);
    let uri: string;
    try {
      uri = await this.load(index);
    } catch (e) {
      if (gen !== this.gen) return;
      this.gen += 1;
      this.loaded = null;
      this.cb.onLoading?.(false);
      this.cb.onPlaying?.(false);
      this.cb.onError?.(e);
      return;
    }
    if (gen !== this.gen) return;
    this.cb.onLoading?.(false);
    // The next one is fetched while this one plays. Its failure surfaces when it is reached.
    if (index + 1 < this.items.length) this.load(index + 1).catch(() => undefined);
    if (this.paused) return;
    const p = this.ensurePlayer(uri);
    this.loaded = { gen, index };
    p.play();
    this.cb.onPlaying?.(true);
  }
}

function applyRate(p: PlayerLike, rate: number): void {
  try {
    p.shouldCorrectPitch = true;
    if (p.setPlaybackRate) p.setPlaybackRate(rate, 'high');
    else p.playbackRate = rate;
  } catch {
    // An older native build plays at 1x.
  }
}

function activateLock(p: PlayerLike, lock: LockScreen): void {
  try {
    p.setActiveForLockScreen?.(true, { title: lock.title, artist: lock.artist, albumTitle: 'Mytheus' });
  } catch {
    // An older native build without lock-screen support still plays.
  }
}
