/**
 * VOIDRUSH — audio configuration.
 *
 * All audio is synthesised at runtime with the Web Audio API. There are no
 * audio files: the project ships zero external assets so it runs offline from
 * static files.
 */

import { frozen } from './frozen';

export type SoundId =
  | 'UI_HOVER'
  | 'UI_CLICK'
  | 'GAME_START'
  | 'OBSTACLE_PASS'
  | 'NEAR_MISS'
  | 'COMBO_UP'
  | 'COLLISION'
  | 'GAME_OVER';

export interface SoundSpec {
  /** Oscillator type for the tone body. */
  readonly wave: OscillatorType;
  /** Start frequency in Hz. */
  readonly freq: number;
  /** Frequency the tone glides to across its lifetime. */
  readonly freqTo: number;
  /** Peak gain before the volume settings are applied. */
  readonly gain: number;
  /** Attack and total duration, in seconds. */
  readonly attack: number;
  readonly duration: number;
  /** Optional noise burst mixed in, 0 disables it. */
  readonly noise: number;
  /** Low-pass cutoff applied to the voice. */
  readonly cutoff: number;
}

export const SOUNDS: Readonly<Record<SoundId, SoundSpec>> = Object.freeze({
  UI_HOVER: Object.freeze({
    wave: 'sine', freq: 620, freqTo: 660, gain: 0.06,
    attack: 0.004, duration: 0.07, noise: 0, cutoff: 4000,
  }),
  UI_CLICK: Object.freeze({
    wave: 'square', freq: 340, freqTo: 200, gain: 0.11,
    attack: 0.003, duration: 0.1, noise: 0.05, cutoff: 3200,
  }),
  GAME_START: Object.freeze({
    wave: 'sawtooth', freq: 180, freqTo: 720, gain: 0.16,
    attack: 0.02, duration: 0.5, noise: 0, cutoff: 6000,
  }),
  OBSTACLE_PASS: Object.freeze({
    wave: 'triangle', freq: 520, freqTo: 780, gain: 0.09,
    attack: 0.003, duration: 0.11, noise: 0, cutoff: 5200,
  }),
  NEAR_MISS: Object.freeze({
    wave: 'sine', freq: 1180, freqTo: 1560, gain: 0.13,
    attack: 0.002, duration: 0.16, noise: 0.12, cutoff: 8000,
  }),
  COMBO_UP: Object.freeze({
    wave: 'square', freq: 660, freqTo: 1320, gain: 0.1,
    attack: 0.004, duration: 0.22, noise: 0, cutoff: 6000,
  }),
  COLLISION: Object.freeze({
    wave: 'sawtooth', freq: 140, freqTo: 40, gain: 0.34,
    attack: 0.002, duration: 0.7, noise: 0.85, cutoff: 1400,
  }),
  GAME_OVER: Object.freeze({
    wave: 'sine', freq: 320, freqTo: 90, gain: 0.2,
    attack: 0.02, duration: 0.9, noise: 0, cutoff: 2200,
  }),
});

export const AUDIO = frozen({
  /** Ambient drone. Its filter cutoff tracks forward speed. */
  DRONE_BASE_FREQ: 55,
  DRONE_DETUNE: 7,
  DRONE_GAIN: 0.09,
  DRONE_CUTOFF_MIN: 240,
  DRONE_CUTOFF_MAX: 1500,
  DRONE_CUTOFF_TAU: 0.6,
  /** Gain applied to the music bus while paused. */
  PAUSE_DUCK: 0.25,
  DUCK_SECONDS: 0.15,
  /** Hard ceiling on simultaneously live voices, so nodes cannot accumulate. */
  MAX_VOICES: 24,
});

/**
 * [PRD 29] Procedural synthwave soundtrack: kick, off-beat hats, a pumping
 * bassline and a sixteenth-note arpeggio over an Am-F-C-G progression. Tempo
 * rises with forward speed, and layers join as the run accelerates.
 */
export const MUSIC = frozen({
  /** Tempo at starting speed and at maximum speed, in beats per minute. */
  BPM_MIN: 112,
  BPM_MAX: 158,
  /** How far ahead notes are scheduled on the audio clock, and how often. */
  LOOKAHEAD_SECONDS: 0.12,
  SCHEDULER_INTERVAL_MS: 25,
  /** Ceiling on live music voices, separate from sound effects. */
  MAX_VOICES: 20,
  /** Speed fraction at which the hi-hats and the upper arpeggio octave join. */
  HATS_FROM: 0.15,
  ARP_OCTAVE_FROM: 0.55,
  /** Bass and arpeggio filters open as the run speeds up. */
  BASS_CUTOFF_MIN: 380,
  BASS_CUTOFF_MAX: 1100,
  ARP_CUTOFF_MIN: 1400,
  ARP_CUTOFF_MAX: 5200,
  KICK_GAIN: 0.42,
  HAT_GAIN: 0.05,
  BASS_GAIN: 0.16,
  ARP_GAIN: 0.07,
  /** Seconds for an external soundtrack file to fade in. */
  TRACK_FADE_SECONDS: 2.5,
});

/**
 * Chord progression, one bar each: A minor, F major, C major, G major.
 * Bass roots in Hz (octave 1-2) and arpeggio chord tones in Hz (octave 4).
 */
export const MUSIC_PROGRESSION: ReadonlyArray<{
  readonly bass: number;
  readonly chord: readonly [number, number, number];
}> = Object.freeze([
  Object.freeze({ bass: 55, chord: Object.freeze([440, 523.25, 659.25] as const) }),
  Object.freeze({ bass: 43.65, chord: Object.freeze([349.23, 440, 523.25] as const) }),
  Object.freeze({ bass: 65.41, chord: Object.freeze([523.25, 659.25, 783.99] as const) }),
  Object.freeze({ bass: 49, chord: Object.freeze([392, 493.88, 587.33] as const) }),
]);

/** Arpeggio order across one bar of sixteenths: indexes into the chord tones. */
export const ARP_PATTERN: ReadonlyArray<number> = Object.freeze([
  0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 0, 1,
]);
