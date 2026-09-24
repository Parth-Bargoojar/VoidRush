/**
 * VOIDRUSH — synthesised voices.
 *
 * Every sound in the game is built here from oscillators and shaped noise,
 * including each note of the procedural soundtrack. No audio file is needed,
 * which is what lets the built game run offline from static files.
 *
 * A voice owns its nodes, schedules its own envelope, and disconnects itself
 * when it finishes, so the node graph cannot grow across a long session.
 */

import { AUDIO, SOUNDS, type SoundId, type SoundSpec } from '../config/AudioConfig';

/** A single playing sound. Self-retiring. */
export class Voice {
  private readonly context: BaseAudioContext;
  private readonly nodes: AudioNode[] = [];
  private stopped = false;

  /**
   * `when` schedules the voice on the audio clock; it defaults to now. The
   * soundtrack sequencer uses it to place notes ahead of time, sample-exact.
   */
  constructor(
    context: BaseAudioContext,
    spec: SoundSpec,
    destination: AudioNode,
    volume: number,
    when?: number,
  ) {
    this.context = context;
    const now = Math.max(when ?? context.currentTime, context.currentTime);
    const end = now + spec.duration;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(spec.gain * volume, now + spec.attack);
    // Exponential decay reads as a percussive arcade blip rather than a fade.
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(spec.cutoff, now);

    gain.connect(filter);
    filter.connect(destination);
    this.nodes.push(gain, filter);

    const oscillator = context.createOscillator();
    oscillator.type = spec.wave;
    oscillator.frequency.setValueAtTime(spec.freq, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, spec.freqTo), end);
    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(end);
    this.nodes.push(oscillator);

    if (spec.noise > 0) {
      const noise = this.createNoise(spec.duration);
      const noiseGain = context.createGain();
      noiseGain.gain.setValueAtTime(spec.noise * spec.gain * volume, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, end);
      noise.connect(noiseGain);
      noiseGain.connect(filter);
      noise.start(now);
      noise.stop(end);
      this.nodes.push(noise, noiseGain);
    }

    oscillator.onended = (): void => this.dispose();
  }

  private createNoise(duration: number): AudioBufferSourceNode {
    const source = this.context.createBufferSource();
    source.buffer = noiseBuffer(this.context, duration);
    return source;
  }

  /** Disconnects every node this voice owns. */
  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const node of this.nodes) {
      try {
        node.disconnect();
      } catch {
        // Already detached; nothing to do.
      }
    }
    this.nodes.length = 0;
    this.onRetire?.();
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  onRetire: (() => void) | null = null;
}

/** One noise buffer per context, long enough for any voice; reused, not rebuilt. */
const NOISE_SECONDS = 1;
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(context: BaseAudioContext, duration: number): AudioBuffer {
  // Longer requests than the shared buffer get their own, which never happens
  // with the shipped sounds but keeps the helper honest.
  const seconds = Math.max(NOISE_SECONDS, duration);
  const cached = noiseBuffers.get(context);
  if (cached && cached.duration >= seconds) return cached;

  const rate = context.sampleRate;
  const frames = Math.max(1, Math.floor(rate * seconds));
  const buffer = context.createBuffer(1, frames, rate);
  const data = buffer.getChannelData(0);
  // Deterministic noise: the audio graph has no business calling Math.random.
  let state = 0x9e3779b9;
  for (let i = 0; i < frames; i += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    data[i] = (state / 0xffffffff) * 2 - 1;
  }
  if (seconds === NOISE_SECONDS) noiseBuffers.set(context, buffer);
  return buffer;
}

export function specFor(id: SoundId): SoundSpec {
  return SOUNDS[id];
}

export const MAX_VOICES = AUDIO.MAX_VOICES;
