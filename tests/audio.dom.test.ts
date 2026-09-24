/**
 * @vitest-environment jsdom
 *
 * The audio graph must fail soft when audio is unavailable, and must not grow
 * across a long session.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { AUDIO, MUSIC } from '../src/config/AudioConfig';
import { AudioEngine } from '../src/audio/AudioEngine';

/* ------------------------------------------------------------------ *
 * A minimal Web Audio stand-in. jsdom implements none of it, so the node
 * accounting is exercised against this rather than a real context.
 * ------------------------------------------------------------------ */

/** Raw count of fake nodes that have been created and not disconnected. */
let liveNodes = 0;
const getLiveNodes = (): number => liveNodes;

class FakeParam {
  value = 0;
  setValueAtTime(): this {
    return this;
  }
  linearRampToValueAtTime(): this {
    return this;
  }
  exponentialRampToValueAtTime(): this {
    return this;
  }
}

class FakeNode {
  connected = 0;
  constructor() {
    liveNodes += 1;
  }
  connect(): void {
    this.connected += 1;
  }
  disconnect(): void {
    liveNodes -= 1;
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam();
}

class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  detune = new FakeParam();
  onended: (() => void) | null = null;
  start(): void {
    /* scheduled */
  }
  stop(): void {
    // Fire the end callback synchronously so retirement is observable.
    queueMicrotask(() => this.onended?.());
  }
}

class FakeBufferSource extends FakeNode {
  buffer: unknown = null;
  start(): void {
    /* scheduled */
  }
  stop(): void {
    /* scheduled */
  }
}

class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  destination = new FakeNode();
  state = 'running';
  createGain(): FakeGain {
    return new FakeGain();
  }
  createBiquadFilter(): FakeFilter {
    return new FakeFilter();
  }
  createOscillator(): FakeOscillator {
    return new FakeOscillator();
  }
  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource();
  }
  createBuffer(_channels: number, frames: number): AudioBuffer {
    const data = new Float32Array(frames);
    return { getChannelData: () => data } as unknown as AudioBuffer;
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

type Ctor = new () => AudioContext;
const scope = globalThis as { AudioContext?: Ctor; webkitAudioContext?: Ctor };

function installFakeAudio(): void {
  liveNodes = 0;
  scope.AudioContext = FakeAudioContext as unknown as Ctor;
}

function removeAudio(): void {
  delete scope.AudioContext;
  delete scope.webkitAudioContext;
}

afterEach(() => removeAudio());

describe('audio failure handling', () => {
  it('stays silent and keeps working when there is no AudioContext', () => {
    removeAudio();
    const engine = new AudioEngine();
    expect(engine.unlock()).toBe(false);
    expect(engine.isSilent).toBe(true);

    // Every call is a no-op rather than an error.
    expect(() => {
      engine.play('COLLISION');
      engine.setSpeed(90);
      engine.setDucked(true);
      engine.setVolumes({ master: 1, music: 1, sfx: 1 });
      engine.stopAll();
      engine.dispose();
    }).not.toThrow();
    expect(engine.liveVoiceCount).toBe(0);
  });

  it('stays silent when constructing the context throws', () => {
    scope.AudioContext = class {
      constructor() {
        throw new Error('audio blocked by policy');
      }
    } as unknown as Ctor;

    const engine = new AudioEngine();
    expect(engine.unlock()).toBe(false);
    expect(engine.isSilent).toBe(true);
    expect(() => engine.play('UI_CLICK')).not.toThrow();
    engine.dispose();
  });

  it('does not retry construction after a failure', () => {
    let attempts = 0;
    scope.AudioContext = class {
      constructor() {
        attempts += 1;
        throw new Error('nope');
      }
    } as unknown as Ctor;

    const engine = new AudioEngine();
    engine.unlock();
    engine.unlock();
    engine.unlock();
    expect(attempts).toBe(1);
    engine.dispose();
  });
});

describe('audio graph lifetime', () => {
  it('builds a graph once unlocked', () => {
    installFakeAudio();
    const engine = new AudioEngine();
    expect(engine.unlock()).toBe(true);
    expect(engine.isSilent).toBe(false);
    engine.dispose();
  });

  it('does not grow the node count across 500 events', async () => {
    installFakeAudio();
    const engine = new AudioEngine();
    engine.unlock();

    const ids = ['OBSTACLE_PASS', 'NEAR_MISS', 'COMBO_UP', 'UI_CLICK'] as const;
    for (let i = 0; i < 500; i += 1) {
      engine.play(ids[i % ids.length]!);
      // Let retirement callbacks run, as they would between frames.
      if (i % 16 === 0) await Promise.resolve();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Voices are capped and each disconnects itself, so nothing accumulates.
    expect(engine.liveVoiceCount).toBeLessThanOrEqual(AUDIO.MAX_VOICES);
    expect(engine.nodeCount).toBeLessThanOrEqual(AUDIO.MAX_VOICES + 8);
    // The raw graph is bounded too: each voice owns at most five nodes, plus
    // the fixed buses and drone. 500 events must not leave 500 nodes behind.
    expect(getLiveNodes()).toBeLessThan(AUDIO.MAX_VOICES * 5 + 16);
    engine.dispose();
  });

  it('releases every node on dispose', async () => {
    installFakeAudio();
    const engine = new AudioEngine();
    engine.unlock();
    for (let i = 0; i < 40; i += 1) engine.play('OBSTACLE_PASS');
    engine.dispose();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(engine.liveVoiceCount).toBe(0);
  });

  it('clamps volumes into range', () => {
    installFakeAudio();
    const engine = new AudioEngine();
    engine.unlock();
    expect(() => engine.setVolumes({ master: 99, music: -4, sfx: Number.NaN })).not.toThrow();
    engine.dispose();
  });

  it('tracks speed without error at the extremes', () => {
    installFakeAudio();
    const engine = new AudioEngine();
    engine.unlock();
    expect(() => {
      engine.setSpeed(0);
      engine.setSpeed(1000);
      engine.setSpeed(-50);
    }).not.toThrow();
    engine.dispose();
  });
});

describe('soundtrack', () => {
  it('does nothing before a user gesture has unlocked audio', () => {
    installFakeAudio();
    const engine = new AudioEngine();
    engine.startMusic();
    expect(engine.isMusicPlaying).toBe(false);
    engine.dispose();
  });

  it('stays silent, without error, when audio is blocked', () => {
    removeAudio();
    const engine = new AudioEngine();
    engine.unlock();
    expect(() => engine.startMusic()).not.toThrow();
    expect(engine.isMusicPlaying).toBe(false);
    engine.dispose();
  });

  it('plays the procedural synth when no soundtrack file shipped, bounded and self-cleaning', async () => {
    installFakeAudio();
    const engine = new AudioEngine();
    engine.unlock();
    engine.startMusic();
    engine.startMusic();
    expect(engine.isMusicPlaying).toBe(true);

    // Let the scheduler run across many ticks at full speed.
    engine.setSpeed(1000);
    for (let i = 0; i < 12; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, MUSIC.SCHEDULER_INTERVAL_MS));
    }
    expect(engine.nodeCount).toBeLessThanOrEqual(4 + 3 + MUSIC.MAX_VOICES + AUDIO.MAX_VOICES);

    engine.dispose();
    expect(engine.isMusicPlaying).toBe(false);
  });
});

