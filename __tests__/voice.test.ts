import { VoiceEngine, type PlayerLike, type PlayerStatus, type VoiceDeps } from '@/voice/engine';
import { MAX_CHARS, cleanForSpeech, speechChunks, splitSentences } from '@/voice/text';

/* Your Myte's voice on the phone (ADR-0050): what is said (markdown and citations out, sentences
   kept whole, chunks the server accepts) and the queue (one request per chunk, the next fetched
   while one plays, cached for replay, pause/resume/seek/stop, speed, a 429 retried once, any
   other failure stops and reports, never a device voice). */

describe('what the voice says', () => {
  it('strips markdown, links, code and citations', () => {
    expect(cleanForSpeech('**Ship it** on _Friday_ [1]. See [the doc](https://x.io/a) and `v2`.')).toBe(
      'Ship it on Friday. See the doc and v2.',
    );
    expect(cleanForSpeech('# Plan\n- one\n- two\n> quoted【4†source】 https://example.com')).toBe('Plan. one. two. quoted');
  });

  it('splits sentences without breaking decimals or abbreviations', () => {
    expect(splitSentences('Revenue grew 3.5 percent. Dr. Rao agreed! Did it ship? Yes')).toEqual([
      'Revenue grew 3.5 percent.',
      'Dr. Rao agreed!',
      'Did it ship?',
      'Yes',
    ]);
  });

  it('says the first sentence alone, then groups the rest', () => {
    const text = 'First one. Second is here. Third is here. Fourth is here.';
    expect(speechChunks(text, { target: 30 })).toEqual(['First one.', 'Second is here. Third is here.', 'Fourth is here.']);
    expect(speechChunks('   ')).toEqual([]);
    expect(speechChunks('[1] ---')).toEqual([]);
  });

  it('never sends more than the server accepts', () => {
    const long = `${'word, '.repeat(400)}end.`;
    const chunks = speechChunks(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length >= 1 && c.length <= MAX_CHARS)).toBe(true);
  });
});

type Fake = PlayerLike & { emit(s: Partial<PlayerStatus>): void; uri: string; play: jest.Mock; pause: jest.Mock; replace: jest.Mock };

function setup(fetchImpl?: (text: string) => Promise<ArrayBuffer>) {
  const fetched: string[] = [];
  const players: Fake[] = [];
  const deleted: string[] = [];
  let release: (() => void)[] = [];
  const deps: VoiceDeps = {
    fetchSpeech: jest.fn(async (body) => {
      fetched.push(body.text);
      return fetchImpl ? fetchImpl(body.text) : new ArrayBuffer(4);
    }),
    writeFile: jest.fn((name: string) => `file:///cache/voice/${name}`),
    deleteFile: jest.fn((uri: string) => void deleted.push(uri)),
    createPlayer: jest.fn((uri: string) => {
      const listeners: ((s: PlayerStatus) => void)[] = [];
      const p: Fake = {
        uri,
        play: jest.fn(),
        pause: jest.fn(),
        remove: jest.fn(),
        replace: jest.fn((src: { uri: string }) => {
          p.uri = src.uri;
        }),
        addListener: (_e, fn) => void listeners.push(fn),
        setPlaybackRate: jest.fn(),
        emit: (s) => listeners.forEach((l) => l({ playing: true, currentTime: 0, duration: 2, didJustFinish: false, ...s })),
      };
      players.push(p);
      return p;
    }),
    wait: jest.fn(
      () =>
        new Promise<void>((r) => {
          release.push(r);
        }),
    ),
  };
  const engine = new VoiceEngine(deps);
  const flush = async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  };
  const releaseWaits = () => {
    release.forEach((r) => r());
    release = [];
  };
  return { engine, deps, fetched, players, deleted, flush, releaseWaits };
}

const items = [{ text: 'One.', tag: 0 }, { text: 'Two.', tag: 0 }, { text: 'Three.', tag: 1 }];

