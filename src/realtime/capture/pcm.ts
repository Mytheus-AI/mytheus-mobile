/**
 * Microphone audio as transcription-service's `/capture/audio` wants it: 16 kHz mono signed
 * 16-bit little-endian PCM (`pcm_s16le`), in binary frames. The native recorder hands chunks over
 * as base64 strings of exactly that encoding; this turns them into whole-sample frames of a fixed
 * duration. Pure (no React Native), so it is unit-tested.
 */

export const SAMPLE_RATE = 16000;
export const BYTES_PER_SAMPLE = 2;
/** 100 ms per frame: 1600 samples, 3200 bytes. */
export const FRAME_BYTES = (SAMPLE_RATE / 10) * BYTES_PER_SAMPLE;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) t[ALPHABET.charCodeAt(i)] = i;
  // base64url too, in case a recorder ever sends it
  t['-'.charCodeAt(0)] = 62;
  t['_'.charCodeAt(0)] = 63;
  return t;
})();

/** Decode base64 (padding and whitespace tolerated). Throws on a character outside the alphabet. */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[\s=]+/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = LOOKUP[clean.charCodeAt(i)];
    if (v === undefined || v < 0) throw new Error('not base64');
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

/** Float samples in [-1, 1] (the web recorder's shape) to s16le bytes. */
export function floatToPcm16(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(samples.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

/**
 * Collects arbitrary-sized chunks and yields frames of exactly `frameBytes` (an even number, so a
 * sample is never split across two frames). `flush()` returns the remainder, trimmed to whole
 * samples, when the recording stops.
 */
export class PcmFramer {
  private pending: Uint8Array = new Uint8Array(0);

  constructor(private readonly frameBytes: number = FRAME_BYTES) {
    if (frameBytes <= 0 || frameBytes % BYTES_PER_SAMPLE !== 0) throw new Error('frame size must be whole samples');
  }

  push(chunk: Uint8Array): Uint8Array[] {
    const joined = new Uint8Array(this.pending.length + chunk.length);
    joined.set(this.pending, 0);
    joined.set(chunk, this.pending.length);
    const frames: Uint8Array[] = [];
    let at = 0;
    while (joined.length - at >= this.frameBytes) {
      frames.push(joined.slice(at, at + this.frameBytes));
      at += this.frameBytes;
    }
    this.pending = joined.slice(at);
    return frames;
  }

  flush(): Uint8Array | null {
    const whole = this.pending.length - (this.pending.length % BYTES_PER_SAMPLE);
    const rest = whole > 0 ? this.pending.slice(0, whole) : null;
    this.pending = new Uint8Array(0);
    return rest;
  }
}

/** A 0..1 loudness of a s16le chunk (RMS, scaled so speech sits around the middle). */
export function level(bytes: Uint8Array): number {
  const n = Math.floor(bytes.length / 2);
  if (n === 0) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const s = view.getInt16(i * 2, true) / 0x8000;
    sum += s * s;
  }
  const rms = Math.sqrt(sum / n);
  return Math.min(1, rms * 4);
}
