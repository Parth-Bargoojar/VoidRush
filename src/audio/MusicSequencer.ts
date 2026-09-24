/**
 * VOIDRUSH — procedural synthwave soundtrack.
 *
 * [PRD 29] Electronic/arcade music whose intensity follows the run. A classic
 * lookahead scheduler: a timer wakes every few milliseconds and books every
 * note that falls inside the next slice of the audio clock, so timing is
 * sample-exact even when the main thread is busy rendering.
 *
 * Four layers over an Am-F-C-G progression:
 *  - kick on every beat,
 *  - off-beat hi-hats, once the run has picked up speed,
 *  - a pumping eighth-note bassline,
 *  - a sixteenth-note arpeggio, doubled an octave up at high speed.
 * Tempo and filter brightness rise with forward speed.
 *
 * Every note is a self-retiring `Voice`, capped at MUSIC.MAX_VOICES, so the
 * node graph stays bounded however long the session runs.
 */

import { ARP_PATTERN, MUSIC, MUSIC_PROGRESSION, type SoundSpec } from '../config/AudioConfig';
import { clamp, lerp } from '../utils/MathUtils';
import { Voice } from './SoundBank';

const STEPS_PER_BAR = 16;

export class MusicSequencer {
  private readonly context: BaseAudioContext;
  private readonly destination: AudioNode;
  private readonly live = new Set<Voice>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private step = 0;
  /** Forward speed as a fraction of the way from start to maximum, 0-1. */
  private intensity = 0;

  constructor(context: BaseAudioContext, destination: AudioNode) {
    this.context = context;
    this.destination = destination;
  }

  get isPlaying(): boolean {
    return this.timer !== null;
  }

  get liveVoiceCount(): number {
    return this.live.size;
  }

  start(): void {
    if (this.timer !== null) return;
    this.step = 0;
    // A short lead-in so the first bar is never clipped.
    this.nextStepTime = this.context.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), MUSIC.SCHEDULER_INTERVAL_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const voice of [...this.live]) voice.dispose();
    this.live.clear();
  }

  /** 0 at starting speed, 1 at maximum speed. */
  setIntensity(value: number): void {
    this.intensity = clamp(value, 0, 1);
  }

  private get stepSeconds(): number {
    const bpm = lerp(MUSIC.BPM_MIN, MUSIC.BPM_MAX, this.intensity);
    return 60 / bpm / 4;
  }

  /** Books every step that starts inside the lookahead window. */
  private schedule(): void {
    const horizon = this.context.currentTime + MUSIC.LOOKAHEAD_SECONDS;
    // If the tab was throttled, skip ahead rather than firing a burst of notes.
    if (this.nextStepTime < this.context.currentTime - MUSIC.LOOKAHEAD_SECONDS) {
      this.nextStepTime = this.context.currentTime + 0.02;
    }
    while (this.nextStepTime < horizon) {
      this.playStep(this.step, this.nextStepTime);
      this.nextStepTime += this.stepSeconds;
      this.step = (this.step + 1) % (STEPS_PER_BAR * MUSIC_PROGRESSION.length);
    }
  }

  private playStep(step: number, when: number): void {
    const bar = MUSIC_PROGRESSION[Math.floor(step / STEPS_PER_BAR)]!;
    const inBar = step % STEPS_PER_BAR;
    const intensity = this.intensity;
    const sixteenth = this.stepSeconds;

    // Kick on every beat.
    if (inBar % 4 === 0) {
      this.note(when, {
        wave: 'sine', freq: 150, freqTo: 42, gain: MUSIC.KICK_GAIN,
        attack: 0.002, duration: 0.2, noise: 0, cutoff: 900,
      });
    }

    // Off-beat hats once the run is moving.
    if (inBar % 4 === 2 && intensity >= MUSIC.HATS_FROM) {
      this.note(when, {
        wave: 'square', freq: 7000, freqTo: 6000, gain: MUSIC.HAT_GAIN,
        attack: 0.001, duration: 0.05, noise: 1.6, cutoff: 12000,
      });
    }

    // Eighth-note bass, alternating root and octave for the classic pump.
    if (inBar % 2 === 0) {
      const octave = inBar % 4 === 2 ? 2 : 1;
      this.note(when, {
        wave: 'sawtooth', freq: bar.bass * octave, freqTo: bar.bass * octave,
        gain: MUSIC.BASS_GAIN, attack: 0.004, duration: sixteenth * 1.8, noise: 0,
        cutoff: lerp(MUSIC.BASS_CUTOFF_MIN, MUSIC.BASS_CUTOFF_MAX, intensity),
      });
    }

    // Sixteenth-note arpeggio through the chord tones.
    const tone = bar.chord[ARP_PATTERN[inBar]!]!;
    const arpCutoff = lerp(MUSIC.ARP_CUTOFF_MIN, MUSIC.ARP_CUTOFF_MAX, intensity);
    this.note(when, {
      wave: 'square', freq: tone, freqTo: tone, gain: MUSIC.ARP_GAIN,
      attack: 0.003, duration: sixteenth * 0.9, noise: 0, cutoff: arpCutoff,
    });
    if (intensity >= MUSIC.ARP_OCTAVE_FROM && inBar % 2 === 1) {
      this.note(when, {
        wave: 'triangle', freq: tone * 2, freqTo: tone * 2, gain: MUSIC.ARP_GAIN * 0.8,
        attack: 0.003, duration: sixteenth * 0.8, noise: 0, cutoff: arpCutoff,
      });
    }
  }

  private note(when: number, spec: SoundSpec): void {
    if (this.live.size >= MUSIC.MAX_VOICES) {
      const oldest = this.live.values().next().value;
      if (oldest) oldest.dispose();
    }
    try {
      const voice = new Voice(this.context, spec, this.destination, 1, when);
      voice.onRetire = (): void => {
        this.live.delete(voice);
      };
      this.live.add(voice);
    } catch {
      // A failed note must never interrupt the game.
    }
  }
}