describe('the voice queue', () => {
  it('plays item by item, prefetching the next while one plays', async () => {
    const t = setup();
    const seen: number[] = [];
    const done = jest.fn();
    t.engine.speak(items, { speed: 1.05, language: 'en' }, { onItem: (i) => seen.push(i), onDone: done });
    await t.flush();
    expect(t.fetched).toEqual(['One.', 'Two.']);
    expect(t.players).toHaveLength(1);
    expect(t.players[0]?.play).toHaveBeenCalledTimes(1);
    expect(t.deps.fetchSpeech).toHaveBeenCalledWith({ text: 'One.', voice: undefined, speed: 1.05, language: 'en' });

    t.players[0]?.emit({ didJustFinish: true });
    await t.flush();
    expect(t.players[0]?.replace).toHaveBeenCalledTimes(1);
    expect(t.fetched).toEqual(['One.', 'Two.', 'Three.']);

    t.players[0]?.emit({ didJustFinish: true });
    await t.flush();
    t.players[0]?.emit({ didJustFinish: true });
    await t.flush();
    expect(seen).toEqual([0, 1, 2]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('reports progress inside an item', async () => {
    const t = setup();
    const progress = jest.fn();
    t.engine.speak(items, {}, { onProgress: progress });
    await t.flush();
    t.players[0]?.emit({ currentTime: 1, duration: 2 });
    expect(progress).toHaveBeenLastCalledWith(0, 0.5);
  });

  it('pauses, resumes the same sentence, seeks and stops', async () => {
    const t = setup();
    const playing = jest.fn();
    t.engine.speak(items, {}, { onPlaying: playing });
    await t.flush();
    const p = t.players[0] as Fake;
    t.engine.pause();
    expect(p.pause).toHaveBeenCalled();
    expect(playing).toHaveBeenLastCalledWith(false);
    t.engine.resume();
    expect(p.play).toHaveBeenCalledTimes(2);
    expect(p.replace).not.toHaveBeenCalled();

    t.engine.seek(2);
    await t.flush();
    expect(p.uri).toContain('.mp3');
    expect(t.engine.index).toBe(2);

    t.engine.stop();
    p.emit({ didJustFinish: true });
    await t.flush();
    expect(t.engine.index).toBe(2);
  });

  it('replays from the cache without asking the server again', async () => {
    const t = setup();
    t.engine.speak(items.slice(0, 1));
    await t.flush();
    t.engine.speak(items.slice(0, 1));
    await t.flush();
    expect(t.fetched).toEqual(['One.']);
    expect(t.players[0]?.play).toHaveBeenCalledTimes(2);
  });

  it('keeps the speed on the player, pitch-corrected', async () => {
    const t = setup();
    t.engine.setRate(1.5);
    t.engine.speak(items);
    await t.flush();
    expect(t.players[0]?.setPlaybackRate).toHaveBeenCalledWith(1.5, 'high');
    t.engine.setRate(2);
    expect(t.players[0]?.setPlaybackRate).toHaveBeenLastCalledWith(2, 'high');
  });

  it('a pause while the first sentence loads waits for Play', async () => {
    let resolve: (b: ArrayBuffer) => void = () => undefined;
    const t = setup(() => new Promise((r) => (resolve = r)));
    t.engine.speak(items.slice(0, 1));
    t.engine.pause();
    resolve(new ArrayBuffer(2));
    await t.flush();
    expect(t.players).toHaveLength(0);
    t.engine.resume();
    await t.flush();
    expect(t.players[0]?.play).toHaveBeenCalled();
  });

  it('retries a 429 once after a short wait', async () => {
    let n = 0;
    const t = setup(async () => {
      n += 1;
      if (n === 1) throw Object.assign(new Error('slow down'), { status: 429 });
      return new ArrayBuffer(2);
    });
    const error = jest.fn();
    t.engine.speak(items.slice(0, 1), {}, { onError: error });
    await t.flush();
    expect(t.deps.wait).toHaveBeenCalledWith(2500);
    t.releaseWaits();
    await t.flush();
    expect(error).not.toHaveBeenCalled();
    expect(t.players[0]?.play).toHaveBeenCalled();
  });

  it('stops and reports when the voice is not connected, and a later Play tries again', async () => {
    let fail = true;
    const t = setup(async () => {
      if (fail) throw Object.assign(new Error('voice_not_connected'), { status: 503 });
      return new ArrayBuffer(2);
    });
    const error = jest.fn();
    const loading = jest.fn();
    t.engine.speak(items, {}, { onError: error, onLoading: loading });
    await t.flush();
    expect(error).toHaveBeenCalledTimes(1);
    expect(loading).toHaveBeenLastCalledWith(false);
    expect(t.players).toHaveLength(0);
    expect(t.deps.wait).not.toHaveBeenCalled();
    fail = false;
    t.engine.speak(items, {}, { onError: error });
    await t.flush();
    expect(error).toHaveBeenCalledTimes(1);
    expect(t.players[0]?.play).toHaveBeenCalled();
  });

  it('releases the player and deletes its files when disposed', async () => {
    const t = setup();
    t.engine.speak(items);
    await t.flush();
    t.engine.dispose();
    expect(t.players[0]?.remove).toHaveBeenCalled();
    expect(t.deleted).toHaveLength(2);
  });
});
